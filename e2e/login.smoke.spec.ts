/**
 * PHASE B1.3 — Playwright smoke test.
 * Asserts only on static shell content that renders without a real backend
 * (the login form itself) — this is infrastructure verification (does the
 * built app boot in a real browser at all), not functional E2E coverage.
 * Full authenticated E2E flows belong to a later phase.
 */
import { test, expect } from "@playwright/test";

test("login page boots and renders its form in a real browser", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByTestId("input-username")).toBeVisible();
  await expect(page.getByTestId("input-password")).toBeVisible();
  await expect(page.getByTestId("button-login")).toBeVisible();
});
