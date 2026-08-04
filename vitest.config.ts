import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "apps/api/**/*.test.ts",
      "packages/ai-extraction/**/*.test.ts",
      "packages/ai-review-ui/**/*.test.ts",
    ],
    // Stress/lifecycle sim uses an incomplete drizzle mock; not a unit gate (see ERP-000 lint baseline spirit).
    exclude: ["**/node_modules/**", "**/e2e-stress-simulation.test.ts"],
    globals: true,
    // Phase 3 determinism fix: several integration-style tests (jobs-drain,
    // outbox-drain, and others) share real DB tables and process-wide
    // singletons (EventBus, worker poll loops) with no per-test isolation
    // beyond an ownerId/id filter. Running test FILES in parallel lets one
    // file's `beforeEach: db.delete(table)` wipe rows a concurrently-running
    // sibling file just inserted, or lets a sibling's background worker
    // claim/process this file's row first — this was the actual root cause
    // of "passes alone, fails in the full suite" flakiness, not slow
    // timers. Disabling file parallelism serializes these files instead of
    // widening every test's data scoping (a much larger change); tests
    // within a single file still run with vitest's normal concurrency.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./apps/portal/src"),
      "@shared": path.resolve(import.meta.dirname, "./packages/shared-types"),
      "@server": path.resolve(import.meta.dirname, "./apps/api/src"),
      "@core": path.resolve(import.meta.dirname, "./apps/api/src/core"),
      "@modules": path.resolve(import.meta.dirname, "./apps/api/src/modules"),
      "@stockpro/ai-extraction": path.resolve(import.meta.dirname, "./packages/ai-extraction/src/index.ts"),
      "@stockpro/ai-review-ui": path.resolve(import.meta.dirname, "./packages/ai-review-ui/src/index.ts"),
    },
  },
});
