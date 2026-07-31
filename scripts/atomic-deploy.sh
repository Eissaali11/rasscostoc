#!/usr/bin/env bash
#
# Atomic deploy — DESIGN / READY-TO-USE, NOT EXECUTED against production by this session.
#
# Layout this script assumes (must be provisioned once, manually, before first use):
#   /home/nuzum/htdocs/nuzum.fun/releases/<BUILD_ID>/     - one immutable directory per release
#   /home/nuzum/htdocs/nuzum.fun/shared/.env              - the one real .env, symlinked into each release
#   /home/nuzum/htdocs/nuzum.fun/current -> releases/<BUILD_ID>  - the live symlink PM2/nginx actually serve
#
# Usage: BUILD_ID=<id> ARTIFACT_PATH=<path-to-tarball> ./atomic-deploy.sh

set -euo pipefail

BASE="/home/nuzum/htdocs/nuzum.fun"
RELEASES_DIR="$BASE/releases"
SHARED_DIR="$BASE/shared"
CURRENT_LINK="$BASE/current"

: "${BUILD_ID:?BUILD_ID env var required}"
: "${ARTIFACT_PATH:?ARTIFACT_PATH env var required (path to the release artifact produced by build-and-package.sh)}"

RELEASE_DIR="$RELEASES_DIR/$BUILD_ID"

# Deploy-source policy: production may only be deployed from an up-to-date
# main or an approved tag. This is a *process* restriction (like the guard's
# freeze/branch/rollback checks), so EMERGENCY_OVERRIDE=1 can bypass it --
# with the same mandatory approver/incident/confirmation fields the guard
# itself requires (checked again a few lines down when the guard runs).
# It can NEVER be bypassed for: checksum verification, the preflight health
# check, the live health check + auto-rollback, or the audit log write --
# none of those steps below reference EMERGENCY_OVERRIDE at all.
echo "1/11 deploy-source policy check"
APPROVED_TAG_PATTERN="^production-stable-"
EMERGENCY_OVERRIDE="${EMERGENCY_OVERRIDE:-0}"

SOURCE_DIRTY_COUNT="$(git status --porcelain=v1 --untracked-files=all 2>/dev/null | wc -l | tr -d ' ')"
if [ "$SOURCE_DIRTY_COUNT" != "0" ] && [ "$EMERGENCY_OVERRIDE" != "1" ]; then
  echo "DEPLOY REFUSED: source worktree is not clean ($SOURCE_DIRTY_COUNT changed/untracked paths)."
  exit 1
fi

SOURCE_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
SOURCE_SHA="$(git rev-parse HEAD 2>/dev/null || echo "")"

if [ "$SOURCE_BRANCH" = "HEAD" ]; then
  MATCHING_TAG="$(git tag --points-at HEAD 2>/dev/null | grep -E "$APPROVED_TAG_PATTERN" | head -1)"
  if [ -z "$MATCHING_TAG" ] && [ "$EMERGENCY_OVERRIDE" != "1" ]; then
    echo "DEPLOY REFUSED: detached HEAD ($SOURCE_SHA) is not tied to an approved tag (pattern: $APPROVED_TAG_PATTERN)."
    exit 1
  fi
  [ -n "$MATCHING_TAG" ] && echo "deploy source: approved tag $MATCHING_TAG ($SOURCE_SHA)"
