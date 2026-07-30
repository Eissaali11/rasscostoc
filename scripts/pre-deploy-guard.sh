#!/usr/bin/env bash
#
# Pre-Deploy Guard
#
# Run this from the deploy target's project directory before ANY deploy
# (manual or automated). Exits non-zero and refuses to proceed on the first
# failed check. No check here can be skipped without EMERGENCY_OVERRIDE=1
# plus EMERGENCY_REASON set, both of which are written to the deploy audit
# log verbatim — this is a documented, traceable escape hatch, not a bypass.
#
# Exit codes:
#   0  - all checks passed, deploy may proceed
#   1  - a guard check failed
#   2  - usage / environment error (guard itself couldn't run)

set -uo pipefail

OFFICIAL_BRANCH="${OFFICIAL_BRANCH:-main}"
MIN_FREE_DISK_MB="${MIN_FREE_DISK_MB:-1024}"
CURRENT_RELEASE_COMMIT_FILE="${CURRENT_RELEASE_COMMIT_FILE:-/home/nuzum/htdocs/nuzum.fun/RELEASE_COMMIT}"
FREEZE_FILE="${FREEZE_FILE:-.deployment-freeze}"

fail() {
  echo "PRE_DEPLOY_GUARD: FAIL - $1" >&2
  exit 1
}
warn() {
  echo "PRE_DEPLOY_GUARD: WARN - $1" >&2
}
ok() {
  echo "PRE_DEPLOY_GUARD: ok - $1"
}

EMERGENCY_OVERRIDE="${EMERGENCY_OVERRIDE:-0}"
EMERGENCY_REASON="${EMERGENCY_REASON:-}"
if [ "$EMERGENCY_OVERRIDE" = "1" ]; then
  if [ -z "$EMERGENCY_REASON" ]; then
    fail "EMERGENCY_OVERRIDE=1 set without EMERGENCY_REASON — refusing. Overrides must be documented."
  fi
  echo "PRE_DEPLOY_GUARD: EMERGENCY OVERRIDE ACTIVE — reason: $EMERGENCY_REASON" >&2
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) EMERGENCY_OVERRIDE reason=\"$EMERGENCY_REASON\" user=$(whoami)" >> deploy-audit.log 2>/dev/null || true
fi

# 1. Deployment freeze must not be active (unless overridden)
if [ -f "$FREEZE_FILE" ] && [ "$EMERGENCY_OVERRIDE" != "1" ]; then
  fail "Deployment freeze is ACTIVE ($FREEZE_FILE present). Lift it explicitly before deploying."
fi
ok "deployment freeze check"

# 2. Must be on the official branch
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
if [ -z "$CURRENT_BRANCH" ]; then
  fail "could not determine current git branch (not a git repo?)"
fi
if [ "$CURRENT_BRANCH" = "HEAD" ]; then
  fail "Detached HEAD — deploys must run from a named branch ($OFFICIAL_BRANCH)."
fi
if [ "$CURRENT_BRANCH" != "$OFFICIAL_BRANCH" ] && [ "$EMERGENCY_OVERRIDE" != "1" ]; then
  fail "current branch is '$CURRENT_BRANCH', not the official branch '$OFFICIAL_BRANCH'. Deploys only from $OFFICIAL_BRANCH."
fi
ok "branch = $CURRENT_BRANCH"

# 3. Worktree must be clean (no local modifications, no untracked source files)
DIRTY_COUNT="$(git status --porcelain=v1 --untracked-files=all | wc -l | tr -d ' ')"
if [ "$DIRTY_COUNT" != "0" ] && [ "$EMERGENCY_OVERRIDE" != "1" ]; then
  fail "worktree is not clean ($DIRTY_COUNT changed/untracked paths). Commit, stash, or .gitignore them first. See: git status --porcelain=v1 --untracked-files=all"
fi
ok "worktree clean"

# 4. HEAD must exist on the remote (not a local-only commit)
git fetch origin --quiet 2>/dev/null || fail "could not fetch origin"
LOCAL_SHA="$(git rev-parse HEAD)"
if ! git branch -r --contains "$LOCAL_SHA" 2>/dev/null | grep -q "origin/$OFFICIAL_BRANCH"; then
  fail "HEAD ($LOCAL_SHA) is not reachable from origin/$OFFICIAL_BRANCH. Push it first."
fi
ok "HEAD is on origin/$OFFICIAL_BRANCH"

# 5. Branch must not be behind remote
BEHIND="$(git rev-list --count HEAD..origin/$OFFICIAL_BRANCH 2>/dev/null || echo 0)"
if [ "$BEHIND" != "0" ]; then
  fail "local $OFFICIAL_BRANCH is $BEHIND commit(s) behind origin/$OFFICIAL_BRANCH. Pull/fast-forward first."
fi
ok "not behind origin/$OFFICIAL_BRANCH"

