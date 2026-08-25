/**
 * OPS-PERM-S0-B1-C.I1B — Assignment Writer real-PostgreSQL concurrency and
 * atomicity proof.
 *
 * Runs only via a real disposable Postgres test database (same guard
 * pattern as courier-request-assigned-to-user-id-containment.test.ts and
 * DrizzleCourierRepository.transferCustodyToTechnician.concurrency.test.ts).
 * Uses two genuinely concurrent calls against the same real database
 * connection pool — not a simulated/sequential race, no sleep-based timing
 * assertions — so the frozen lock design (users -> supervisor_technicians
 * -> regions -> courier_requests, FOR SHARE for prerequisites, FOR UPDATE
 * for the mutated request row) is exercised against real Postgres, not a
 * mock.
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../../../../core/config/db";
import { DrizzleCourierRepository } from "./drizzle-courier.repository";
import { DrizzleCourierUnitOfWork } from "./DrizzleCourierUnitOfWork";
import { CourierService } from "../../application/courier.service";
import { OptimisticLockException } from "@core/errors/AppError";
import { users, regions, courierRequests, supervisorTechnicians, courierAuditLogs } from "@shared/schema";

/**
 * Pauses the FIRST call to the named lock method on
 * DrizzleCourierRepository.prototype for the duration of the test, so a
 * test can prove a real mid-transaction race rather than only comparing
 * before/after state. `ready` resolves the instant the paused call is
 * reached (i.e. every lock method called before it has already completed —
 * see the method-name-to-window mapping at each call site below), proving
 * transaction A is genuinely holding those locks with its transaction still
 * open. `getBackendPid()` returns transaction A's real PostgreSQL backend
 * PID (read via `pg_backend_pid()` on A's own transaction connection),
 * needed so the blocker relationship can be verified from PostgreSQL
 * itself rather than inferred. Calling `release()` lets the original
 * method — and the rest of the transaction — proceed. This is
 * deterministic signal-based coordination, not a sleep/timing guess.
 */
function pauseLockMethod(
  methodName: "lockAssignmentRegion" | "lockAssignmentRequest"
): { ready: Promise<void>; release: () => void; restore: () => void; getBackendPid: () => number } {
  const original = (DrizzleCourierRepository.prototype as any)[methodName];
  let resolveReady: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  let resolveRelease: () => void;
  const releaseGate = new Promise<void>((resolve) => {
    resolveRelease = resolve;
  });
  let paused = false;
  let backendPid: number | null = null;
  (DrizzleCourierRepository.prototype as any)[methodName] = async function (...args: any[]) {
    if (!paused) {
      paused = true;
      const client = (this as any).getClient(args[1]);
      const pidResult: any = await client.execute(sql`select pg_backend_pid() as pid`);
      backendPid = pidResult.rows[0].pid;
      resolveReady();
      await releaseGate;
    }
    return original.apply(this, args);
  };
  return {
    ready,
    release: () => resolveRelease(),
    restore: () => {
      (DrizzleCourierRepository.prototype as any)[methodName] = original;
    },
    getBackendPid: () => {
      if (backendPid === null) throw new Error("Backend PID not captured yet — await `ready` first.");
      return backendPid;
    },
  };
}

/**
 * Fires a conflicting raw-SQL mutation from a second, independent real
 * Postgres connection, returning that connection's own backend PID (so
 * PostgreSQL's blocker relationship can be verified against it) along with
 * the in-flight query promise. Does not assume anything about timing —
 * blocking is proven separately via `waitUntilBlockedBy` below, which
 * queries PostgreSQL's own `pg_blocking_pids()`, not by inspecting promise
 * settlement.
 */
async function fireConflictingMutation(
  querySql: string,
  params: unknown[]
): Promise<{ backendPid: number; result: Promise<unknown>; release: () => void }> {
  const client = await pool.connect();
  const pidResult = await client.query("select pg_backend_pid() as pid");
  const backendPid: number = pidResult.rows[0].pid;
  const result = client.query(querySql, params);
  return { backendPid, result, release: () => client.release() };
}

