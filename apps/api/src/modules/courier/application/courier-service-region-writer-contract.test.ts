// OPS-PERM-S0-B1-B.I1 / D2.OWNER / D2.OWNER.R1 — server-side
// region-assignment contract negative security suite, per the FROZEN owner
// decision (final correction in D2.OWNER.R1):
//   - single create: admin ONLY (mandatory, server-validated targetRegionId).
//     Supervisor does NOT create courier requests — a valid regional
//     session does not grant creation authority.
//   - bulk import: admin ONLY, mandatory targetRegionId per batch.
//   - every other role (supervisor / courier_supervisor / warehouse /
//     technician / viewer) is denied outright at both create and import.
// Pure mocked-repository unit tests (no DB required): these exercise
// CourierService.createRequest / importRawRequests / updateRequest directly.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CourierService } from "./courier.service";
import { AuthorizationError, ValidationError } from "@core/errors/AppError";

function makeRepoMocks() {
  const requestsRepo: any = {
    insertRequest: vi.fn(async (data: any) => ({ id: 1, ...data })),
    insertRequestBulk: vi.fn(async (rows: any[]) => rows.map((r, i) => ({ id: i + 1, ...r }))),
    updateRequest: vi.fn(async (_id: number, data: any) => ({ id: _id, version: 2, ...data })),
    findRequestById: vi.fn(async () => ({ id: 1, version: 1 })),
    findRequestByTid: vi.fn(async () => null),
    findRequestWithDetails: vi.fn(async (id: number) => ({ id, version: 1 })),
    findActiveRegionById: vi.fn(async (regionId: string) => {
      if (regionId === "active-region") return { id: "active-region", name: "Active Region" };
      return null; // inactive/nonexistent
    }),
  };
  const dashboardRepo: any = { insertAuditLog: vi.fn(async () => undefined) };
  const noop: any = {};
  const service = new CourierService(noop, requestsRepo, noop, noop, dashboardRepo, noop);
  return { service, requestsRepo, dashboardRepo };
}

// OPS-PERM-S0-B1-B.D2.OWNER.R1: every non-admin role is denied CREATE and
// IMPORT outright. "supervisor" is included here on purpose — this is the
// corrected contract (a Supervisor-success branch existed in an earlier
// draft and was removed entirely by owner decision).
const NOT_AUTHORIZED_ROLES = ["supervisor", "courier_supervisor", "warehouse", "technician", "viewer"];

