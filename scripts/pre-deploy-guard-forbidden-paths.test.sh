#!/usr/bin/env bash
#
# Regression test for the Pre-Deploy Guard's forbidden-tracked-paths check
# (scripts/pre-deploy-guard.sh check 11, via scripts/lib/forbidden-tracked-paths.sh).
#
# Proves:
#   1. The check passes when no PDF is tracked under a runtime uploads path.
#   2. The check fails the moment a PDF is tracked under a runtime uploads path.
#   3. The test removes its own dummy file afterward and leaves the worktree
#      exactly as it found it — no leftover staged or untracked files.
#
# Exit codes: 0 = all three properties hold, 1 = a property failed.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
. scripts/lib/forbidden-tracked-paths.sh

DUMMY="uploads/pdf/__guard_regression_test_dummy__.pdf"

cleanup() {
  git rm --cached --quiet -- "$DUMMY" > /dev/null 2>&1 || true
  rm -f -- "$DUMMY"
}
trap cleanup EXIT

# 1. Positive case: clean tree, no PDF tracked under a runtime uploads path.
BEFORE="$(forbidden_tracked_paths)"
if [ -n "$BEFORE" ]; then
  echo "FAIL: expected 0 forbidden tracked paths before the test, found: $BEFORE" >&2
  exit 1
fi
echo "PASS: guard check is clean with no PDF tracked (positive case)"

# 2. Negative case: track a dummy PDF under uploads/pdf/ and confirm it's flagged.
mkdir -p uploads/pdf
printf '%%PDF-1.4 dummy content for guard regression test only\n' > "$DUMMY"
git add -f -- "$DUMMY"

AFTER="$(forbidden_tracked_paths)"
if [ "$AFTER" != "$DUMMY" ]; then
  echo "FAIL: expected guard to flag exactly '$DUMMY', got: '$AFTER'" >&2
  exit 1
fi
echo "PASS: guard check flags a tracked PDF placed in a runtime uploads path (negative case)"

# 3. Cleanup: remove the dummy file and confirm the worktree is clean again.
cleanup
trap - EXIT

DIRTY="$(git status --porcelain=v1 --untracked-files=all -- "$DUMMY")"
if [ -n "$DIRTY" ]; then
  echo "FAIL: worktree not clean after test cleanup: $DIRTY" >&2
  exit 1
fi
echo "PASS: worktree clean after test — no leftover staged or untracked files"

echo "PRE_DEPLOY_GUARD_PDF_REGRESSION: ALL CHECKS PASSED"
exit 0