/**
 * Authoritative PostgreSQL lock-wait proof: polls `pg_blocking_pids()` —
 * PostgreSQL's own documented function for identifying which backend(s)
 * are blocking a given backend — from a separate monitoring connection,
 * until it reports `blockerPid` as a blocker of `blockedPid`, or the
 * bounded attempt count is exhausted (a safety guard against a genuinely
 * hung test, never the proof itself — the proof is PostgreSQL's own
 * function result). This deliberately avoids relying on `pg_locks.locktype`
 * directly, since PostgreSQL may represent a row-level wait internally as a
 * wait on another transaction's ID rather than an obvious tuple lock row;
 * `pg_blocking_pids()` is the documented, correct abstraction over that
 * detail.
 */
async function waitUntilBlockedBy(
  blockedPid: number,
  blockerPid: number,
  maxAttempts = 200
): Promise<number[]> {
  const monitor = await pool.connect();
  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await monitor.query("select pg_blocking_pids($1) as blockers", [blockedPid]);
      const blockers: number[] = res.rows[0].blockers;
      if (blockers.includes(blockerPid)) return blockers;
      await new Promise((resolve) => setImmediate(resolve));
    }
    throw new Error(
      `Timed out after ${maxAttempts} polls waiting for PostgreSQL to report backend ${blockedPid} ` +
        `as blocked by backend ${blockerPid} via pg_blocking_pids() — this is a test safety-guard ` +
        `failure, not evidence either way about the lock itself.`
    );
  } finally {
    monitor.release();
  }
}

