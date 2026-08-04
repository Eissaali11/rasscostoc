/**
 * PHASE B1.3 — Portal Test Foundation: the single entrypoint for rendering
 * a page under test with every provider it actually depends on in
 * production (react-query, wouter, AuthContext) — real providers wired to
 * test doubles, not shallow rendering without them.
 */
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { render } from "@testing-library/react";
import { AuthContext, type AuthContextType } from "@/lib/auth";
import { LanguageProvider } from "@/i18n/provider";
import { createRoleFixture, type TestRole } from "./fixtures";

/** A react-query QueryClient configured for tests: no retries, no caching noise. */
export function mockQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface MockAuthOverrides extends Partial<AuthContextType> {
  role?: TestRole;
}

/** A fake AuthContextType value — bypasses the real login/session flow entirely. */
export function mockAuthProvider(overrides: MockAuthOverrides = {}): AuthContextType {
  const { role = "admin", ...rest } = overrides;
  return {
    user: role === null ? null : createRoleFixture(role),
    isAuthenticated: role !== null,
    isLoading: false,
    login: async () => ({ success: true, user: createRoleFixture(role), token: "test-token", refreshToken: "test-refresh" } as any),
    logout: async () => {},
    ...rest,
  };
}

/** wouter's in-memory location source — no real browser History API involved. */
export function mockRouter(initialPath: string = "/") {
  return memoryLocation({ path: initialPath, static: false });
}

export interface RenderWithProvidersOptions {
  route?: string;
  authOverrides?: MockAuthOverrides;
  queryClient?: QueryClient;
}

/** Renders `ui` wrapped in QueryClientProvider + wouter Router (memory location) + AuthContext.Provider. */
export function renderWithProviders(
  ui: ReactElement,
  { route = "/", authOverrides = {}, queryClient = mockQueryClient() }: RenderWithProvidersOptions = {}
) {
  const { hook } = mockRouter(route);
  const authValue = mockAuthProvider(authOverrides);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <Router hook={hook}>
            <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
          </Router>
        </LanguageProvider>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper }), queryClient };
}
