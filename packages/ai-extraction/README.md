# @stockpro/ai-extraction

**Latest PR:** PR-006A-6 — Technician Matching Runtime

## Status

| PR | State |
|----|--------|
| 006A-1…6 | Implemented |
| 006A-7 Review UI | **STOP** — awaiting Architecture approval |

## Matching (isolated)

```ts
import {
  TechnicianMatchingRuntime,
  createMatchingFixturePorts,
} from "@stockpro/ai-extraction";

const runtime = new TechnicianMatchingRuntime(createMatchingFixturePorts());
const { results } = await runtime.match({ device_graph });
```

Feature flag remains `enabled: false`. No Courier coupling.

Docs: [ERP-006A-pr-006a-6.md](../../docs/adr/ERP-006A-pr-006a-6.md)
