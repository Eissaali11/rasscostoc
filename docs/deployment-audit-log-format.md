# Deployment audit log format

Every deploy (success, failure, or rollback) appends **one line** to `deploy-audit.log` in the production directory. Never rotate this file away silently — archive, don't delete.

## Format (pipe-delimited, one entry per line)

```
<timestamp_riyadh_iso8601>|BUILD_ID=<id>|COMMIT=<sha>|EXECUTOR=<who-or-what>|PORT=<port>|CHECKS=<pass/fail-summary>|PREVIOUS_RELEASE=<id-or-path>|ROLLBACK=<none|automatic|manual:reason>|RESULT=<SUCCESS|FAILED>
```

Example (illustrative — not a real deploy):
```
2026-07-30T22:45:12+03:00|BUILD_ID=5de8ba33-20260730T1937Z|COMMIT=5de8ba33e287e80ee75c8e42c3ec9435513a56c2|EXECUTOR=manual:eissa|PORT=5000|CHECKS=guard=pass,build=pass,typecheck=pass,tests=pass,smoke=pass|PREVIOUS_RELEASE=d2879e68-20260722T1516Z|ROLLBACK=none|RESULT=SUCCESS
```

## Fields

| Field | Meaning |
|---|---|
| timestamp | Asia/Riyadh (+03:00), ISO 8601, not UTC — this is what the team reads |
| BUILD_ID | matches the `releases/<BUILD_ID>` directory name and the artifact's `release-manifest.json` |
| COMMIT | full 40-char SHA, must match `dist/RELEASE_SHA` inside that release |
| EXECUTOR | `manual:<username>` or `automated:<pipeline-name>` — never blank |
| PORT | the port the release actually served on for its preflight check |
| CHECKS | short pass/fail summary per guard/smoke-test stage, not full logs (those live in `/tmp/pre-deploy-*.log` and are not retained long-term) |
| PREVIOUS_RELEASE | what `current` pointed to before this deploy — required for manual rollback reference |
| ROLLBACK | `none`, `automatic` (triggered by failed post-deploy health check), or `manual:<reason>` |
| RESULT | `SUCCESS` or `FAILED` |

## What this log never contains

Secrets, `.env` contents, database connection strings (even masked), user data, or session tokens. If a field would require a secret to be meaningful, it's omitted, not redacted-in-place — redaction patterns in logs are themselves a leak risk if the redaction regex is ever wrong.

## Where it's read from

`scripts/atomic-deploy.sh` appends automatically. Manual emergency deploys (using `EMERGENCY_OVERRIDE=1` in the guard) must append a line by hand before finishing — the guard script already writes the override reason to this same file when triggered, but the deploy's own outcome line is separate and still required.
