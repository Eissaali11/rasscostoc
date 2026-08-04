/**
 * PHASE B1.3 — Portal Test Foundation smoke test: Inventory (Products
 * Management) shell — chosen as the "Inventory" representative page since
 * no page is literally named "Inventory"; this is the closest primary
 * inventory-management surface (per the Phase A1 portal inventory).
 */
import { describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import ProductsManagementPage from "./products-management";

describe("PHASE B1.3 — Inventory (Products Management) shell smoke", () => {
  it("renders for an authenticated admin without crashing (success state)", async () => {
    const { container } = renderWithProviders(<ProductsManagementPage />, { authOverrides: { role: "admin" } });
    await waitFor(() => expect(container.firstChild).not.toBeNull());
  });
});
