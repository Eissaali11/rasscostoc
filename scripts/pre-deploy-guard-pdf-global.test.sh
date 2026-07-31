#!/usr/bin/env bash
#
# Regression test for the Pre-Deploy Guard's repository-wide PDF ban
# (scripts/pre-deploy-guard.sh check 11b, via scripts/lib/forbidden-tracked-pdfs.sh).
#
# Unlike scripts/pre-deploy-guard-forbidden-paths.test.sh (which only covers
# the known runtime uploads directories), this proves the ban applies to a
# PDF tracked in a completely arbitrary path, not just uploads/.
#
# Proves:
#   1. The check passes on a repo with no undocumented tracked PDF.
#   2. The check fails the moment a PDF is tracked ANYWHERE, e.g. a random
#      docs/ subdirectory unrelated to any runtime uploads path.
#   3. The test removes its own dummy file afterward and leaves the
#      worktree exactly as it found it.
#
# Exit codes: 0 = all three properties hold, 1 = a property failed.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
. scripts/lib/forbidden-tracked-pdfs.sh

DUMMY="docs/__guard_global_pdf_regression_test_dummy__.pdf"

cleanup() {
  git rm --cached --quiet -- "$DUMMY" > /dev/null 2>&1 || true
  rm -f -- "$DUMMY"
}
trap cleanup EXIT

# 1. Positive case: no undocumented PDF tracked anywhere.
BEFORE="$(forbidden_tracked_pdfs)"
if [ -n "$BEFORE" ]; then
  echo "FAIL: expected 0 undocumented tracked PDFs before the test, found: $BEFORE" >&2
  exit 1
fi
echo "PASS: global PDF guard is clean (positive case)"

# 2. Negative case: track a dummy PDF in an arbitrary, non-uploads path.
mkdir -p docs
printf '%%PDF-1.4 dummy content for global guard regression test only\n' > "$DUMMY"
git add -f -- "$DUMMY"

AFTER="$(forbidden_tracked_pdfs)"
if [ "$AFTER" != "$DUMMY" ]; then
  echo "FAIL: expected guard to flag exactly '$DUMMY', got: '$AFTER'" >&2
  exit 1
fi
echo "PASS: global PDF guard flags a tracked PDF in an arbitrary path, not just uploads/ (negative case)"

# 3. Cleanup: remove the dummy file and confirm the worktree is clean again.
cleanup
trap - EXIT

DIRTY="$(git status --porcelain=v1 --untracked-files=all -- "$DUMMY")"
if [ -n "$DIRTY" ]; then
  echo "FAIL: worktree not clean after test cleanup: $DIRTY" >&2
  exit 1
fi
echo "PASS: worktree clean after test — no leftover staged or untracked files"

echo "PRE_DEPLOY_GUARD_PDF_GLOBAL_REGRESSION: ALL CHECKS PASSED"
exit 0
