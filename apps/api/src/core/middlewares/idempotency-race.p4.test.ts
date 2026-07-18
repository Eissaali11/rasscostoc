import { describe, expect, it, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { db } from "@core/config/db";
import { idempotencyKeys } from "@shared/schema";
import { idempotency } from "./idempotency.middleware";

/**
 * ERP-008 Phase 4 — proves the idempotency middleware no longer lets a
 * concurrent duplicate request through. Before this phase, two concurrent
 * requests with the same key both reached next() because the second
 * lock-insert's unique_violation (23505) was swallowed by a generic
 * catch-all — proven via a real concurrency repro where the "sensitive
 * operation" executed twice. Real DB, real middleware, no mocks.
 */
describe("ERP-008 Phase 4 — idempotency middleware concurrency safety", () => {
  beforeEach(async () => {
    await db.delete(idempotencyKeys);
  });

  function simulateRequest(key: string, executionCounter: { count: number }): Promise<{ status: number; body: any }> {
    return new Promise((resolve) => {
      let statusCode = 200;
      const req = { method: "POST", headers: { "x-idempotency-key": key } } as unknown as Request;

      const res = {
        status(code: number) { statusCode = code; return this; },
        json(body: any) { resolve({ status: statusCode, body }); return this; },
        send(body: any) { resolve({ status: statusCode, body }); return this; },
        setHeader() {},
        statusCode: 200,
      } as unknown as Response;

      const next: NextFunction = async () => {
        executionCounter.count++;
        await new Promise((r) => setTimeout(r, 50));
        res.status(200);
        (res as any).send({ result: "created", executionNumber: executionCounter.count });
      };

      idempotency(req, res, next).catch((e) => resolve({ status: 500, body: { error: e.message } }));
    });
  }

  it("only one of two concurrent requests with the same key executes the sensitive operation", async () => {
    const key = "p4-race-test-key-" + Date.now();
    const executionCounter = { count: 0 };

    const [r1, r2] = await Promise.all([
      simulateRequest(key, executionCounter),
      simulateRequest(key, executionCounter),
    ]);

    // The real correctness criterion: exactly one execution. Which of the
    // two responses is a 409 (raced during the pending-lock window) vs a
    // 200-with-_idempotent (arrived after the first already completed) is
    // timing-dependent — under real system load the second request can
    // land either way, and both are correct idempotent outcomes.
    expect(executionCounter.count).toBe(1);

    for (const r of [r1, r2]) {
      expect([200, 409]).toContain(r.status);
    }
    const liveResponses = [r1, r2].filter((r) => r.status === 200 && !r.body?._idempotent);
    expect(liveResponses).toHaveLength(1);
  });

  it("10 concurrent requests with the same key execute the operation exactly once", async () => {
    const key = "p4-race-test-key-burst-" + Date.now();
    const executionCounter = { count: 0 };

    const results = await Promise.all(
      Array.from({ length: 10 }, () => simulateRequest(key, executionCounter))
    );

    // The correctness criterion is that the sensitive operation itself only
    // ever ran once. Every response must be either a 409 (arrived while the
    // first request was still mid-flight) or a 200 carrying the *cached*
    // result of that single execution (arrived after it completed) — never
    // a fresh, independently-executed 200.
    expect(executionCounter.count).toBe(1);

    for (const r of results) {
      if (r.status === 409) continue;
      expect(r.status).toBe(200);
      expect(r.body.executionNumber).toBe(1);
    }
    const cachedReplays = results.filter((r) => r.status === 200 && r.body._idempotent === true).length;
    const liveResponse = results.filter((r) => r.status === 200 && !r.body._idempotent).length;
    const conflicts = results.filter((r) => r.status === 409).length;
    expect(liveResponse).toBe(1);
    expect(cachedReplays + conflicts).toBe(9);
  });
});
