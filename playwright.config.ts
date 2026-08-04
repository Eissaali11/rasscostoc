/**
 * PHASE B1.3 — Portal Test Foundation: Playwright smoke config.
 *
 * Local-only: `webServer` boots the portal's own `vite preview` against the
 * built static output on a fixed local port — never a deployed/production
 * URL. No production secrets are read here; the smoke tests themselves must
 * not depend on a real backend being reachable (see e2e/*.spec.ts, which
 * asserts on static shell content, not authenticated data).
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  // Controlled retries: 0 locally (fail fast, easy to debug), 2 in CI
  // (tolerates real infra flakiness like a slow first page load) — never
  // unbounded, never used to paper over a genuinely broken test.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Serves the already-built static output (dist/public, per the root
    // vite.config.ts's `build.outDir`) locally via a plain static server —
    // requires `npm run build:packages` (portal-relevant chunk) to have run
    // first. Never points at any remote host.
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
