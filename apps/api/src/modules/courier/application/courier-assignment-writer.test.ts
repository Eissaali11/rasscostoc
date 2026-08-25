// OPS-PERM-S0-B1-C.I1B — Assignment Writer authorization/business-logic
// contract. Pure mocked-repository unit tests (no DB required): these
// exercise CourierService.assignRequest directly against the frozen owner
// contract — Admin/Supervisor actors only, Supervisor requires an explicit
// supervisor_technicians relationship in addition to same-region membership,
// Admin bypasses that relationship but the target must still meet the
// organizational data-integrity floor (active technician, non-null active
// region), uniform 400 for every target-ineligibility reason, and the
// version-CAS/no-op/audit semantics frozen alongside the locking design.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CourierService } from "./courier.service";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  OptimisticLockException,
  ValidationError,
} from "@core/errors/AppError";

const ACTIVE_REGION = "active-region";
const OTHER_REGION = "other-region";
const INACTIVE_REGION = "inactive-region";

function makeUser(overrides: Partial<{
  id: string; role: string; regionId: string | null; isActive: boolean;
}> = {}) {
  return { id: "u", role: "technician", regionId: null, isActive: true, ...overrides };
}

function makeRegion(id: string, isActive: boolean) {
  return { id, isActive };
}

function makeRequest(overrides: Partial<{
  id: number; regionId: string | null; assignedToUserId: string | null; version: number;
}> = {}) {
  return { id: 1, regionId: ACTIVE_REGION, assignedToUserId: null, version: 1, ...overrides };
}

function makeService(fixtures: {
  actor?: ReturnType<typeof makeUser> | null;
  target?: ReturnType<typeof makeUser> | null;
  hasRelation?: boolean;
  regions?: Record<string, ReturnType<typeof makeRegion> | null>;
  request?: ReturnType<typeof makeRequest> | null;
}) {
  const regionsById = fixtures.regions ?? {
    [ACTIVE_REGION]: makeRegion(ACTIVE_REGION, true),
    [INACTIVE_REGION]: makeRegion(INACTIVE_REGION, false),
  };

  const requestsRepo: any = {
    lockAssignmentActorAndTarget: vi.fn(async () => ({
      actor: fixtures.actor ?? null,
      target: fixtures.target ?? null,
    })),
    lockAssignmentSupervisorTechnicianRelation: vi.fn(async () => fixtures.hasRelation ?? false),
    lockAssignmentRegion: vi.fn(async (regionId: string) => regionsById[regionId] ?? null),
    lockAssignmentRequest: vi.fn(async () => fixtures.request ?? null),
    updateAssignmentWithVersion: vi.fn(async (_id: number, _uid: string, expectedVersion: number) => {
      const current = fixtures.request;
      if (!current || current.version !== expectedVersion) return null;
      return { version: expectedVersion + 1 };
    }),
  };
  const dashboardRepo: any = { insertAuditLog: vi.fn(async () => undefined) };
  const uow: any = { execute: (work: any) => work({ requestsRepository: requestsRepo, dashboardRepository: dashboardRepo }) };
  const noop: any = {};
  const service = new CourierService(uow, requestsRepo, noop, noop, dashboardRepo, noop);
  return { service, requestsRepo, dashboardRepo };
}

