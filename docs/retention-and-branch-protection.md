# Old-version retention policy

- Keep the **current** live release.
- Keep exactly **one previous release** on disk under `releases/` for emergency rollback (`atomic-deploy.sh` already does this automatically — it never deletes the previous target of `current`).
- Keep every `production-stable-*` **git tag** forever — tags are cheap (a few hundred bytes each) and are the only fully trustworthy point-in-time reference once a release directory is eventually pruned.
- Delete `releases/<BUILD_ID>` directories older than the current + previous **only** on a time policy (e.g. 30 days) applied by a separate, explicit cleanup script — never inline inside the deploy script itself, and never as a side effect of a deploy.
- **Never** delete: git history, any tag matching `production-stable-*` or `archive/*`, database backups, or any branch carrying unique unmerged commits (this session's audit already identified several — see the branch/worktree inventory from the earlier cleanup report; none of those decisions are superseded by this release-engineering pass).

# GitHub branch protection for `main` — manual steps required

This session has no GitHub API token or `gh` CLI available (confirmed: an unauthenticated `PUT .../branches/main/protection` returns `401`). **Branch protection has NOT been applied.** Apply it manually:

1. GitHub → repo `Eissaali11/rasscostoc` → **Settings → Branches → Add branch protection rule**.
2. Branch name pattern: `main`.
3. Enable:
   - ✅ Require a pull request before merging (require approvals: at least 1, if a second reviewer exists; 0 is acceptable solo but document that explicitly as a conscious choice, not an oversight)
   - ✅ Require status checks to pass before merging — add the CI checks once wired (build, typecheck, `test:unit`, `node scripts/secret-scan.cjs`)
   - ✅ Require branches to be up to date before merging
   - ✅ Do not allow bypassing the above settings (or restrict to specific people only if an emergency-bypass role is needed)
   - ✅ Restrict deletions
   - ✅ Block force pushes
4. Save.
5. Separately: the `release/reconcile-production-2026-07-30` and `erp-008/phase-2-financial-integrity` branches should **not** be deploy targets directly — only `main` is. Document this as team policy even though it can't be technically enforced by branch protection alone (that only governs merges into a branch, not which branch a deploy script reads from — the actual enforcement is `OFFICIAL_BRANCH=main` inside `pre-deploy-guard.sh`).

If/when a `gh auth login` or a fine-grained PAT with `administration:write` becomes available in this environment, this file's steps 1–4 can be re-attempted via `gh api -X PUT repos/Eissaali11/rasscostoc/branches/main/protection ...` — do not claim they were applied until that call returns `200`.
