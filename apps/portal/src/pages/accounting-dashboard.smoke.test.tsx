/**
 * PHASE B1.3 — Portal Test Foundation smoke test: Accounting dashboard shell.
 * Chosen deliberately: Phase B's static audit flagged /accounting as having
 * NO router-level role gate (TD-14) — this smoke test only proves the page
 * renders; it does not assert anything about access control (that belongs
 * to a dedicated security test in a later phase, not this foundation).
 */
import { describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import AccountingDashboardPage from "./accounting-dashboard";

describe("PHASE B1.3 — Accounting dashboard shell smoke", () => {
  it("renders for an authenticated admin without crashing (success state)", async () => {
    const { container } = renderWithProviders(<AccountingDashboardPage />, { authOverrides: { role: "admin" } });
    await waitFor(() => expect(container.firstChild).not.toBeNull());
  });
});