describe("OPS-PERM-S0-B1-C.I1B — assignRequest authorization: actor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("1. missing actor -> 401, no locks beyond users", async () => {
    const { service, requestsRepo } = makeService({ actor: null });
    await expect(
      service.assignRequest(1, "missing-actor", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(AuthenticationError);
    expect(requestsRepo.lockAssignmentRequest).not.toHaveBeenCalled();
  });

  it("2. inactive actor -> 401", async () => {
    const { service } = makeService({ actor: makeUser({ id: "sup-1", role: "supervisor", isActive: false, regionId: ACTIVE_REGION }) });
    await expect(
      service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it.each(["technician", "warehouse", "viewer"])("3. actor role=%s -> 403", async (role) => {
    const { service } = makeService({ actor: makeUser({ id: "u1", role, isActive: true }) });
    await expect(
      service.assignRequest(1, "u1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("4. legacy courier_supervisor actor is denied — never treated as Regional Supervisor", async () => {
    const { service } = makeService({ actor: makeUser({ id: "u1", role: "courier_supervisor", isActive: true, regionId: ACTIVE_REGION }) });
    await expect(
      service.assignRequest(1, "u1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("5. Supervisor with NULL regionId -> 403, no target/relation locks reached", async () => {
    const { service, requestsRepo } = makeService({
      actor: makeUser({ id: "sup-1", role: "supervisor", isActive: true, regionId: null }),
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: ACTIVE_REGION }),
    });
    await expect(
      service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(requestsRepo.lockAssignmentSupervisorTechnicianRelation).not.toHaveBeenCalled();
  });

  it("6. actorId === assignedToUserId is rejected before any lock is acquired", async () => {
    const { service, requestsRepo } = makeService({});
    await expect(
      service.assignRequest(1, "same-id", { assignedToUserId: "same-id", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(requestsRepo.lockAssignmentActorAndTarget).not.toHaveBeenCalled();
  });
});

describe("OPS-PERM-S0-B1-C.I1B — assignRequest authorization: Supervisor target", () => {
  beforeEach(() => vi.clearAllMocks());

  const actor = makeUser({ id: "sup-1", role: "supervisor", isActive: true, regionId: ACTIVE_REGION });

  it("7. same region + active target + explicit relationship -> succeeds", async () => {
    const { service } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: ACTIVE_REGION }),
      hasRelation: true,
      request: makeRequest({ regionId: ACTIVE_REGION }),
    });
    const result = await service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 });
    expect(result.changed).toBe(true);
  });

  it("8. same region + active target + NO relationship -> uniform 400", async () => {
    const { service } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: ACTIVE_REGION }),
      hasRelation: false,
    });
    await expect(
      service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("9. relation belongs to another supervisor (lock returns false) -> uniform 400", async () => {
    const { service, requestsRepo } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: ACTIVE_REGION }),
      hasRelation: false,
    });
    await expect(
      service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(requestsRepo.lockAssignmentSupervisorTechnicianRelation).toHaveBeenCalledWith("sup-1", "tech-1");
  });

  it("10. cross-region technician -> uniform 400, relation never checked", async () => {
    const { service, requestsRepo } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: OTHER_REGION }),
    });
    await expect(
      service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(requestsRepo.lockAssignmentSupervisorTechnicianRelation).not.toHaveBeenCalled();
  });

  it("11. inactive target -> uniform 400", async () => {
    const { service } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: false, regionId: ACTIVE_REGION }),
    });
    await expect(
      service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("12. wrong-role target -> uniform 400", async () => {
    const { service } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "supervisor", isActive: true, regionId: ACTIVE_REGION }),
    });
    await expect(
      service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("13. nonexistent target -> uniform 400", async () => {
    const { service } = makeService({ actor, target: null });
    await expect(
      service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("14. Supervisor's own region inactive -> 403 (actor-authority failure, not target 400)", async () => {
    const supInInactiveRegion = makeUser({ id: "sup-1", role: "supervisor", isActive: true, regionId: INACTIVE_REGION });
    const { service } = makeService({
      actor: supInInactiveRegion,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: INACTIVE_REGION }),
      hasRelation: true,
    });
    await expect(
      service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("15. Supervisor's own region missing entirely -> 403", async () => {
    const supInMissingRegion = makeUser({ id: "sup-1", role: "supervisor", isActive: true, regionId: "ghost-region" });
    const { service } = makeService({
      actor: supInMissingRegion,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: "ghost-region" }),
      hasRelation: true,
      regions: {},
    });
    await expect(
      service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("16. request outside Supervisor's region -> concealed 404", async () => {
    const { service } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: ACTIVE_REGION }),
      hasRelation: true,
      request: makeRequest({ regionId: OTHER_REGION }),
    });
    await expect(
      service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("17. nonexistent request -> 404", async () => {
    const { service } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: ACTIVE_REGION }),
      hasRelation: true,
      request: null,
    });
    await expect(
      service.assignRequest(1, "sup-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("OPS-PERM-S0-B1-C.I1B — assignRequest authorization: Admin target", () => {
  beforeEach(() => vi.clearAllMocks());

  const actor = makeUser({ id: "admin-1", role: "admin", isActive: true, regionId: null });

  it("18. cross-region valid technician succeeds without any supervisor_technicians check", async () => {
    const { service, requestsRepo } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: OTHER_REGION }),
      request: makeRequest({ regionId: ACTIVE_REGION }),
      regions: {
        [ACTIVE_REGION]: makeRegion(ACTIVE_REGION, true),
        [OTHER_REGION]: makeRegion(OTHER_REGION, true),
      },
    });
    const result = await service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 1 });
    expect(result.changed).toBe(true);
    expect(requestsRepo.lockAssignmentSupervisorTechnicianRelation).not.toHaveBeenCalled();
  });

  it("19. technician with NULL regionId -> uniform 400", async () => {
    const { service } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: null }),
    });
    await expect(
      service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("20. technician whose region is missing entirely -> uniform 400", async () => {
    const { service } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: "ghost-region" }),
      regions: {},
    });
    await expect(
      service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("21. technician whose region is inactive -> uniform 400", async () => {
    const { service } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: INACTIVE_REGION }),
    });
    await expect(
      service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("22. inactive technician -> uniform 400", async () => {
    const { service } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: false, regionId: ACTIVE_REGION }),
    });
    await expect(
      service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("23. wrong-role target -> uniform 400", async () => {
    const { service } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "viewer", isActive: true, regionId: ACTIVE_REGION }),
    });
    await expect(
      service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("24. nonexistent target -> uniform 400", async () => {
    const { service } = makeService({ actor, target: null });
    await expect(
      service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 1 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("25. Admin may act on any existing operational request regardless of region", async () => {
    const { service } = makeService({
      actor,
      target: makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: OTHER_REGION }),
      request: makeRequest({ regionId: "yet-another-region" }),
      regions: { [OTHER_REGION]: makeRegion(OTHER_REGION, true) },
    });
    await expect(
      service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 1 })
    ).resolves.toMatchObject({ changed: true });
  });
});

