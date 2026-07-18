# ADR-001 — Operational Secrets Must Not Live in Source Control

| | |
|---|---|
| **Status** | Accepted — implemented (source-side); production rotation is an operator action tracked below |
| **Date** | 2026-07-18 |
| **Severity** | P0 (credential exposure) |
| **Decision owner** | Chief Software Architect |

---

## Evidence

This architectural decision is based on the following verified evidence:

- **Repository inspection** — `git ls-files scripts` returned 191 tracked scripts; a content scan found the production SSH password literal (`password: "…"`) in **57** of them, alongside the production server IP, the `root` username, and multiple PostgreSQL connection strings carrying inline passwords (`nulip_user`, `nulipuser`, `postgres`).
- **Git history inspection** — the credentials were present at least as far back as commit `3a12a86`; they are in history, not only the working tree.
- **Command outputs** — a Node scan over every tracked file confirmed the spread and, after remediation, confirmed **0** occurrences of the SSH password, **0** occurrences of the production IP outside redacted docs, and **0** credentialed PostgreSQL URLs in source (`node scripts/secret-scan.cjs --all` → `secret-scan: clean (1445 files checked)`).
- **Security scan results** — the new `scripts/secret-scan.cjs` gate blocks a synthetic staged production credential with exit 1, and passes the clean tree.

If any evidence changes, this ADR must be re-evaluated.

---

## 1. Problem Definition

Production access credentials — a `root` SSH password to the production host, and multiple production database connection strings with inline passwords — were committed to the repository across dozens of ad-hoc operational scripts under `scripts/`. Anyone with a copy of the repository (any clone, any fork, any historical checkout) held full `root` control of the production server and its financial data.

## 2. Root Cause

The root cause is **architectural, not individual**: there was no boundary between product code (reviewed, tested) and operational tooling (which touches production), and no sanctioned mechanism for an operational script to obtain a secret. Specifically:

- `scripts/` had grown into an unsupervised collection of 191 ad-hoc tools with no ownership or review policy.
- No secret-scanning existed at any stage (no pre-commit, no CI), so a hardcoded credential met no automated resistance.
- No approved pattern existed for loading operational secrets, so copy-paste into source was the path of least resistance for every engineer.
- Production access itself lacked least-privilege: a single shared `root` password instead of per-engineer key-based access.

## 3. Architecture Decision

Enforce a strict separation into three layers, backed by an automated gate that prevents regression:

1. **Product code** — reviewed and tested; contains no secrets.
2. **Operational tooling** (`scripts/`) — obtains every secret exclusively from the environment via `scripts/ops/credentials.mjs`; contains no secret literals.
3. **Secrets** — live only in untracked `.env` / `.env.ops` files (or a real secret manager / CI vault); never touch git.

## 4. Alternatives Considered

| Alternative | Verdict |
|---|---|
| Delete the offending files only | **Rejected** — secrets remain in history and in every prior clone; false security. |
| Rewrite git history (`git filter-repo`) | **Insufficient alone** — cannot reach external clones/forks; acceptable only as a later supplementary step, never as the primary control. |
| **Rotate first, then scrub source, then gate against regression** | **Chosen** — the only option that treats the exposed credentials as already compromised (which they are), and prevents recurrence. |

## 5. Chosen Solution

**Operator track (performed by a human with production access — not automatable, and must not be automated):**
1. Rotate the production `root` SSH password and disable password login (`PermitRootLogin prohibit-password`; key auth only).
2. Rotate the production database passwords (`nulip_user`, `nulipuser`, `postgres`).
3. Review server access logs to rule out prior unauthorized use.

**Source track (implemented in this ADR):**
1. Scrubbed every secret literal from `scripts/` and from documentation, replacing them with `process.env.OPS_*` references (or `<SERVER_IP>` placeholders in docs).
2. Added `scripts/ops/credentials.mjs` (fail-closed loader) and `scripts/ops/run.mjs` (sanctioned runner that verifies every `OPS_*` credential a script needs is present before executing — `npm run ops -- <script>`), plus `.env.ops.example` and a gitignored `.env.ops`.
3. Added `scripts/secret-scan.cjs`, wired as the **first** step of `.husky/pre-commit`, blocking commits that introduce credentialed DB URLs, private keys, or hardcoded password/secret literals. Test fixtures and example templates are path-allowlisted so the gate stays high-signal.
4. Untracked build `coverage/` artifacts (they embedded copies of the same credentials) and gitignored them.

## 6. Trade-offs

- Operational scripts now require a one-time `.env.ops` setup per operator — accepted friction in exchange for closing the exposure.
- Git history is **not** rewritten by default (destructive to parallel active branches). **Rotation is the real guarantee**: once rotated, the historical credentials are worthless. History rewrite remains available as a later hygiene step.

## 7. Testing Strategy / Verification

- `node scripts/secret-scan.cjs --all` → clean over 1445 files. **VERIFIED.**
- Synthetic staged prod credential → gate exits 1. **VERIFIED.**
- `node scripts/ops/run.mjs scripts/check-and-restart.mjs` with no `.env.ops` → fails closed naming the missing `OPS_*` keys (exit 1). **VERIFIED.**
- Same, with a temporary `.env.ops` → passes the credential gate and reaches the real SSH connect (`ECONNREFUSED` against the dummy host). **VERIFIED.**
- Full unit suite unaffected (secrets were only in ops scripts, not product code). **VERIFIED via pre-commit on this ADR's commits.**

## 8. Rollback Strategy

The scrub is intentionally irreversible (restoring the secrets is never desirable). Each step is an independent commit and individually revertible without re-exposing credentials.

## 9. Production Risk

Zero runtime risk: none of the changes touch the application runtime. The only behavioral change is that operational scripts now fail closed until `.env.ops` is provided — a deliberate safety property.

## 10. Success Criteria

```
Secret occurrences in source (SSH pw / prod IP / credentialed DB URLs) = 0   ✓ VERIFIED
secret-scan gate rejects a synthetic production credential                  ✓ VERIFIED
ops script fails closed without .env.ops, runs with it                      ✓ VERIFIED
Production credential rotation completed by operator                        ☐ PENDING OPERATOR CONFIRMATION
```

The final criterion is an operator action outside source control. Until it is confirmed, the exposed credentials must be treated as compromised.

---

## Engineering Governance (established by this ADR)

- No engineer may access production directly unless explicitly authorized.
- No production credentials may exist in source control. Enforced by `scripts/secret-scan.cjs` (pre-commit now; CI in ERP-008 Phase 7, where it cannot be bypassed with `--no-verify`).
- Every architectural decision (ADR) must include: Business impact, Operational impact, Security impact, Rollback impact, Verification criteria — and an **Evidence** section; if the evidence changes, the ADR is re-evaluated.
- Every change must pass: Architecture Review, Security Review, Test Review, Production Readiness Review. No feature is merged until all four pass.
