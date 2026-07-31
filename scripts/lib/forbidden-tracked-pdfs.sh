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
# path. This list is empty and should stay that way -- prefer fixing the
# root cause (untrack the file, or replace it with an in-memory/temp-dir
# synthetic fixture) over adding an entry. The last entry
# (attached_assets/transfer_2026-01-28_cab0b9c0_1769590127519.pdf,
# SENSITIVE_TRACKED_BINARY) was untracked outright rather than kept as a
# permanent exception -- see commit history for the decision.
PDF_TRACKING_EXCEPTIONS=()

forbidden_tracked_pdfs() {
  local f is_exception exception
  git ls-files -- '*.pdf' '*.PDF' | while IFS= read -r f; do
    is_exception=0
    for exception in "${PDF_TRACKING_EXCEPTIONS[@]:-}"; do
      if [ -n "$exception" ] && [ "$f" = "$exception" ]; then
        is_exception=1
        break
      fi
    done
    if [ "$is_exception" -eq 0 ]; then
      echo "$f"
    fi
  done
}
