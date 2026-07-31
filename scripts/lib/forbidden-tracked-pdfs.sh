#!/usr/bin/env bash
#
# Shared by scripts/pre-deploy-guard.sh (global PDF check) and
# scripts/pre-deploy-guard-pdf-global.test.sh.
#
# Repository-wide rule: no .pdf file may be tracked in git, anywhere, under
# any path -- not just the known runtime uploads directories. This is the
# general form of the Zero Local Storage guarantee: a PDF committed
# *anywhere* (a docs folder, a scratch script directory, an attached-assets
# folder) still gets materialized onto disk by every future clone or
# deploy checkout, exactly like the 26 files already found and removed
# from uploads/pdf/, apps/api/uploads/pdf/, uploads/test-files/, and
# scripts/_slice1-one-device.pdf.
#
# Exceptions require a written justification right here, not just a bare
# path. Keep this list empty whenever possible -- prefer fixing the root
# cause (untrack the file, or replace it with an in-memory/temp-dir
# synthetic fixture) over adding an entry.
PDF_TRACKING_EXCEPTIONS=(
  # attached_assets/transfer_2026-01-28_cab0b9c0_1769590127519.pdf
  #   Added in commit 0776825 ("Improve PDF generation by handling
  #   non-English characters and adding IDs"). Suspected to contain real
  #   transfer-record data based on its filename pattern and commit
  #   message. Unreferenced by any functional code, script, doc, or test
  #   (confirmed via git grep) -- it is NOT required for the system or
  #   test suite to run, so this is not a "necessary file" exception.
  #   Classified SENSITIVE_TRACKED_BINARY and deliberately left tracked
  #   -- and therefore listed here -- because deciding how to handle
  #   suspected real/personal data (redact, replace, or approve
  #   untracking) is the repository owner's call, not an automated one.
  #   Remove this line the moment that decision is made either way.
  "attached_assets/transfer_2026-01-28_cab0b9c0_1769590127519.pdf"
)

forbidden_tracked_pdfs() {
  local f is_exception exception
  git ls-files -- '*.pdf' '*.PDF' | while IFS= read -r f; do
    is_exception=0
    for exception in "${PDF_TRACKING_EXCEPTIONS[@]}"; do
      if [ "$f" = "$exception" ]; then
        is_exception=1
        break
      fi
    done
    if [ "$is_exception" -eq 0 ]; then
      echo "$f"
    fi
  done
}
