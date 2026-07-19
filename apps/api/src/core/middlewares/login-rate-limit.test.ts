import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { loginRateLimit, recordLoginFailure, recordLoginSuccess } from "./login-rate-limit";

// Each test uses a distinct IP so the module-level attempt map stays isolated.
function reqWithIp(ip: string): Request {
  return { ip, socket: {} } as unknown as Request;
}

function runLimiter(req: Request): { nexted: boolean; status?: number } {
  let status: number | undefined;
  const res = {
    setHeader: () => undefined,
    status: (code: number) => {
      status = code;
      return { json: () => undefined };
    },
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  loginRateLimit(req, res, next);
  return { nexted: (next as any).mock.calls.length > 0, status };
}

describe("loginRateLimit", () => {
  it("allows requests below the failure threshold", () => {
    const req = reqWithIp("10.0.0.1");
    for (let i = 0; i < 9; i++) recordLoginFailure(req);
    expect(runLimiter(req)).toMatchObject({ nexted: true });
  });

  it("locks the client out after the failure threshold (10) and returns 429", () => {
    const req = reqWithIp("10.0.0.2");
    for (let i = 0; i < 10; i++) recordLoginFailure(req);
    const result = runLimiter(req);
    expect(result.nexted).toBe(false);
    expect(result.status).toBe(429);
  });

  it("a successful login clears the failure counter and unlocks", () => {
    const req = reqWithIp("10.0.0.3");
    for (let i = 0; i < 10; i++) recordLoginFailure(req);
    expect(runLimiter(req).status).toBe(429);

    recordLoginSuccess(req);
    expect(runLimiter(req)).toMatchObject({ nexted: true });
  });

  it("keeps clients isolated by IP", () => {
    const attacker = reqWithIp("10.0.0.4");
    const innocent = reqWithIp("10.0.0.5");
    for (let i = 0; i < 10; i++) recordLoginFailure(attacker);
    expect(runLimiter(attacker).status).toBe(429);
    expect(runLimiter(innocent)).toMatchObject({ nexted: true });
  });
});
