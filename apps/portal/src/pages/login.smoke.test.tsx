/**
 * PHASE B1.3 — Portal Test Foundation smoke test: Login page.
 * Proves renderWithProviders() + LanguageProvider + wouter memory router
 * work end-to-end against a real, unmodified production page.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders } from "@/test/render-with-providers";
import Login from "./login";

describe("PHASE B1.3 — Login page smoke", () => {
  it("renders the login form (success state: unauthenticated, form ready)", () => {
    renderWithProviders(<Login />, { authOverrides: { role: null as any } });
    expect(screen.getByTestId("input-username")).toBeInTheDocument();
    expect(screen.getByTestId("input-password")).toBeInTheDocument();
    expect(screen.getByTestId("button-login")).toBeInTheDocument();
  });

  it("has no detectable accessibility violations (accessibility smoke)", async () => {
    const { container } = renderWithProviders(<Login />, { authOverrides: { role: null as any } });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15000);
});
