#!/usr/bin/env bash
#
# Pre-Deploy Guard
#
# Run this from the deploy target's project directory before ANY deploy
# (manual or automated). Exits non-zero and refuses to proceed on the first
# failed check.
#
# EMERGENCY_OVERRIDE=1 can skip a small, fixed set of *process* checks:
# deployment freeze (1), official branch (2), worktree clean (3), and
# undocumented-rollback (6). It requires EMERGENCY_REASON, EMERGENCY_APPROVER,
# and EMERGENCY_INCIDENT_ID all set, plus an explicit typed confirmation
# (interactive prompt if a TTY is attached, EMERGENCY_CONFIRM=CONFIRM
# otherwise) -- missing any one of these refuses the deploy outright. It can
# NEVER skip typecheck/build/tests (7), the Zero-Storage contract (7b),
# secret scan (8), lockfile match (9), migration state (10), forbidden
# tracked paths (11/11b), the release SHA check (12), disk space (13), or
# the pre-deploy health check (14) -- none of those checks reference
# EMERGENCY_OVERRIDE at all, by design. Every use is written to both
# deploy-audit.log and a permanent, append-only emergency-override log.
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
EMERGENCY_OVERRIDE_LOG="${EMERGENCY_OVERRIDE_LOG:-/var/log/deploy-emergency-override.log}"
EMERGENCY_CONFIRM_PHRASE="CONFIRM"

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
EMERGENCY_APPROVER="${EMERGENCY_APPROVER:-}"
EMERGENCY_INCIDENT_ID="${EMERGENCY_INCIDENT_ID:-}"
EMERGENCY_CONFIRM="${EMERGENCY_CONFIRM:-}"
if [ "$EMERGENCY_OVERRIDE" = "1" ]; then
  MISSING=""
  [ -z "$EMERGENCY_REASON" ] && MISSING="$MISSING EMERGENCY_REASON"
  [ -z "$EMERGENCY_APPROVER" ] && MISSING="$MISSING EMERGENCY_APPROVER"
  [ -z "$EMERGENCY_INCIDENT_ID" ] && MISSING="$MISSING EMERGENCY_INCIDENT_ID"
  if [ -n "$MISSING" ]; then
    fail "EMERGENCY_OVERRIDE=1 set but missing required field(s):$MISSING — refusing. EMERGENCY_REASON, EMERGENCY_APPROVER, and EMERGENCY_INCIDENT_ID are all mandatory."
  fi

  if [ -t 0 ]; then
    echo "PRE_DEPLOY_GUARD: EMERGENCY OVERRIDE requested — approver=$EMERGENCY_APPROVER incident=$EMERGENCY_INCIDENT_ID reason=\"$EMERGENCY_REASON\"" >&2
    printf 'Type exactly "%s" to confirm you understand this bypasses process checks (freeze/branch/worktree/rollback-prevention only): ' "$EMERGENCY_CONFIRM_PHRASE" >&2
    read -r TYPED_CONFIRM
    if [ "$TYPED_CONFIRM" != "$EMERGENCY_CONFIRM_PHRASE" ]; then
      fail "EMERGENCY_OVERRIDE confirmation did not match — refusing."
    fi
  else
    if [ "$EMERGENCY_CONFIRM" != "$EMERGENCY_CONFIRM_PHRASE" ]; then
      fail "EMERGENCY_OVERRIDE=1 requires EMERGENCY_CONFIRM=$EMERGENCY_CONFIRM_PHRASE when running non-interactively (no TTY) — refusing."
    fi
  fi

  echo "PRE_DEPLOY_GUARD: EMERGENCY OVERRIDE ACTIVE — approver=$EMERGENCY_APPROVER incident=$EMERGENCY_INCIDENT_ID reason=\"$EMERGENCY_REASON\"" >&2
  AUDIT_LINE="$(date -u +%Y-%m-%dT%H:%M:%SZ) EMERGENCY_OVERRIDE approver=\"$EMERGENCY_APPROVER\" incident=\"$EMERGENCY_INCIDENT_ID\" reason=\"$EMERGENCY_REASON\" user=$(whoami)"
  echo "$AUDIT_LINE" >> deploy-audit.log 2>/dev/null || true
  mkdir -p "$(dirname "$EMERGENCY_OVERRIDE_LOG")" 2>/dev/null || true
  echo "$AUDIT_LINE" >> "$EMERGENCY_OVERRIDE_LOG" 2>/dev/null || true
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