# 6. Refuse silent rollback: deploying an ancestor of the currently-released commit
if [ -f "$CURRENT_RELEASE_COMMIT_FILE" ]; then
  RELEASED_SHA="$(cat "$CURRENT_RELEASE_COMMIT_FILE" 2>/dev/null | tr -d '[:space:]')"
  if [ -n "$RELEASED_SHA" ] && git cat-file -e "$RELEASED_SHA" 2>/dev/null; then
    if [ "$RELEASED_SHA" != "$LOCAL_SHA" ] && git merge-base --is-ancestor "$LOCAL_SHA" "$RELEASED_SHA" 2>/dev/null; then
      if [ "$EMERGENCY_OVERRIDE" != "1" ]; then
        fail "target commit $LOCAL_SHA is an ANCESTOR of the currently-released $RELEASED_SHA — this is a rollback. Use the documented rollback procedure (with CURRENT_COMMIT/TARGET_COMMIT/DATABASE_COMPATIBILITY/MIGRATION_IMPACT review), not a normal deploy."
      fi
    fi
  fi
fi
ok "not an undocumented rollback"

# 7. Build / typecheck / critical tests must pass
if ! npx tsc -p tsconfig.runtime-check.json > /tmp/pre-deploy-typecheck.log 2>&1; then
  fail "typecheck failed — see /tmp/pre-deploy-typecheck.log"
fi
ok "typecheck"

if ! npm run build > /tmp/pre-deploy-build.log 2>&1; then
  fail "build failed — see /tmp/pre-deploy-build.log"
fi
ok "build"

# 8. Secret scan must pass
if [ -f scripts/secret-scan.cjs ]; then
  if ! node scripts/secret-scan.cjs > /tmp/pre-deploy-secretscan.log 2>&1; then
    fail "secret scan failed — see /tmp/pre-deploy-secretscan.log"
  fi
  ok "secret scan"
else
  warn "scripts/secret-scan.cjs not found — secret scan skipped, this should not happen on $OFFICIAL_BRANCH"
fi

# 9. Lockfile must not have changed without a corresponding reviewed commit
# (heuristic: lockfile hash must match what's committed at HEAD)
LOCKFILE_COMMITTED_HASH="$(git show HEAD:package-lock.json 2>/dev/null | sha256sum | cut -d' ' -f1)"
LOCKFILE_DISK_HASH="$(sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1)"
if [ "$LOCKFILE_COMMITTED_HASH" != "$LOCKFILE_DISK_HASH" ]; then
  fail "package-lock.json on disk does not match the committed version at HEAD. Re-run npm ci or commit the lockfile change."
fi
ok "lockfile matches HEAD"

# 10. No pending migrations without an explicit ALLOW_MIGRATIONS=1
PENDING_MIGRATIONS="$(ls migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')"
if [ -n "${DATABASE_URL:-}" ]; then
  APPLIED="$(psql "$DATABASE_URL" -t -c "select count(*) from drizzle.__drizzle_migrations;" 2>/dev/null | tr -d '[:space:]')"
  if [ -n "$APPLIED" ] && [ "$APPLIED" -lt "$PENDING_MIGRATIONS" ] && [ "${ALLOW_MIGRATIONS:-0}" != "1" ]; then
    fail "$((PENDING_MIGRATIONS - APPLIED)) migration(s) in this branch are not yet applied to the target database. Set ALLOW_MIGRATIONS=1 only after reviewing docs/db-migration-strategy.md and confirming the migration is backward-compatible."
  fi
fi
ok "migration state"

# 11. .env / dist / logs must never be part of what gets shipped as source
FORBIDDEN_TRACKED="$(git ls-files | grep -E '^\.env$|^\.env\.|(^|/)dist/|(^|/)logs/|(^|/)uploads/' || true)"
if [ -n "$FORBIDDEN_TRACKED" ]; then
  fail "forbidden paths are tracked in git: $(echo "$FORBIDDEN_TRACKED" | tr '\n' ' ')"
fi
ok "no forbidden paths tracked"

# 12. Source and build must reference the same commit SHA
if [ -f dist/RELEASE_SHA ]; then
  BUILD_SHA="$(cat dist/RELEASE_SHA | tr -d '[:space:]')"
  if [ "$BUILD_SHA" != "$LOCAL_SHA" ]; then
    fail "dist/RELEASE_SHA ($BUILD_SHA) does not match source HEAD ($LOCAL_SHA) — stale or mixed build."
  fi
  ok "build SHA matches source SHA"
else
  warn "dist/RELEASE_SHA not found — build step should write it (see build-and-package.sh)"
fi

# 13. Disk space
if command -v df >/dev/null 2>&1; then
  FREE_MB="$(df -Pm . | awk 'NR==2 {print $4}')"
  if [ -n "$FREE_MB" ] && [ "$FREE_MB" -lt "$MIN_FREE_DISK_MB" ]; then
    fail "only ${FREE_MB}MB free disk, need at least ${MIN_FREE_DISK_MB}MB."
  fi
  ok "disk space (${FREE_MB}MB free)"
fi

# 14. Current health must be OK before we touch anything
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5000/api/health}"
if command -v curl >/dev/null 2>&1; then
  HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo "000")"
  if [ "$HTTP_CODE" != "200" ]; then
    fail "pre-deploy health check on $HEALTH_URL returned $HTTP_CODE, not 200 — do not deploy on top of an already-unhealthy service."
  fi
  ok "pre-deploy health check (200)"
fi

echo "PRE_DEPLOY_GUARD: ALL CHECKS PASSED"
exit 0
