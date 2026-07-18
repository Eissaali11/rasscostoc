# Known Flaky Tests

Tracked per engineering governance: a full-suite failure that only passes on
retry or in isolation must be recorded here, never hidden inside a "N/N PASS"
claim. Report initial full-suite result and any retry result separately.

---

## FLAKY-001 — multi-instance integration suite

| Field | Value |
|---|---|
| **Status** | OPEN |
| **Affected test** | `apps/api/src/core/testing/multi-instance.p4.test.ts` (2 tests: cross-instance session; concurrent job claim) |
| **Symptom** | Under full-suite load the two worker child processes occasionally exceed the worker-ready startup window; the file reports both tests failed. Passes in isolation and on retry every observed time. |
| **Approx. failure rate** | ~1 in 3–4 full-suite runs on this dev machine under concurrent load (not measured rigorously). |
| **Conditions** | Only under `npm run test:unit` full-suite load; never when the file is run alone. Root cause: each worker cold-compiles the app through `tsx` while the rest of the suite runs in parallel; startup can exceed the ready timeout. |
| **Mitigation already applied** | worker-ready timeout raised 15s → 60s and `beforeAll` 30s → 90s (commit `8f9a4b8`); reduced but did not eliminate under heavy load. |
| **Impact on ADR-002** | NO CAUSAL LINK. The ADR-002 changes do not touch this suite; it fails/passes identically before and after. Evidence: passes in isolation and after retry across ADR-001/ADR-002 commits. |
| **Owner** | Unassigned — needs a durable fix (e.g. pre-compile workers once, or a readiness handshake instead of a timeout, or serialize this file outside the parallel pool). |
| **Close criterion** | 20 consecutive green full-suite runs with no retry, OR the suite is re-architected so worker readiness is deterministic (no timeout race). |

### Governance note
Do not reuse "known flaky" as an explanation for any *new* full-suite failure
without first proving isolation (the file passes alone) and no causal link to
the change under review. Every such occurrence is re-verified, not assumed.
