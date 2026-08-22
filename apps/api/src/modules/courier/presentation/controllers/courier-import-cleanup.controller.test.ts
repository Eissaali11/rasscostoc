/**
 * OPS-PERM-S0-B1-B.MR1.B1 / MR1.B1.R1 / MR1.B1.R2 — failure-safe
 * temporary-upload cleanup, performed BEFORE business execution.
 *
 * Exercises the REAL CourierController.importExcel handler directly (not a
 * route/HTTP layer). The temp file is read, then removed, BEFORE
 * service.importRawRequests() is ever called — so a pre-cleanup failure
 * (tests 5-6) must block the service entirely, never allowing a business
 * mutation to occur behind an ambiguous-looking failure response (the
 * exact non-idempotent-POST ambiguity RFC 9110 warns about). Tests 1-4
 * prove normal real-file cleanup for the success path and for each error
 * type the SERVICE itself can still throw (which happens strictly after
 * cleanup already occurred).
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { CourierController } from "./courier.controller";
import { AuthorizationError, ValidationError } from "@core/errors/AppError";

/** asyncHandler wraps the real handler in `.catch(next)` without awaiting
 * it internally — this lets the test await actual completion, resolving
 * on WHICHEVER happens first: a successful res.json(...) call, or an
 * error reaching next(err). No fixed sleep, no reimplementing asyncHandler. */
function makeReqRes(filePath: string, targetRegionId?: string) {
  let resolve!: (result: { jsonBody?: unknown; error?: unknown }) => void;
  const done = new Promise<{ jsonBody?: unknown; error?: unknown }>((r) => (resolve = r));

  const req = {
    user: { id: "u1", username: "u1", role: "admin", regionId: null },
    file: { path: filePath },
    body: targetRegionId !== undefined ? { targetRegionId } : {},
  } as any;
  const res = { json: (body: unknown) => resolve({ jsonBody: body }) } as any;
  const next = (err?: unknown) => resolve({ error: err });

  return { req, res, next, done };
}

describe("OPS-PERM-S0-B1-B.MR1.B1.R2 — importExcel removes the temp file BEFORE calling the service", () => {
  const createdFiles: string[] = [];

  afterEach(() => {
    for (const f of createdFiles.splice(0)) {
      try {
        fs.unlinkSync(f);
      } catch {
        // already removed by the code under test — that's the expected/success case
      }
    }
  });

  function newTempFile(): string {
    const p = path.join(os.tmpdir(), `mr1b1r2-cleanup-test-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
    fs.writeFileSync(p, "not a real xlsx, cleanup test only");
    createdFiles.push(p);
    return p;
  }

  it("1. temp file is removed and a SUCCESSFUL import returns the service's result", async () => {
    const filePath = newTempFile();
    const fakeService = { importRawRequests: vi.fn(async () => ({ importedCount: 1 })) };
    const controller = new CourierController(fakeService as any);
    const { req, res, next, done } = makeReqRes(filePath, "active-region");

    controller.importExcel(req, res, next);
    const result = await done;

    expect(result.jsonBody).toEqual({ importedCount: 1 });
    expect(fs.existsSync(filePath)).toBe(false);
    expect(fakeService.importRawRequests).toHaveBeenCalledTimes(1);
  });

  it("2. temp file is already removed (before the service ran) when the service throws AuthorizationError", async () => {
    const filePath = newTempFile();
    const fakeService = {
      importRawRequests: vi.fn(async () => {
        // Prove the file is ALREADY gone by the time the service runs.
        expect(fs.existsSync(filePath)).toBe(false);
        throw new AuthorizationError("Only Admin may perform a bulk import of courier requests");
      }),
    };
    const controller = new CourierController(fakeService as any);
    const { req, res, next, done } = makeReqRes(filePath, "active-region");

    controller.importExcel(req, res, next);
    const result = await done;

    expect(result.error).toBeInstanceOf(AuthorizationError);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("3. temp file is already removed when the service throws ValidationError (region rejection)", async () => {
    const filePath = newTempFile();
    const fakeService = {
      importRawRequests: vi.fn(async () => {
        expect(fs.existsSync(filePath)).toBe(false);
        throw new ValidationError("targetRegionId is required for every bulk import batch");
      }),
    };
    const controller = new CourierController(fakeService as any);
    const { req, res, next, done } = makeReqRes(filePath, undefined);

    controller.importExcel(req, res, next);
    const result = await done;

    expect(result.error).toBeInstanceOf(ValidationError);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("4. temp file is already removed when the service throws an unexpected/unrelated error (e.g. parser/persistence failure)", async () => {
    const filePath = newTempFile();
    const fakeService = {
      importRawRequests: vi.fn(async () => {
        expect(fs.existsSync(filePath)).toBe(false);
        throw new Error("simulated unexpected parser/persistence failure");
      }),
    };
    const controller = new CourierController(fakeService as any);
    const { req, res, next, done } = makeReqRes(filePath, "active-region");

    controller.importExcel(req, res, next);
    const result = await done;

    expect(result.error).toBeInstanceOf(Error);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("5. SERVICE_CALLED_WHEN_PRECLEANUP_FAILS=false: a pre-service cleanup failure blocks the service entirely — no business mutation, no false success", async () => {
    const filePath = newTempFile();
    const fakeService = { importRawRequests: vi.fn(async () => ({ importedCount: 1 })) };
    const controller = new CourierController(fakeService as any);
    const { req, res, next, done } = makeReqRes(filePath, "active-region");

    const cleanupError = Object.assign(new Error("simulated EBUSY during pre-service cleanup"), { code: "EBUSY" });
    const unlinkSpy = vi.spyOn(fs, "unlinkSync").mockImplementation(() => {
      throw cleanupError;
    });
    try {
      controller.importExcel(req, res, next);
      const result = await done;

      // The service was NEVER invoked — no business mutation could have occurred.
      expect(fakeService.importRawRequests).not.toHaveBeenCalled();
      // No success body was ever produced.
      expect(result.jsonBody).toBeUndefined();
      // The cleanup failure itself is what propagates.
      expect(result.error).toBe(cleanupError);
    } finally {
      unlinkSpy.mockRestore();
    }
  });

  it("6. READ_ERROR remains the primary propagated error even when the subsequent cleanup attempt also fails; service is never called", async () => {
    const filePath = newTempFile();
    const fakeService = { importRawRequests: vi.fn(async () => ({ importedCount: 1 })) };
    const controller = new CourierController(fakeService as any);
    const { req, res, next, done } = makeReqRes(filePath, "active-region");

    const readError = Object.assign(new Error("simulated read failure"), { code: "EIO" });
    const cleanupError = Object.assign(new Error("simulated distinct cleanup failure"), { code: "EACCES" });
    const readSpy = vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw readError;
    });
    const unlinkSpy = vi.spyOn(fs, "unlinkSync").mockImplementation(() => {
      throw cleanupError;
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      controller.importExcel(req, res, next);
      const result = await done;

      // The READ error is what propagates — not the distinct cleanup error.
      expect(result.error).toBe(readError);
      expect(result.error).not.toBe(cleanupError);
      // Cleanup was attempted despite the read failure.
      expect(unlinkSpy).toHaveBeenCalledWith(filePath);
      // The cleanup failure is still observable (logged), not silently ignored.
      expect(consoleSpy).toHaveBeenCalled();
      // Service is never reached when the read itself already failed.
      expect(fakeService.importRawRequests).not.toHaveBeenCalled();
    } finally {
      readSpy.mockRestore();
      unlinkSpy.mockRestore();
      consoleSpy.mockRestore();
    }
  });
});