describe("OPS-PERM-S0-B1-C.I1B — assignRequest real-PostgreSQL concurrency and atomicity", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdUserIds: string[] = [];
  const createdRegionIds: string[] = [];
  const createdRequestIds: number[] = [];
  const createdRelationIds: number[] = [];

  afterEach(async () => {
    for (const id of createdRelationIds.splice(0)) {
      await db.delete(supervisorTechnicians).where(eq(supervisorTechnicians.id, id)).catch(() => {});
    }
    for (const id of createdRequestIds.splice(0)) {
      await db.delete(courierAuditLogs).where(eq(courierAuditLogs.recordId, id)).catch(() => {});
      await db.delete(courierRequests).where(eq(courierRequests.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
    for (const id of createdRegionIds.splice(0)) {
      await db.delete(regions).where(eq(regions.id, id)).catch(() => {});
    }
  });

  function makeService() {
    const uow = new DrizzleCourierUnitOfWork();
    const repo = new DrizzleCourierRepository();
    return new CourierService(uow, repo, repo, repo, repo, repo);
  }

  async function seedRegion(active = true): Promise<string> {
    const id = randomUUID();
    await db.insert(regions).values({ id, name: `I1B-Region-${id.slice(0, 8)}`, isActive: active });
    createdRegionIds.push(id);
    return id;
  }

  async function seedUser(role: string, regionId: string | null, isActive = true, label = role): Promise<string> {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      username: `i1b-${label}-${id.slice(0, 8)}`,
      email: `i1b-${label}-${id.slice(0, 8)}@test.local`,
      password: "not-a-real-hash",
      fullName: `I1B ${label}`,
      role,
      regionId,
      isActive,
    });
    createdUserIds.push(id);
    return id;
  }

  async function seedRequest(regionId: string | null, assignedToUserId: string | null = null): Promise<{ id: number; version: number }> {
    const [row] = await db
      .insert(courierRequests)
      .values({ customerName: "I1B Concurrency Test Request", regionId, assignedToUserId })
      .returning();
    createdRequestIds.push(row.id);
    return { id: row.id, version: row.version };
  }

  async function linkSupervisorTechnician(supervisorId: string, technicianId: string): Promise<void> {
    const [row] = await db
      .insert(supervisorTechnicians)
      .values({ supervisorId, technicianId })
      .returning();
    createdRelationIds.push(row.id);
  }

  it("1. two genuinely concurrent Admin assignments for the same request/version, different targets: exactly one succeeds, the other gets a version conflict", async () => {
    const region = await seedRegion();
    const admin = await seedUser("admin", null, true, "admin");
    const techA = await seedUser("technician", region, true, "tech-a");
    const techB = await seedUser("technician", region, true, "tech-b");
    const request = await seedRequest(region);

    const serviceA = makeService();
    const serviceB = makeService();

    const attemptA = serviceA.assignRequest(request.id, admin, { assignedToUserId: techA, version: request.version });
    const attemptB = serviceB.assignRequest(request.id, admin, { assignedToUserId: techB, version: request.version });

    const results = await Promise.allSettled([attemptA, attemptB]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(OptimisticLockException);

    const [row] = await db.select().from(courierRequests).where(eq(courierRequests.id, request.id));
    expect(row.version).toBe(request.version + 1);
    expect([techA, techB]).toContain(row.assignedToUserId);

    const auditRows = await db.select().from(courierAuditLogs).where(eq(courierAuditLogs.recordId, request.id));
    expect(auditRows).toHaveLength(1);
  }, 15000);

  it("2. a request already at the target version+assignee combination the racing writer expected does not double-mutate: version increments exactly once total", async () => {
    const region = await seedRegion();
    const admin = await seedUser("admin", null, true, "admin");
    const tech = await seedUser("technician", region, true, "tech");
    const request = await seedRequest(region);

    const serviceA = makeService();
    const resultA = await serviceA.assignRequest(request.id, admin, { assignedToUserId: tech, version: request.version });
    expect(resultA.changed).toBe(true);
    expect(resultA.version).toBe(request.version + 1);

    // Same assignee, now-current version: success no-op, no further bump.
    const serviceB = makeService();
    const resultB = await serviceB.assignRequest(request.id, admin, { assignedToUserId: tech, version: resultA.version });
    expect(resultB.changed).toBe(false);
    expect(resultB.version).toBe(resultA.version);

    const [row] = await db.select().from(courierRequests).where(eq(courierRequests.id, request.id));
    expect(row.version).toBe(request.version + 1);

    const auditRows = await db.select().from(courierAuditLogs).where(eq(courierAuditLogs.recordId, request.id));
    expect(auditRows).toHaveLength(1);
  }, 15000);

  it("3. a forced audit-insert failure rolls back the assignment and version increment atomically", async () => {
    const region = await seedRegion();
    const admin = await seedUser("admin", null, true, "admin");
    const tech = await seedUser("technician", region, true, "tech");
    const request = await seedRequest(region);

    const original = DrizzleCourierRepository.prototype.insertAuditLog;
    DrizzleCourierRepository.prototype.insertAuditLog = async function () {
      throw new Error("OPS-PERM-S0-B1-C.I1B forced audit failure for atomicity proof");
    };
    try {
      const service = makeService();
      await expect(
        service.assignRequest(request.id, admin, { assignedToUserId: tech, version: request.version })
      ).rejects.toThrow("forced audit failure");
    } finally {
      DrizzleCourierRepository.prototype.insertAuditLog = original;
    }

    const [row] = await db.select().from(courierRequests).where(eq(courierRequests.id, request.id));
    expect(row.assignedToUserId).toBeNull();
    expect(row.version).toBe(request.version);

    const auditRows = await db.select().from(courierAuditLogs).where(eq(courierAuditLogs.recordId, request.id));
    expect(auditRows).toHaveLength(0);
  }, 15000);

  it("4. Supervisor with an active supervisor_technicians relation succeeds against a real database row", async () => {
    const region = await seedRegion();
    const supervisor = await seedUser("supervisor", region, true, "sup");
    const tech = await seedUser("technician", region, true, "tech");
    await linkSupervisorTechnician(supervisor, tech);
    const request = await seedRequest(region);

    const service = makeService();
    const result = await service.assignRequest(request.id, supervisor, { assignedToUserId: tech, version: request.version });
    expect(result.changed).toBe(true);

    const [row] = await db.select().from(courierRequests).where(eq(courierRequests.id, request.id));
    expect(row.assignedToUserId).toBe(tech);
  }, 15000);

  it("5. Supervisor without the relation is rejected even though role/region/active are all otherwise valid", async () => {
    const region = await seedRegion();
    const supervisor = await seedUser("supervisor", region, true, "sup");
    const tech = await seedUser("technician", region, true, "tech");
    // No supervisorTechnicians row is created — the relation genuinely
    // does not exist in the real database.
    const request = await seedRequest(region);

    const service = makeService();
    await expect(
      service.assignRequest(request.id, supervisor, { assignedToUserId: tech, version: request.version })
    ).rejects.toThrow();

    const [row] = await db.select().from(courierRequests).where(eq(courierRequests.id, request.id));
    expect(row.assignedToUserId).toBeNull();
    expect(row.version).toBe(request.version);
  }, 15000);

  it("6. a concurrent removal of the supervisor_technicians relation cannot invalidate an assignment already committed against it", async () => {
    const region = await seedRegion();
    const supervisor = await seedUser("supervisor", region, true, "sup");
    const tech = await seedUser("technician", region, true, "tech");
    await linkSupervisorTechnician(supervisor, tech);
    const request = await seedRequest(region);

    const service = makeService();
    const result = await service.assignRequest(request.id, supervisor, { assignedToUserId: tech, version: request.version });
    expect(result.changed).toBe(true);

    // The relationship is removed AFTER the assignment already committed —
    // this must not retroactively unassign the request (no such behavior
    // is authorized in I1B).
    await db
      .delete(supervisorTechnicians)
      .where(eq(supervisorTechnicians.supervisorId, supervisor));

    const [row] = await db.select().from(courierRequests).where(eq(courierRequests.id, request.id));
    expect(row.assignedToUserId).toBe(tech);
  }, 15000);

  it("7. actor mid-transaction race: a concurrent actor deactivation cannot be observed by an authorization decision already committed to the locked snapshot", async () => {
    const region = await seedRegion();
    const admin = await seedUser("admin", null, true, "admin-race");
    const tech = await seedUser("technician", region, true, "tech-race-actor");
    const request = await seedRequest(region);

    // Paused at lockAssignmentRegion: by the time this fires, users (actor +
    // target) are already locked FOR SHARE and the transaction is still
    // open — exactly the window in which a concurrent actor mutation must
    // be proven blocked.
    const paused = pauseLockMethod("lockAssignmentRegion");
    try {
      const service = makeService();
      const assignPromise = service.assignRequest(request.id, admin, { assignedToUserId: tech, version: request.version });

      await paused.ready;
      const aPid = paused.getBackendPid();
      const { backendPid: bPid, result: bResult, release: releaseB } = await fireConflictingMutation(
        `UPDATE users SET is_active = false WHERE id = $1`,
        [admin]
      );
      // AUTHORITATIVE PROOF: PostgreSQL's own pg_blocking_pids() reports
      // A's backend as the blocker of B's backend — not an inference from
      // elapsed time or promise settlement.
      const blockers = await waitUntilBlockedBy(bPid, aPid);
      expect(blockers).toContain(aPid);

      paused.release();
      const assignResult = await assignPromise;
      await bResult;
      releaseB();

      // A's authorization decision was made against the actor snapshot as
      // it existed when locked (active) — it must not retroactively fail
      // or silently reflect B's later deactivation.
      expect(assignResult.changed).toBe(true);
    } finally {
      paused.restore();
      await db.update(users).set({ isActive: true }).where(eq(users.id, admin));
    }
  }, 15000);

  it("8. target mid-transaction race: a concurrent target deactivation cannot invalidate an eligibility snapshot A already locked", async () => {
    const region = await seedRegion();
    const admin = await seedUser("admin", null, true, "admin-race-2");
    const tech = await seedUser("technician", region, true, "tech-race-target");
    const request = await seedRequest(region);

    const paused = pauseLockMethod("lockAssignmentRegion");
    try {
      const service = makeService();
      const assignPromise = service.assignRequest(request.id, admin, { assignedToUserId: tech, version: request.version });

      await paused.ready;
      const aPid = paused.getBackendPid();
      const { backendPid: bPid, result: bResult, release: releaseB } = await fireConflictingMutation(
        `UPDATE users SET is_active = false WHERE id = $1`,
        [tech]
      );
      const blockers = await waitUntilBlockedBy(bPid, aPid);
      expect(blockers).toContain(aPid);

      paused.release();
      const assignResult = await assignPromise;
      await bResult;
      releaseB();

      expect(assignResult.changed).toBe(true);
    } finally {
      paused.restore();
      await db.update(users).set({ isActive: true }).where(eq(users.id, tech));
    }
  }, 15000);

  it("9. region-deactivation mid-transaction race: a concurrent region deactivation cannot invalidate a region snapshot A already locked", async () => {
    const region = await seedRegion();
    const admin = await seedUser("admin", null, true, "admin-race-3");
    const tech = await seedUser("technician", region, true, "tech-race-region");
    const request = await seedRequest(region);

    // Paused at lockAssignmentRequest: by the time this fires, the required
    // region row is already locked FOR SHARE (this is the very next lock
    // acquired after it in the frozen order), transaction still open.
    const paused = pauseLockMethod("lockAssignmentRequest");
    try {
      const service = makeService();
      const assignPromise = service.assignRequest(request.id, admin, { assignedToUserId: tech, version: request.version });

      await paused.ready;
      const aPid = paused.getBackendPid();
      const { backendPid: bPid, result: bResult, release: releaseB } = await fireConflictingMutation(
        `UPDATE regions SET is_active = false WHERE id = $1`,
        [region]
      );
      const blockers = await waitUntilBlockedBy(bPid, aPid);
      expect(blockers).toContain(aPid);

      paused.release();
      const assignResult = await assignPromise;
      await bResult;
      releaseB();

      expect(assignResult.changed).toBe(true);
    } finally {
      paused.restore();
      await db.update(regions).set({ isActive: true }).where(eq(regions.id, region));
    }
  }, 15000);

  it("10. supervisor_technicians mid-transaction race: a concurrent DELETE of the exact relationship cannot proceed while A's authorization snapshot still relies on it", async () => {
    const region = await seedRegion();
    const supervisor = await seedUser("supervisor", region, true, "sup-race");
    const tech = await seedUser("technician", region, true, "tech-race-relation");
    await linkSupervisorTechnician(supervisor, tech);
    const request = await seedRequest(region);

    // Paused at lockAssignmentRegion: in the Supervisor branch, the
    // supervisor_technicians relation is locked FOR SHARE immediately
    // before the region lock, so this window is exactly "relation held,
    // transaction still open".
    const paused = pauseLockMethod("lockAssignmentRegion");
    try {
      const service = makeService();
      const assignPromise = service.assignRequest(request.id, supervisor, { assignedToUserId: tech, version: request.version });

      await paused.ready;
      const aPid = paused.getBackendPid();
      const { backendPid: bPid, result: bResult, release: releaseB } = await fireConflictingMutation(
        `DELETE FROM supervisor_technicians WHERE supervisor_id = $1 AND technician_id = $2`,
        [supervisor, tech]
      );
      // AUTHORITATIVE PROOF: PostgreSQL's own pg_blocking_pids() reports
      // A's backend as the blocker of the DELETE's backend.
      const blockers = await waitUntilBlockedBy(bPid, aPid);
      expect(blockers).toContain(aPid);

      paused.release();
      const assignResult = await assignPromise;
      await bResult; // now free to proceed — the relation is deleted AFTER A's commit
      releaseB();

      expect(assignResult.changed).toBe(true);
      const [row] = await db.select().from(courierRequests).where(eq(courierRequests.id, request.id));
      expect(row.assignedToUserId).toBe(tech);
    } finally {
      paused.restore();
    }
  }, 15000);
});
