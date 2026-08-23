/**
 * OPS-PERM-S0-B1-B.P1 — mandatory multipart transport proof.
 *
 * Multer's own documentation warns that a request-body field's availability
 * can depend on multipart PART ORDER relative to the file part. This test
 * exercises the REAL, unmocked production upload middleware chain used by
 * `POST /api/courier/requests/import` — `createExcelUpload()`'s real disk
 * multer instance, the real `validateExcelUploadMiddleware()` (magic-byte
 * xlsx validation), and the real `uploadErrorHandler` — via supertest,
 * sending genuine multipart/form-data with the `targetRegionId` field
 * appended BEFORE the `file` field (matching the Portal's actual
 * `FormData` construction order in courier-raw-data.tsx). Only the final
 * business-logic handler is a stub — this test proves the TRANSPORT
 * contract (multipart field → req.body.targetRegionId → route handler),
 * not the region-validation business logic itself (already covered by
 * courier-service-region-writer-contract.test.ts's mocked-repository
 * suite).
 */
import { describe, expect, it, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import {
  createExcelUpload,
  validateExcelUploadMiddleware,
  uploadErrorHandler,
} from "@core/uploads/upload-policy";

const EXCEL_TEMP_DIR = path.join(process.cwd(), "uploads", "temp-multipart-test");
const excelUpload = createExcelUpload(EXCEL_TEMP_DIR);

function buildApp(capture: { body?: any; hasFile?: boolean }) {
  const app = express();
  app.post(
    "/api/courier/requests/import",
    excelUpload.single("file"),
    validateExcelUploadMiddleware(),
    uploadErrorHandler,
    (req, res) => {
      // OPS-PERM-S0-B1-B.P1: this stub deliberately mirrors only what the
      // REAL controller.importExcel reads (req.body.targetRegionId,
      // req.file) — it never touches the database or the real service.
      capture.body = req.body;
      capture.hasFile = !!(req as any).file;
      if ((req as any).file?.path) {
        fs.unlink((req as any).file.path, () => {});
      }
      res.status(200).json({ ok: true });
    }
  );
  return app;
}

async function buildValidXlsxBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Raw");
  sheet.addRow(["إسم العميل", "INCIDENT NUMBER", "TID"]);
  sheet.addRow(["Multipart Test Customer", "INC-MP-1", "TID-MP-1"]);
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

describe("OPS-PERM-S0-B1-B.P1 — real multipart transport for targetRegionId", () => {
  afterAll(() => {
    fs.rmSync(EXCEL_TEMP_DIR, { recursive: true, force: true });
  });

  it("1. targetRegionId appended BEFORE file reaches req.body through the REAL upload middleware chain", async () => {
    const buffer = await buildValidXlsxBuffer();
    const capture: { body?: any; hasFile?: boolean } = {};
    const app = buildApp(capture);

    const res = await request(app)
      .post("/api/courier/requests/import")
      .field("targetRegionId", "region-order-test-before")
      .attach("file", buffer, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    expect(res.status).toBe(200);
    expect(capture.hasFile).toBe(true);
    expect(capture.body?.targetRegionId).toBe("region-order-test-before");
  });

  it("2. targetRegionId appended AFTER file ALSO reaches req.body (proves the chain is robust regardless of the Portal's exact ordering)", async () => {
    const buffer = await buildValidXlsxBuffer();
    const capture: { body?: any; hasFile?: boolean } = {};
    const app = buildApp(capture);

    const res = await request(app)
      .post("/api/courier/requests/import")
      .attach("file", buffer, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      .field("targetRegionId", "region-order-test-after");

    expect(res.status).toBe(200);
    expect(capture.hasFile).toBe(true);
    expect(capture.body?.targetRegionId).toBe("region-order-test-after");
  });

  it("3. missing targetRegionId leaves req.body.targetRegionId undefined — no silent default is injected by the transport layer", async () => {
    const buffer = await buildValidXlsxBuffer();
    const capture: { body?: any; hasFile?: boolean } = {};
    const app = buildApp(capture);

    const res = await request(app)
      .post("/api/courier/requests/import")
      .attach("file", buffer, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    expect(res.status).toBe(200);
    expect(capture.hasFile).toBe(true);
    expect(capture.body?.targetRegionId).toBeUndefined();
  });
});