else
  case "$SOURCE_BRANCH" in
    main) ;;
    cursor/*|erp-*|copilot/*|tmp-*)
      if [ "$EMERGENCY_OVERRIDE" != "1" ]; then
        echo "DEPLOY REFUSED: branch '$SOURCE_BRANCH' matches a disallowed deploy-source pattern (cursor/*, erp-*, copilot/*, tmp-*)."
        exit 1
      fi
      ;;
    *)
      if [ "$EMERGENCY_OVERRIDE" != "1" ]; then
        echo "DEPLOY REFUSED: branch '$SOURCE_BRANCH' is neither 'main' nor an approved tag."
        exit 1
      fi
      ;;
  esac
  if [ "$SOURCE_BRANCH" = "main" ]; then
    git fetch origin --quiet || { echo "DEPLOY REFUSED: could not fetch origin to verify main is up to date."; exit 1; }
    SOURCE_BEHIND="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
    SOURCE_AHEAD="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)"
    if { [ "$SOURCE_BEHIND" != "0" ] || [ "$SOURCE_AHEAD" != "0" ]; } && [ "$EMERGENCY_OVERRIDE" != "1" ]; then
      echo "DEPLOY REFUSED: local main ($SOURCE_SHA) is not exactly in sync with origin/main (behind=$SOURCE_BEHIND, ahead=$SOURCE_AHEAD)."
      exit 1
    fi
    echo "deploy source: main, in sync with origin/main ($SOURCE_SHA)"
  fi
fi
echo "deploy-source policy check passed"

echo "2/11 preflight guard"
"$BASE/scripts/pre-deploy-guard.sh" || { echo "guard failed, aborting"; exit 1; }

echo "3/11 unpack artifact into new release dir"
mkdir -p "$RELEASE_DIR"
tar -xzf "$ARTIFACT_PATH" -C "$RELEASE_DIR"

echo "4/11 verify checksums"
( cd "$RELEASE_DIR" && sha256sum -c checksums.sha256 )

echo "5/11 link shared safe files (never copy .env into a release dir)"
ln -sf "$SHARED_DIR/.env" "$RELEASE_DIR/.env"

echo "6/11 install production deps for this release (from its own lockfile only)"
( cd "$RELEASE_DIR" && npm ci --omit=dev )

echo "7/11 preflight: start on a scratch port, not the live one"
PREFLIGHT_PORT=5098
( cd "$RELEASE_DIR" && PORT=$PREFLIGHT_PORT node dist/server.js & echo $! > /tmp/preflight.pid )
sleep 5
PREFLIGHT_HEALTH="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PREFLIGHT_PORT/api/health" || echo 000)"
kill "$(cat /tmp/preflight.pid)" 2>/dev/null || true
if [ "$PREFLIGHT_HEALTH" != "200" ]; then
  echo "preflight health check on scratch port failed ($PREFLIGHT_HEALTH) — aborting before touching current"
  exit 1
fi
echo "preflight ok"

echo "8/11 atomic symlink swap"
PREVIOUS_TARGET="$(readlink -f "$CURRENT_LINK" 2>/dev/null || echo "")"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK.tmp"
mv -T "$CURRENT_LINK.tmp" "$CURRENT_LINK"   # mv is atomic on the same filesystem; ln -sfn alone is not on all systems

echo "9/11 reload PM2 (not full restart where avoidable, to minimize downtime)"
pm2 reload nulip-inventory --update-env

echo "10/11 post-deploy health check against the live port"
sleep 3
LIVE_HEALTH="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/health || echo 000)"
if [ "$LIVE_HEALTH" != "200" ]; then
  echo "LIVE HEALTH CHECK FAILED ($LIVE_HEALTH) — rolling back symlink to previous release"
  if [ -n "$PREVIOUS_TARGET" ]; then
    ln -sfn "$PREVIOUS_TARGET" "$CURRENT_LINK.tmp"
    mv -T "$CURRENT_LINK.tmp" "$CURRENT_LINK"
    pm2 reload nulip-inventory --update-env
    echo "rolled back to $PREVIOUS_TARGET"
  fi
  exit 1
fi

echo "11/11 record deploy in audit log, keep previous release for emergency rollback"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)|BUILD_ID=$BUILD_ID|COMMIT=$(cat "$RELEASE_DIR/COMMIT_SHA" 2>/dev/null)|PREVIOUS=$PREVIOUS_TARGET|RESULT=SUCCESS" >> "$BASE/deploy-audit.log"

echo "$BUILD_ID" > "$CURRENT_LINK/RELEASE_COMMIT"
echo "DEPLOY OK: $BUILD_ID is now live. Previous release kept at: $PREVIOUS_TARGET"