if ! npx vitest run > /tmp/pre-deploy-tests.log 2>&1; then
  fail "test suite failed — see /tmp/pre-deploy-tests.log"
fi
ok "test suite"

# 7b. Zero-Storage contract gate: refuse to deploy unless the exact behavior
# this hotfix exists to guarantee is still present in THIS commit's own
# tests. This does not hit a live server — it runs the actual Express app
# in-process (supertest), so it catches a regression even if the change
# that broke it never touched these two routes directly.
ZERO_STORAGE_TEST="apps/api/src/modules/courier/presentation/routes/pdf-register-drive.hotfix.test.ts"
if [ ! -f "$ZERO_STORAGE_TEST" ]; then
  fail "$ZERO_STORAGE_TEST is missing — cannot verify /pdf/upload=410 and register-drive multipart=415 before deploy."
fi
if ! npx vitest run "$ZERO_STORAGE_TEST" > /tmp/pre-deploy-zerostorage.log 2>&1; then
  fail "Zero-Storage contract test failed — /api/courier/pdf/upload may no longer return 410, or /api/courier/pdf/register-drive may no longer reject multipart with 415. See /tmp/pre-deploy-zerostorage.log. Refusing to deploy."
fi
ok "Zero-Storage contract (upload=410, register-drive multipart=415)"

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
# Uses git's own diff (not a raw byte hash) so this is immune to line-ending
# normalization (core.autocrlf) differences between dev and deploy
# environments — a raw sha256sum comparison produced false failures on
# Windows dev machines with autocrlf=true even though the file was
# byte-for-byte what git itself considered unchanged.
if ! git diff --quiet HEAD -- package-lock.json 2>/dev/null; then
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

# 11. .env / dist / logs / runtime uploads must never be part of what gets
# shipped as source. See scripts/lib/forbidden-tracked-paths.sh for the
# exact rule (shared with its regression test so the two can't drift).
. "$(dirname "${BASH_SOURCE[0]}")/lib/forbidden-tracked-paths.sh"
FORBIDDEN_TRACKED="$(forbidden_tracked_paths)"
if [ -n "$FORBIDDEN_TRACKED" ]; then
  fail "forbidden paths are tracked in git: $(echo "$FORBIDDEN_TRACKED" | tr '\n' ' ')"
fi
ok "no forbidden paths tracked"

# 11b. Repository-wide PDF ban: no .pdf may be tracked anywhere in the repo,
# not just the known runtime uploads directories. See
# scripts/lib/forbidden-tracked-pdfs.sh for the (ideally empty, always
# written-justification-required) exception list.
. "$(dirname "${BASH_SOURCE[0]}")/lib/forbidden-tracked-pdfs.sh"
FORBIDDEN_PDFS="$(forbidden_tracked_pdfs)"
if [ -n "$FORBIDDEN_PDFS" ]; then
  fail "PDF file(s) tracked in git outside the documented exception list: $(echo "$FORBIDDEN_PDFS" | tr '\n' ' ')"
fi
ok "no undocumented PDF files tracked anywhere in the repository"

# 12. Source and build must reference the same commit SHA. Hard failure in
# all three broken states -- absence, malformed content, and mismatch are
# equally disqualifying, none of them get a silent WARN. See
# scripts/lib/release-sha-check.sh (shared with its regression test) and
# scripts/write-release-sha.cjs (the only writer, run by `npm run build`).
. "$(dirname "${BASH_SOURCE[0]}")/lib/release-sha-check.sh"
RELEASE_SHA_REASON="$(check_release_sha dist "$LOCAL_SHA")"
RELEASE_SHA_STATUS=$?
if [ "$RELEASE_SHA_STATUS" -ne 0 ]; then
  fail "release SHA check failed: $RELEASE_SHA_REASON"
fi
ok "release SHA check: $RELEASE_SHA_REASON"

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
