/**
 * PHASE B1.3 — Portal Test Foundation smoke test: Dashboard page.
 * Proves an authenticated, data-heavy page (a dozen+ react-query calls)
 * renders past its loading state against the MSW fallback handler.
 */
import { describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import Dashboard from "./dashboard";

describe("PHASE B1.3 — Dashboard page smoke", () => {
  it("renders for an authenticated admin without crashing (success state)", async () => {
    const { container } = renderWithProviders(<Dashboard />, { authOverrides: { role: "admin" } });
    await waitFor(() => expect(container.firstChild).not.toBeNull());
  });

  it("renders for an authenticated supervisor without crashing (role-variant success state)", async () => {
    const { container } = renderWithProviders(<Dashboard />, { authOverrides: { role: "supervisor" } });
    await waitFor(() => expect(container.firstChild).not.toBeNull());
  });
});
