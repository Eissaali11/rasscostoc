import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { Request, Response } from "express";
import {
  validateExcelUploadMiddleware,
  detectExcelMagic,
  EXCEL_EXT,
  LEGACY_XLS_MESSAGE,
} from "./upload-policy";
import {
  legacyXlsBuffer,
  buildMinimalXlsx,
  LEGACY_XLS_SHA256,
  LEGACY_XLS_BYTES,
} from "@core/testing/spreadsheet-fixtures";
import crypto from "crypto";

/**
 * ADR-002 Commit 2 — the format contract is enforced at the UPLOAD BOUNDARY,
 * before any parser runs. These tests prove:
 *   - a genuine legacy .xls (BIFF8) is rejected with the specific message,
 *   - a real .xlsx passes the boundary,
 * without invoking parseRawDataWorkbook at all (the reader is unchanged in
 * this commit).
 */

let tmpDir: string;
beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "adr002-upload-"));
});
afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTmp(name: string, buf: Buffer): string {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, buf);
  return p;
}

/** Minimal Response double capturing status + JSON body. */
function fakeRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    setHeader() {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: any };
}

function runMiddleware(filePath: string) {
  const mw = validateExcelUploadMiddleware();
  const req = { file: { path: filePath, filename: path.basename(filePath) } } as unknown as Request;
  const res = fakeRes();
  let nextCalled = false;
  let nextErr: unknown = undefined;
  const next = (err?: unknown) => {
    nextCalled = true;
    nextErr = err;
  };
  const done = mw(req, res, next as any);
  return { res, get nextCalled() { return nextCalled; }, get nextErr() { return nextErr; }, done };
}

describe("ADR-002 fixture integrity (fixture governance)", () => {
  it("legacy .xls fixture matches its pinned size, magic bytes, and SHA-256", () => {
    const buf = legacyXlsBuffer();
    expect(buf.length).toBe(LEGACY_XLS_BYTES);
    expect(buf.subarray(0, 4).toString("hex").toUpperCase()).toBe("D0CF11E0");
    expect(crypto.createHash("sha256").update(buf).digest("hex")).toBe(LEGACY_XLS_SHA256);
  });
});

describe("ADR-002 format contract — upload boundary", () => {
  it("EXCEL_EXT no longer allows .xls (xlsx-only)", () => {
    expect(EXCEL_EXT.has(".xlsx")).toBe(true);
    expect(EXCEL_EXT.has(".xls")).toBe(false);
  });

  it("detectExcelMagic still identifies legacy .xls by content (for the specific message)", () => {
    const p = writeTmp("legacy.bin", legacyXlsBuffer());
    expect(detectExcelMagic(p)).toBe("xls");
  });

  it("a legacy .xls (even renamed to .xlsx) is rejected at the boundary with the legacy message", async () => {
    const p = writeTmp("renamed.xlsx", legacyXlsBuffer());
    const run = runMiddleware(p);
    await run.done;

    expect(run.nextCalled).toBe(false); // never proceeds to the parser
    expect(run.res.statusCode).toBe(400);
    expect(run.res.body?.message).toBe(LEGACY_XLS_MESSAGE);
    expect(fs.existsSync(p)).toBe(false); // rejected upload is cleaned up
  });

  it("a genuine .xlsx passes the boundary (next called, no rejection)", async () => {
    const p = writeTmp("valid.xlsx", await buildMinimalXlsx());
    const run = runMiddleware(p);
    await run.done;

    expect(run.res.body).toBeUndefined(); // no rejection payload
    expect(run.nextCalled).toBe(true);
    expect(run.nextErr).toBeUndefined();
  });
});
