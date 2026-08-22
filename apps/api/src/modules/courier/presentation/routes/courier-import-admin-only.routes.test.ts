/**
 * OPS-PERM-S0-B1-B.MR1.B1 — POST /api/courier/requests/import is Admin-only,
 * enforced BEFORE Multer's disk upload/validation pipeline.
 *
 * Same convention as courier-global-delete-admin-only.routes.test.ts: only
 * `requireAuth` is mocked (to inject a deterministic role) — the real,
 * unmocked `requireAdmin`, `excelUpload`, `validateExcelUploadMiddleware`,
 * and real `registerCourierRoutes` are exercised via supertest with a
 * genuine multipart xlsx upload. Proves both the HTTP-level rejection AND
 * that no temporary file is left on disk for a role the server denies.
 */
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { registerCourierRoutes } from "./courier.routes";
import { errorHandler } from "../../../../core/errors/errorHandler";
import { AuthenticationError } from "@core/errors/AppError";

const NON_ADMIN_OPERATIONAL_ROLES = [
  "supervisor",
  "courier_supervisor",
  "warehouse",
  "technician",
  "viewer",
] as const;

const EXCEL_TEMP_DIR = path.join(process.cwd(), "uploads", "temp");

const { authState } = vi.hoisted(() => ({
  authState: {
    user: { id: "mr1b1-test-actor", username: "mr1b1-test-actor", role: "admin", regionId: null } as
      | { id: string; username: string; role: string; regionId: string | null }
      | null,
  },
}));

vi.mock("@core/middlewares/auth.middleware", async () => {
  const actual = await vi.importActual<typeof import("@core/middlewares/auth.middleware")>(
    "@core/middlewares/auth.middleware"
  );
  return {
    ...actual,
    requireAuth: (req: any, _res: any, next: any) => {
      if (authState.user === null) {
        next(new AuthenticationError("Session expired"));
        return;
      }
      req.user = authState.user;
      next();
    },
  };
});

async function buildXlsxBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Raw");
  sheet.addRow(["إسم العميل", "INCIDENT NUMBER", "TID"]);
  sheet.addRow(["Admin-only Test Customer", "INC-MR1B1-1", "TID-MR1B1-1"]);
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

function listTempFiles(): string[] {
  if (!fs.existsSync(EXCEL_TEMP_DIR)) return [];
  return fs.readdirSync(EXCEL_TEMP_DIR);
}

describe("OPS-PERM-S0-B1-B.MR1.B1 — bulk import Admin-only, before Multer", () => {
  let app: express.Express;

  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
    app = express();
    app.use(express.json());
    registerCourierRoutes(app);
    app.use(errorHandler);
  });

  afterAll(() => {
    authState.user = { id: "mr1b1-test-actor", username: "mr1b1-test-actor", role: "admin", regionId: null };
  });

  it.each(NON_ADMIN_OPERATIONAL_ROLES)(
    "1. authenticated %s is denied with 403 BEFORE any temp file is written to disk",
    async (role) => {
      authState.user = { id: "mr1b1-test-actor", username: "mr1b1-test-actor", role, regionId: null };
      const before = new Set(listTempFiles());
      const buffer = await buildXlsxBuffer();

      const res = await request(app)
        .post("/api/courier/requests/import")
        .attach("file", buffer, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      expect(res.status).toBe(403);
      const after = new Set(listTempFiles());
      // NON_ADMIN_CAN_CAUSE_TEMP_FILE_WRITE = false: no new file appeared.
      expect([...after].filter((f) => !before.has(f))).toEqual([]);
    }
  );

  it("2. unauthenticated request receives 401, not this containment's 403, and writes no temp file", async () => {
    const saved = authState.user;
    authState.user = null;
    try {
      const before = new Set(listTempFiles());
      const buffer = await buildXlsxBuffer();
      const res = await request(app)
        .post("/api/courier/requests/import")
        .attach("file", buffer, { filename: "test.xlsx" });
      expect(res.status).toBe(401);
      const after = new Set(listTempFiles());
      expect([...after].filter((f) => !before.has(f))).toEqual([]);
    } finally {
      authState.user = saved;
    }
  });
});
