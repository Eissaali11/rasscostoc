import { describe, expect, it, beforeEach, afterAll } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "@core/config/db";
import { rateLimiter } from "./security.middleware";

/**
 * ERP-008 Phase 4 -- proves the rate limiter's shared Postgres counter
 * enforces one aggregate limit under concurrent callers, the same property
 * that a real multi-process deployment needs (two OutboxWorker-style
 * processes hitting the same key must never each get their own private
 * count). The genuine cross-OS-process proof lives in
 * multi-instance.p4.test.ts; this file proves the counter's atomicity at
 * the SQL level, which is the property the cross-process test depends on.
 */
describe("ERP-008 Phase 4 — rate limiter shared counter concurrency safety", () => {
  const testIp = "203.0.113.42";

  beforeEach(async () => {
    process.env.NODE_ENV = "production";
    await db.execute(sql`DELETE FROM rate_limit_counters WHERE key = ${testIp}`);
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM rate_limit_counters WHERE key = ${testIp}`);
    process.env.NODE_ENV = "test";
  });

  function simulateRequest(ip: string): Promise<{ status: number; headers: Record<string, string> }> {
    return new Promise((resolve) => {
      const headers: Record<string, string> = {};
      let statusCode = 200;
      const req = { path: "/api/whatever", ip, socket: { remoteAddress: ip } } as unknown as Request;
      const res = {
        setHeader(name: string, value: string | number) { headers[name] = String(value); },
        status(code: number) { statusCode = code; return this; },
        json() { resolve({ status: statusCode, headers }); return this; },
      } as unknown as Response;
      const next: NextFunction = () => resolve({ status: 200, headers });

      rateLimiter(req, res, next).catch(() => resolve({ status: 500, headers }));
    });
  }

  it("40 concurrent requests from the same key never lose an increment", async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, () => simulateRequest(testIp))
    );

    // Every response carries the remaining count computed from the shared
    // counter at the moment it was incremented. Across 40 truly-serialized
    // increments the set of "X-RateLimit-Remaining" values must be 40
    // distinct numbers (149 down to 110) -- if the counter lost updates
    // under concurrency, we'd see duplicates instead.
    const remaining = results.map((r) => Number(r.headers["X-RateLimit-Remaining"]));
    expect(new Set(remaining).size).toBe(40);
    for (const r of results) {
      expect(r.status).toBe(200);
    }
  });

  it("requests beyond the window limit are rejected with 429, none silently dropped", async () => {
    const total = 160; // 10 over MAX_REQUESTS_PER_WINDOW (150)
    const results = await Promise.all(
      Array.from({ length: total }, () => simulateRequest(testIp))
    );

    const ok = results.filter((r) => r.status === 200).length;
    const blocked = results.filter((r) => r.status === 429).length;

    expect(ok).toBe(150);
    expect(blocked).toBe(10);
  });
});
