/**
 * PHASE B1.3 — Portal Test Foundation setup file.
 *
 * Wired via vitest.config.ts `test.setupFiles`. IMPORTANT: vitest's
 * `setupFiles` is a single global list applied to EVERY test file in the
 * project, not just apps/portal — there is no per-directory setupFiles
 * option in a single (non-workspace) config. Registering MSW's server
 * globally broke the backend's HTTP-layer tests (supertest's real loopback
 * requests got intercepted and rejected by MSW's onUnhandledRequest:"error"),
 * caught by the required regression check before this phase's commit.
 *
 * Fix: guard the entire body on `typeof window !== "undefined"` — only true
 * in the jsdom environment (portal tests, via environmentMatchGlobs), never
 * true in the "node" environment apps/api tests run under. This file is a
 * true no-op for every non-portal test.
 */
import { afterAll, afterEach, beforeAll, expect, vi } from "vitest";

async function setupPortalTestEnvironment() {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  const { toHaveNoViolations } = await import("jest-axe");
  const { mockApiServer } = await import("./mock-api-server");

  // jest-dom (toBeInTheDocument, toHaveTextContent, ...) registered via the
  // /vitest subpath import above. jest-axe's toHaveNoViolations is
  // registered separately since it has no dedicated vitest entrypoint.
  expect.extend(toHaveNoViolations);

  // jsdom does not implement ResizeObserver (used by recharts'
  // ResponsiveContainer and several Radix components). A no-op stub is
  // standard practice for component tests in a jsdom environment — this
  // affects rendering measurement only, not any assertion this foundation
  // makes.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);

  // Fails loudly (onUnhandledRequest: "error") rather than silently falling
  // through to a real network call if a test forgets to mock an endpoint
  // the component under test actually calls — the whole point of this
  // foundation is that no portal test ever reaches a real API.
  beforeAll(() => mockApiServer.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    mockApiServer.resetHandlers();
    cleanup();
  });
  afterAll(() => mockApiServer.close());
}

if (typeof window !== "undefined") {
  await setupPortalTestEnvironment();
}
