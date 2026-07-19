import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { errorHandler } from "./errorHandler";
import { AppError, ValidationError } from "./AppError";
import { correlationMiddleware } from "@core/telemetry/telemetry";

describe("Global Error Handler Integration Tests", () => {
  it("should catch AppError and return status, message, and traceId", async () => {
    const app = express();
    app.use(correlationMiddleware);
    app.get("/error-test", (req, res, next) => {
      next(new AppError("تعذر العثور على المورد المطلوب", 404));
    });
    app.use(errorHandler);

    const res = await request(app)
      .get("/error-test")
      .set("X-Correlation-ID", "test-corr-id-123");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: "تعذر العثور على المورد المطلوب",
      traceId: "test-corr-id-123",
    });
  });

  it("should catch ValidationError and include the validation errors array along with traceId", async () => {
    const app = express();
    app.use(correlationMiddleware);
    app.get("/validation-error-test", (req, res, next) => {
      next(new ValidationError("بيانات غير صالحة", [{ field: "email", message: "البريد الإلكتروني غير صحيح" }]));
    });
    app.use(errorHandler);

    const res = await request(app)
      .get("/validation-error-test")
      .set("X-Correlation-ID", "test-validation-corr-id");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: "بيانات غير صالحة",
      traceId: "test-validation-corr-id",
      errors: [{ field: "email", message: "البريد الإلكتروني غير صحيح" }],
    });
  });

  it("should handle unexpected errors, masking details in production and exposing traceId", async () => {
    const app = express();
    app.use(correlationMiddleware);
    app.get("/unexpected-error-test", (req, res, next) => {
      next(new Error("Database connection timed out"));
    });
    app.use(errorHandler);

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const res = await request(app)
        .get("/unexpected-error-test")
        .set("X-Correlation-ID", "test-unexpected-corr-id");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Internal server error");
      expect(res.body.traceId).toBe("test-unexpected-corr-id");
      expect(res.body.stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
