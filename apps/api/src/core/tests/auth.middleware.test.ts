process.env.JWT_SECRET = "test-secret";
import { describe, it, expect, vi } from "vitest";
import { requireAuth } from "../middlewares/auth.middleware";
import { runWithContext, telemetryContextStore } from "@core/telemetry/telemetry";
import type { Request, Response } from "express";

describe("requireAuth Telemetry Integration Tests", () => {
  it("should populate telemetry context with userId and username on successful session auth", async () => {
    const req = {
      session: {
        user: {
          id: "test-user-id",
          username: "test-username",
          role: "ADMIN"
        }
      },
      headers: {},
      query: {}
    } as unknown as Request;

    const res = {} as Response;
    const next = vi.fn();

    // Run within a telemetry context, simulating telemetry correlationMiddleware
    await runWithContext({ traceId: "test-trace", correlationId: "test-corr" }, async () => {
      await requireAuth(req, res, next);
      
      const store = telemetryContextStore.getStore();
      expect(store?.userId).toBe("test-user-id");
      expect(store?.username).toBe("test-username");
      expect(next).toHaveBeenCalled();
    });
  });
});
