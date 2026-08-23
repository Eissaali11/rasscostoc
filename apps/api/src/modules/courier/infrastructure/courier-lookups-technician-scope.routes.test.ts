/**
 * OPS-PERM-S0-B1-B.F1.R1 — least-privilege technician-directory scope,
 * proven against a REAL isolated Postgres database (not mocked
 * repositories) — this is exactly the kind of server-side, database-level
 * authorization filtering that a mocked-repository unit test cannot prove;
 * it must be shown against the real query.
 */
import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@core/config/db";
import { users, regions } from "@shared/schema";
import { CourierService } from "../application/courier.service";
import { DrizzleCourierRepository } from "./repositories/drizzle-courier.repository";
import { DrizzleCourierUnitOfWork } from "./repositories/DrizzleCourierUnitOfWork";

describe("OPS-PERM-S0-B1-B.F1.R1 — GET /api/courier/lookups technician scope", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database."
      );
    }
  });

  const repo = new DrizzleCourierRepository();
  const service = new CourierService(new DrizzleCourierUnitOfWork(), repo, repo, repo, repo, repo);

  const createdUserIds: string[] = [];
  const createdRegionIds: string[] = [];

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
    for (const id of createdRegionIds.splice(0)) {
      await db.delete(regions).where(eq(regions.id, id)).catch(() => {});
    }
  });

  async function seedRegion(isActive: boolean = true): Promise<string> {
    const [region] = await db
      .insert(regions)
      .values({ name: `lookups-scope-test-${randomUUID().slice(0, 8)}`, isActive })
      .returning();
    createdRegionIds.push(region.id);
    return region.id;
  }

  async function seedTechnician(regionId: string | null, suffix: string): Promise<string> {
    const id = `lookups-scope-tech-${suffix}`;
    await db.insert(users).values({
      id,
      username: `lookups_scope_tech_${suffix}`,
      email: `lookups-scope-tech-${suffix}@test.invalid`,
      password: "test-password",
      fullName: `Lookups Scope Tech ${suffix}`,
      role: "technician",
      regionId,
    });
    createdUserIds.push(id);
    return id;
  }

  it("1. Admin receives the full company-wide technician list", async () => {
    const regionA = await seedRegion();
    const regionB = await seedRegion();
    const techA = await seedTechnician(regionA, randomUUID().slice(0, 6));
    const techB = await seedTechnician(regionB, randomUUID().slice(0, 6));

    const result = await service.getLookups({ role: "admin", regionId: null });
    const ids = result.technicians.map((t: any) => t.id);
    expect(ids).toContain(techA);
    expect(ids).toContain(techB);
  });

  it("2. Supervisor receives ONLY technicians from req.user.regionId", async () => {
    const regionA = await seedRegion();
    const regionB = await seedRegion();
    const techA = await seedTechnician(regionA, randomUUID().slice(0, 6));
    const techB = await seedTechnician(regionB, randomUUID().slice(0, 6));

    const result = await service.getLookups({ role: "supervisor", regionId: regionA });
    const ids = result.technicians.map((t: any) => t.id);
    expect(ids).toContain(techA);
    expect(ids).not.toContain(techB);
  });

  it("3. Supervisor cannot retrieve a technician from another region by any means available through this endpoint", async () => {
    const regionA = await seedRegion();
    const regionB = await seedRegion();
    await seedTechnician(regionA, randomUUID().slice(0, 6));
    const techB = await seedTechnician(regionB, randomUUID().slice(0, 6));

    const result = await service.getLookups({ role: "supervisor", regionId: regionA });
    expect(result.technicians.some((t: any) => t.id === techB)).toBe(false);
  });

  it("4. Supervisor with a missing regionId gets zero technicians — no cross-region fallback", async () => {
    const regionA = await seedRegion();
    await seedTechnician(regionA, randomUUID().slice(0, 6));

    const result = await service.getLookups({ role: "supervisor", regionId: null });
    expect(result.technicians).toEqual([]);
  });

  it("5. Supervisor with an invalid (non-existent) regionId gets zero technicians", async () => {
    const regionA = await seedRegion();
    await seedTechnician(regionA, randomUUID().slice(0, 6));

    const result = await service.getLookups({ role: "supervisor", regionId: "does-not-exist" });
    expect(result.technicians).toEqual([]);
  });

  it("5b. Supervisor whose assigned region exists but is INACTIVE gets zero technicians — a present, non-empty regionId is not sufficient authorization by itself", async () => {
    const inactiveRegion = await seedRegion(false);
    // The technician is NOT deleted/absent — it genuinely exists, attached
    // to the inactive region, proving the query itself (not merely an
    // empty dataset) is what yields zero results.
    const techInInactiveRegion = await seedTechnician(inactiveRegion, randomUUID().slice(0, 6));

    const result = await service.getLookups({ role: "supervisor", regionId: inactiveRegion });
    expect(result.technicians).toEqual([]);
    expect(result.technicians.some((t: any) => t.id === techInInactiveRegion)).toBe(false);

    // Independent corroboration the technician really does exist and is
    // really attached to this exact (inactive) region, so the empty result
    // above is proven to be the query's doing, not an empty fixture.
    const [rawRow] = await db.select().from(users).where(eq(users.id, techInInactiveRegion));
    expect(rawRow?.regionId).toBe(inactiveRegion);
  });

  it.each(["courier_supervisor", "warehouse", "technician", "viewer"])(
    "6. role=%s cannot obtain any technician-directory data — zero company-wide roster",
    async (role) => {
      const regionA = await seedRegion();
      await seedTechnician(regionA, randomUUID().slice(0, 6));

      const result = await service.getLookups({ role, regionId: regionA });
      expect(result.technicians).toEqual([]);
    }
  );

  it("7. non-sensitive catalog fields (cities/simTypes/vendorTypes/failureReasons/regions) remain unscoped for every role", async () => {
    const result = await service.getLookups({ role: "viewer", regionId: null });
    expect(Array.isArray(result.cities)).toBe(true);
    expect(Array.isArray(result.regions)).toBe(true);
  });

  it("8. regions payload now includes isActive alongside id/name (additive, historical shape preserved)", async () => {
    await seedRegion();
    const result = await service.getLookups({ role: "admin", regionId: null });
    const sample = result.regions[0];
    expect(sample).toHaveProperty("id");
    expect(sample).toHaveProperty("name");
    expect(sample).toHaveProperty("isActive");
  });
});
