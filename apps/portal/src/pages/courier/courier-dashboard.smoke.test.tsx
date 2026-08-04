/**
 * PHASE B1.3 — Portal Test Foundation smoke test: Courier dashboard shell.
 */
import { describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import CourierDashboardPage from "./courier-dashboard";

describe("PHASE B1.3 — Courier dashboard smoke", () => {
  it("renders for an authenticated admin without crashing (success state)", async () => {
    const { container } = renderWithProviders(<CourierDashboardPage />, { authOverrides: { role: "admin" } });
    await waitFor(() => expect(container.firstChild).not.toBeNull());
  });
});
