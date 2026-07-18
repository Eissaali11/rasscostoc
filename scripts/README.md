# `scripts/` — Operational & Maintenance Tooling

Governed by [ADR-001](../docs/production/ADR-001-ops-secrets.md).

## Rules (enforced)

1. **No secret literals.** Every credential (SSH, database URLs, tokens) is read
   from `process.env.OPS_*`. Hardcoding a secret here is blocked by
   `scripts/secret-scan.cjs` in pre-commit.
2. **Run production-touching scripts through the sanctioned wrapper**, which
   loads `.env.ops` and fails closed if any required credential is missing:
   ```bash
   npm run ops -- scripts/<script>.mjs
   # equivalently: node scripts/ops/run.mjs scripts/<script>.mjs
   ```
3. **Secrets live only in an untracked `.env.ops`** (copy `.env.ops.example`).
   Never commit it.

## ⚠️ Dangerous scripts

Some scripts here connect to the **production** host over SSH and **mutate
production data directly** (names containing `complete-`, `deduct`, `fix-`,
`diag-save`, `delete-`, `deploy-apply`). These bypass the application's domain
logic, validation, and audit trail. They exist as historical one-off incident
tools. Treat them as break-glass only: read the script fully, confirm the
target via `.env.ops`, and prefer an application-level path where one exists.

## Documented tech debt (ADR-001 follow-up)

This directory holds 191 tracked scripts accumulated ad-hoc with no ownership
policy — the root cause behind ADR-001's credential exposure. A deliberate
consolidation (archive genuine one-offs to `scripts/archive/`, keep a small set
of maintained tools) is **deferred** rather than done under the security-incident
scope, to avoid a large breakage-prone move. Tracked as follow-up; not a
security blocker now that secrets are removed and the pre-commit gate prevents
new ones.
