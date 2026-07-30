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

echo "1/10 preflight guard"
"$BASE/scripts/pre-deploy-guard.sh" || { echo "guard failed, aborting"; exit 1; }

echo "2/10 unpack artifact into new release dir"
mkdir -p "$RELEASE_DIR"
tar -xzf "$ARTIFACT_PATH" -C "$RELEASE_DIR"

echo "3/10 verify checksums"
( cd "$RELEASE_DIR" && sha256sum -c checksums.sha256 )

echo "4/10 link shared safe files (never copy .env into a release dir)"
ln -sf "$SHARED_DIR/.env" "$RELEASE_DIR/.env"

echo "5/10 install production deps for this release (from its own lockfile only)"
( cd "$RELEASE_DIR" && npm ci --omit=dev )

echo "6/10 preflight: start on a scratch port, not the live one"
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

echo "7/10 atomic symlink swap"
PREVIOUS_TARGET="$(readlink -f "$CURRENT_LINK" 2>/dev/null || echo "")"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK.tmp"
mv -T "$CURRENT_LINK.tmp" "$CURRENT_LINK"   # mv is atomic on the same filesystem; ln -sfn alone is not on all systems

echo "8/10 reload PM2 (not full restart where avoidable, to minimize downtime)"
pm2 reload nulip-inventory --update-env

echo "9/10 post-deploy health check against the live port"
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

echo "10/10 record deploy in audit log, keep previous release for emergency rollback"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)|BUILD_ID=$BUILD_ID|COMMIT=$(cat "$RELEASE_DIR/COMMIT_SHA" 2>/dev/null)|PREVIOUS=$PREVIOUS_TARGET|RESULT=SUCCESS" >> "$BASE/deploy-audit.log"

echo "$BUILD_ID" > "$CURRENT_LINK/RELEASE_COMMIT"
echo "DEPLOY OK: $BUILD_ID is now live. Previous release kept at: $PREVIOUS_TARGET"
