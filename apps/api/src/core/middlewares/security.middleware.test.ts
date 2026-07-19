import { describe, it, expect, vi, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { securityHeaders, csrfProtection } from "./security.middleware";

const ORIGINAL_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
});

function runSecurityHeaders(nodeEnv: string): Record<string, string> {
  process.env.NODE_ENV = nodeEnv;
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  securityHeaders({} as Request, res, next);
  expect(next).toHaveBeenCalled();
  return headers;
}

function scriptSrc(csp: string): string {
  return csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src")) ?? "";
}

describe("securityHeaders CSP", () => {
  it("uses a strict script-src with no unsafe-inline/unsafe-eval in production", () => {
    const headers = runSecurityHeaders("production");
    const csp = headers["Content-Security-Policy"];
    expect(csp).toBeDefined();

    const directive = scriptSrc(csp);
    expect(directive).toBe("script-src 'self'");
    expect(directive).not.toContain("unsafe-inline");
    expect(directive).not.toContain("unsafe-eval");
  });

  it("includes the additional hardening directives in production", () => {
    const csp = runSecurityHeaders("production")["Content-Security-Policy"];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it("relaxes script-src for the Vite dev server in development", () => {
    const directive = scriptSrc(runSecurityHeaders("development")["Content-Security-Policy"]);
    expect(directive).toContain("unsafe-inline");
    expect(directive).toContain("unsafe-eval");
  });

  it("sets HSTS only in production", () => {
    expect(runSecurityHeaders("production")["Strict-Transport-Security"]).toBeDefined();
    expect(runSecurityHeaders("development")["Strict-Transport-Security"]).toBeUndefined();
  });
});

function runCsrf(req: Partial<Request>): { nexted: boolean; status?: number } {
  let status: number | undefined;
  const res = {
    status: (code: number) => {
      status = code;
      return { json: () => undefined };
    },
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  csrfProtection(
    { method: "POST", headers: {}, query: {}, ...req } as Request,
    res,
    next
  );
  return { nexted: (next as any).mock.calls.length > 0, status };
}

describe("csrfProtection", () => {
  it("no longer exempts ?token= query auth on mutating requests (#11)", () => {
    // With only an access cookie and a query token but no CSRF header, the
    // request must be rejected — the old ?token= bypass is removed.
    const result = runCsrf({
      method: "POST",
      query: { token: "abc" },
      headers: { cookie: "access_token=jwt" },
    });
    expect(result.nexted).toBe(false);
    expect(result.status).toBe(403);
  });

  it("still exempts Bearer-authenticated mutating requests", () => {
    const result = runCsrf({
      method: "POST",
      headers: { authorization: "Bearer jwt" },
    });
    expect(result.nexted).toBe(true);
  });

  it("allows a cookie-authenticated mutation that carries a CSRF header", () => {
    const result = runCsrf({
      method: "POST",
      headers: { cookie: "access_token=jwt", "x-requested-with": "XMLHttpRequest" },
    });
    expect(result.nexted).toBe(true);
  });

  it("rejects a cookie-authenticated mutation with no CSRF header", () => {
    const result = runCsrf({
      method: "POST",
      headers: { cookie: "access_token=jwt" },
    });
    expect(result.nexted).toBe(false);
    expect(result.status).toBe(403);
  });

  it("does not gate non-mutating (GET) requests", () => {
    const result = runCsrf({ method: "GET", headers: { cookie: "access_token=jwt" } });
    expect(result.nexted).toBe(true);
  });
});