describe("OPS-PERM-S0-B1-C.I1B — assignRequest version/no-op/audit semantics", () => {
  beforeEach(() => vi.clearAllMocks());

  const actor = makeUser({ id: "admin-1", role: "admin", isActive: true, regionId: null });
  const target = makeUser({ id: "tech-1", role: "technician", isActive: true, regionId: ACTIVE_REGION });

  it("26. NULL -> target is a first assignment: version increments once, audit action=assign", async () => {
    const { service, dashboardRepo } = makeService({
      actor, target, request: makeRequest({ assignedToUserId: null, version: 5 }),
    });
    const result = await service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 5 });
    expect(result.version).toBe(6);
    expect(result.changed).toBe(true);
    expect(dashboardRepo.insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "assign", oldValue: null, newValue: "tech-1", fieldName: "assignedToUserId" })
    );
  });

  it("27. existing different target is a reassignment: audit action=reassign", async () => {
    const { service, dashboardRepo } = makeService({
      actor, target, request: makeRequest({ assignedToUserId: "old-tech", version: 3 }),
    });
    const result = await service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 3 });
    expect(result.version).toBe(4);
    expect(dashboardRepo.insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "reassign", oldValue: "old-tech", newValue: "tech-1" })
    );
  });

  it("28. same assignee + current version -> success no-op: unchanged version, zero audit", async () => {
    const { service, dashboardRepo, requestsRepo } = makeService({
      actor, target, request: makeRequest({ assignedToUserId: "tech-1", version: 7 }),
    });
    const result = await service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 7 });
    expect(result).toMatchObject({ changed: false, version: 7, assignedToUserId: "tech-1" });
    expect(dashboardRepo.insertAuditLog).not.toHaveBeenCalled();
    expect(requestsRepo.updateAssignmentWithVersion).not.toHaveBeenCalled();
  });

  it("29. same assignee + stale version -> 409, checked before no-op collapse", async () => {
    const { service } = makeService({
      actor, target, request: makeRequest({ assignedToUserId: "tech-1", version: 7 }),
    });
    await expect(
      service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 6 })
    ).rejects.toBeInstanceOf(OptimisticLockException);
  });

  it("30. stale version with a different target -> 409, no mutation", async () => {
    const { service, dashboardRepo } = makeService({
      actor, target, request: makeRequest({ assignedToUserId: "old-tech", version: 7 }),
    });
    await expect(
      service.assignRequest(1, "admin-1", { assignedToUserId: "tech-1", version: 6 })
    ).rejects.toBeInstanceOf(OptimisticLockException);
    expect(dashboardRepo.insertAuditLog).not.toHaveBeenCalled();
  });
});

// Regression coverage proving generic create/update/import still cannot
// write assignedToUserId already exists and is unchanged by this gate:
// see courier-assignment-mass-assignment-containment.test.ts (I1A).
