/**
 * OPS-PERM-S0-B1-B.MR1.B1 — bulk-import authorization MUST run before
 * workbook parsing.
 *
 * Mocks excel.helper's parseRawDataWorkbook directly and proves it is never
 * invoked for a non-Admin actor, or for an Admin with a missing/invalid
 * target region — the service must reject before doing any parsing work,
 * not merely before persisting rows (which the existing
 * courier-service-region-writer-contract.test.ts suite already proves).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthorizationError, ValidationError } from "@core/errors/AppError";

const parseRawDataWorkbookMock = vi.fn();

vi.mock("./excel.helper", () => ({
  parseRawDataWorkbook: (...args: unknown[]) => parseRawDataWorkbookMock(...args),
  buildExportWorkbook: vi.fn(),
}));

import { CourierService } from "./courier.service";

function makeService() {
  const requestsRepo: any = {
    insertRequest: vi.fn(async (data: any) => ({ id: 1, ...data })),
    findRequestByTid: vi.fn(async () => null),
    findActiveRegionById: vi.fn(async (regionId: string) =>
      regionId === "active-region" ? { id: "active-region", name: "Active Region" } : null
    ),
  };
  const noop: any = {};
  const service = new CourierService(noop, requestsRepo, noop, noop, noop, noop);
  return { service, requestsRepo };
}

describe("OPS-PERM-S0-B1-B.MR1.B1 — bulk-import authorization precedes workbook parsing", () => {
  beforeEach(() => {
    parseRawDataWorkbookMock.mockClear();
    parseRawDataWorkbookMock.mockResolvedValue({ imported: [], rejected: [], totalRows: 0 });
  });

  it("A. non-Admin actor is rejected BEFORE the workbook is ever parsed", async () => {
    const { service } = makeService();
    const buffer = Buffer.from("irrelevant — parsing must not be reached");

    await expect(
      service.importRawRequests(buffer, "user-1", { role: "technician", regionId: null }, "active-region")
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(parseRawDataWorkbookMock).not.toHaveBeenCalled();
  });

  it("B. Admin missing targetRegionId is rejected BEFORE the workbook is ever parsed", async () => {
    const { service } = makeService();
    const buffer = Buffer.from("irrelevant — parsing must not be reached");

    await expect(
      service.importRawRequests(buffer, "admin-1", { role: "admin", regionId: null })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(parseRawDataWorkbookMock).not.toHaveBeenCalled();
  });

  it("C. Admin invalid/inactive targetRegionId is rejected BEFORE the workbook is ever parsed", async () => {
    const { service } = makeService();
    const buffer = Buffer.from("irrelevant — parsing must not be reached");

    await expect(
      service.importRawRequests(buffer, "admin-1", { role: "admin", regionId: null }, "does-not-exist")
    ).rejects.toBeInstanceOf(ValidationError);

    expect(parseRawDataWorkbookMock).not.toHaveBeenCalled();
  });

  it("D. Admin with a valid active region DOES reach workbook parsing — proves the check is ordering, not a total block", async () => {
    const { service } = makeService();
    const buffer = Buffer.from("irrelevant — parsing IS expected here");

    await service.importRawRequests(buffer, "admin-1", { role: "admin", regionId: null }, "active-region");

    expect(parseRawDataWorkbookMock).toHaveBeenCalledTimes(1);
    expect(parseRawDataWorkbookMock).toHaveBeenCalledWith(buffer);
  });
});
