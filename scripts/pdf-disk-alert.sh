#!/usr/bin/env bash
#
# PDF disk-appearance alert.
#
# Zero Local Storage means these three locations must contain zero PDF
# files at every instant, not just "eventually cleaned up". This script
# checks the current count and exits non-zero (with a loud stderr message)
# the moment any PDF file exists in a location RASSCO must never write to.
#
# Intended to run on a short interval (e.g. every 1-2 minutes via cron or a
# systemd timer) so a regression is caught within minutes, not discovered
# later. Wire its non-zero exit into whatever alerting channel exists
# (email, Slack, PagerDuty, etc.) — this script itself only logs and exits;
# it does not attempt to guess a notification channel.
#
# Usage: scripts/pdf-disk-alert.sh
# Exit codes: 0 = clean (all three locations empty), 1 = ALERT (a PDF was found)

set -uo pipefail

UPLOADS_PDF_DIR="/home/nuzum/htdocs/nuzum.fun/uploads/pdf"
UPLOADS_COURIER_PDF_DIR="/home/nuzum/htdocs/nuzum.fun/uploads/courier-pdf"
TMP_DIR="/tmp"
LOG_FILE="${PDF_ALERT_LOG:-/root/pdf-disk-alert.log}"

timestamp() { date -u +%Y-%m-%dT%H:%M:%SZ; }

count_pdfs() {
  local dir="$1"
  local depth="${2:-99}"
  [ -d "$dir" ] || { echo 0; return; }
  find "$dir" -maxdepth "$depth" -iname "*.pdf" 2>/dev/null | wc -l | tr -d ' '
}

UPLOADS_PDF_COUNT=$(count_pdfs "$UPLOADS_PDF_DIR")
COURIER_PDF_COUNT=$(count_pdfs "$UPLOADS_COURIER_PDF_DIR")
TMP_PDF_COUNT=$(count_pdfs "$TMP_DIR" 2)

TOTAL=$((UPLOADS_PDF_COUNT + COURIER_PDF_COUNT + TMP_PDF_COUNT))

if [ "$TOTAL" -gt 0 ]; then
  {
    echo "$(timestamp) ALERT: Zero-Storage violation — $TOTAL local PDF file(s) found."
    echo "  uploads/pdf=$UPLOADS_PDF_COUNT uploads/courier-pdf=$COURIER_PDF_COUNT /tmp=$TMP_PDF_COUNT"
    [ "$UPLOADS_PDF_COUNT" -gt 0 ] && find "$UPLOADS_PDF_DIR" -iname "*.pdf" 2>/dev/null
    [ "$COURIER_PDF_COUNT" -gt 0 ] && find "$UPLOADS_COURIER_PDF_DIR" -iname "*.pdf" 2>/dev/null
    [ "$TMP_PDF_COUNT" -gt 0 ] && find "$TMP_DIR" -maxdepth 2 -iname "*.pdf" 2>/dev/null
  } | tee -a "$LOG_FILE" >&2
  exit 1
fi

echo "$(timestamp) ok: 0 local PDF files (uploads/pdf, uploads/courier-pdf, /tmp)" >> "$LOG_FILE"
exit 0