describe("OPS-PERM-S0-B1-B.D2.OWNER.R1 — single-create authorization contract (admin ONLY)", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(NOT_AUTHORIZED_ROLES)(
    "1. role=%s is denied outright at create — no request is ever inserted",
    async (role) => {
      const { service, requestsRepo } = makeRepoMocks();
      await expect(
        service.createRequest({ customerName: "x" }, "user-1", { role, regionId: null })
      ).rejects.toBeInstanceOf(AuthorizationError);
      expect(requestsRepo.insertRequest).not.toHaveBeenCalled();
    }
  );

  it("2. Supervisor with a VALID regional session is still denied — region validity never grants creation authority", async () => {
    const { service, requestsRepo } = makeRepoMocks();
    await expect(
      service.createRequest({ customerName: "x" }, "user-1", { role: "supervisor", regionId: "active-region" })
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(requestsRepo.insertRequest).not.toHaveBeenCalled();
    // proves the region lookup is never even reached for this role
    expect(requestsRepo.findActiveRegionById).not.toHaveBeenCalled();
  });

  it("3. courier_supervisor is NOT treated as Regional Supervisor even with a valid session regionId", async () => {
    const { service, requestsRepo } = makeRepoMocks();
    await expect(
      service.createRequest({ customerName: "x" }, "user-1", { role: "courier_supervisor", regionId: "active-region" })
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(requestsRepo.insertRequest).not.toHaveBeenCalled();
  });

  it("4. client-supplied regionId/targetRegionId in the body cannot bypass denial for a not-authorized role", async () => {
    const { service, requestsRepo } = makeRepoMocks();
    await expect(
      service.createRequest(
        { customerName: "x", regionId: "active-region", targetRegionId: "active-region" },
        "user-1",
        { role: "supervisor", regionId: "active-region" }
      )
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(requestsRepo.insertRequest).not.toHaveBeenCalled();
  });
});

describe("OPS-PERM-S0-B1-B.D2.OWNER.R1 — Admin single-create (targetRegionId mandatory)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("5. Admin explicit valid targetRegionId is accepted and persisted", async () => {
    const { service, requestsRepo } = makeRepoMocks();
    await service.createRequest(
      { customerName: "x", targetRegionId: "active-region" },
      "admin-1",
      { role: "admin", regionId: null }
    );
    const insertedArg = requestsRepo.insertRequest.mock.calls[0][0];
    expect(insertedArg.regionId).toBe("active-region");
  });

  it("6. Admin invalid/inactive targetRegionId is rejected", async () => {
    const { service } = makeRepoMocks();
    await expect(
      service.createRequest(
        { customerName: "x", targetRegionId: "does-not-exist" },
        "admin-1",
        { role: "admin", regionId: null }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("7. Admin OMITTING targetRegionId is rejected — mandatory, no NULL fallback", async () => {
    const { service, requestsRepo } = makeRepoMocks();
    await expect(
      service.createRequest({ customerName: "x" }, "admin-1", { role: "admin", regionId: null })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(requestsRepo.insertRequest).not.toHaveBeenCalled();
  });
});

describe("OPS-PERM-S0-B1-B.I1 — region-assignment contract (updateRequest immutability)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("8. updateRequest strips client-supplied regionId before reaching the repository", async () => {
    const { service, requestsRepo } = makeRepoMocks();
    await service.updateRequest(1, { customerName: "y", version: 1, regionId: "ATTACKER_REGION" }, "user-1");
    const updateFieldsArg = requestsRepo.updateRequest.mock.calls[0][1];
    expect(updateFieldsArg.regionId).toBeUndefined();
    expect(updateFieldsArg.customerName).toBe("y");
  });

  it("9. updateRequest strips client-supplied region_id (snake_case) before reaching the repository", async () => {
    const { service, requestsRepo } = makeRepoMocks();
    await service.updateRequest(1, { customerName: "y", version: 1, region_id: "ATTACKER_REGION" }, "user-1");
    const updateFieldsArg = requestsRepo.updateRequest.mock.calls[0][1];
    expect(updateFieldsArg.region_id).toBeUndefined();
  });
});

describe("OPS-PERM-S0-B1-B.D2.OWNER.R1 — bulk-import contract (Admin-only, mandatory region)", () => {
  beforeEach(() => vi.clearAllMocks());

  async function buildWorkbook(rows: string[][]) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Raw");
    for (const row of rows) sheet.addRow(row);
    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  it("10. bulk import cannot take region from spreadsheet rows — no 'region' column is ever consulted", async () => {
    const { service, requestsRepo } = makeRepoMocks();
    const buffer = await buildWorkbook([
      ["إسم العميل", "INCIDENT NUMBER", "TID"],
      ["Excel Customer", "INC-REGION-1", "TID-REGION-1"],
    ]);
    await service.importRawRequests(buffer, "admin-1", { role: "admin", regionId: null }, "active-region");
    if (requestsRepo.insertRequest.mock.calls.length > 0) {
      const insertedArg = requestsRepo.insertRequest.mock.calls[0][0];
      expect(insertedArg.regionId).toBe("active-region");
    }
  });

  it.each(NOT_AUTHORIZED_ROLES)(
    "11. role=%s is denied bulk import entirely, even with a targetRegionId supplied",
    async (role) => {
      const { service, requestsRepo } = makeRepoMocks();
      const buffer = await buildWorkbook([
        ["إسم العميل", "INCIDENT NUMBER", "TID"],
        ["Excel Customer", "INC-REGION-2", "TID-REGION-2"],
      ]);
      await expect(
        service.importRawRequests(buffer, "user-1", { role, regionId: "active-region" }, "active-region")
      ).rejects.toBeInstanceOf(AuthorizationError);
      expect(requestsRepo.insertRequest).not.toHaveBeenCalled();
    }
  );

  it("12. Admin explicit valid targetRegionId applies the SAME region to every row in the batch", async () => {
    const { service, requestsRepo } = makeRepoMocks();
    const buffer = await buildWorkbook([
      ["إسم العميل", "INCIDENT NUMBER", "TID"],
      ["Customer A", "INC-REGION-3", "TID-REGION-3"],
      ["Customer B", "INC-REGION-4", "TID-REGION-4"],
    ]);
    await service.importRawRequests(buffer, "admin-1", { role: "admin", regionId: null }, "active-region");
    for (const call of requestsRepo.insertRequest.mock.calls) {
      expect(call[0].regionId).toBe("active-region");
    }
  });

  it("13. Admin invalid targetRegionId for bulk import is rejected before any row is inserted", async () => {
    const { service, requestsRepo } = makeRepoMocks();
    const buffer = await buildWorkbook([
      ["إسم العميل", "INCIDENT NUMBER", "TID"],
      ["Customer A", "INC-REGION-5", "TID-REGION-5"],
    ]);
    await expect(
      service.importRawRequests(buffer, "admin-1", { role: "admin", regionId: null }, "does-not-exist")
    ).rejects.toBeInstanceOf(ValidationError);
    expect(requestsRepo.insertRequest).not.toHaveBeenCalled();
  });

  it("14. Admin OMITTING targetRegionId for bulk import is rejected — mandatory per batch", async () => {
    const { service, requestsRepo } = makeRepoMocks();
    const buffer = await buildWorkbook([
      ["إسم العميل", "INCIDENT NUMBER", "TID"],
      ["Customer A", "INC-REGION-6", "TID-REGION-6"],
    ]);
    await expect(
      service.importRawRequests(buffer, "admin-1", { role: "admin", regionId: null })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(requestsRepo.insertRequest).not.toHaveBeenCalled();
  });
});
