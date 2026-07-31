#!/usr/bin/env bash
#
# Shared by scripts/pre-deploy-guard.sh (check 11) and
# scripts/pre-deploy-guard-forbidden-paths.test.sh.
#
# Prints any git-tracked path that must never ship as source: .env files
# (except *.example templates, which are intentional), dist/, logs/, and
# runtime uploads/ directories — excluding source code that happens to
# live under a path segment literally named "uploads" (e.g. an
# upload-policy module under src/).
forbidden_tracked_paths() {
  git ls-files \
    | grep -E '^\.env$|^\.env\.[^/]*$|(^|/)dist/|(^|/)logs/|(^|/)uploads/' \
    | grep -vE '\.example$' \
    | grep -vE '(^|/)src/' \
    || true
}
