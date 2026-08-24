/**
 * Real-database proof that no write path can set
 * courier_requests.assigned_to_user_id. No assignment-writing operation
 * exists in this codebase — every request, however created or updated,
 * must persist NULL for this column, exactly mirroring the identical
 * region_id immutability proof pattern used for the region ownership
 * column (DrizzleCourierRepository.ownershipInvariant.test.ts /
 * courier-service-region-writer-contract.test.ts).
 *
 * Runs only via a real disposable Postgres test database (same guard
 * pattern as the other DB-backed courier repository tests).
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../../../core/config/db";
import { DrizzleCourierRepository } from "./drizzle-courier.repository";
import { users, courierRequests } from "@shared/schema";

describe("assigned_to_user_id is never set by any current write path", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdUserIds: string[] = [];
  const createdRequestIds: number[] = [];

  afterEach(async () => {
    for (const id of createdRequestIds.splice(0)) {
      await db.delete(courierRequests).where(eq(courierRequests.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  const repo = new DrizzleCourierRepository();

  async function seedUser(): Promise<string> {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      username: `assign-containment-${id.slice(0, 8)}`,
      email: `assign-containment-${id.slice(0, 8)}@test.local`,
      password: "not-a-real-hash",
      fullName: "Assignment Containment Test User",
      role: "technician",
    });
    createdUserIds.push(id);
    return id;
  }

  it("1. insertRequest persists NULL even when the caller-supplied data includes assignedToUserId", async () => {
    const attackerUserId = await seedUser();
    const created = await repo.insertRequest({
      customerName: "Assignment Containment Create Test",
      assignedToUserId: attackerUserId,
    } as any);
    createdRequestIds.push(created.id);

    const [row] = await db.select().from(courierRequests).where(eq(courierRequests.id, created.id));
    expect(row.assignedToUserId).toBeNull();
  });

  it("2. insertRequestBulk persists NULL for every row even when caller-supplied data includes assignedToUserId", async () => {
    const attackerUserId = await seedUser();
    const created = await repo.insertRequestBulk([
      { customerName: "Assignment Containment Bulk Test 1", assignedToUserId: attackerUserId } as any,
      { customerName: "Assignment Containment Bulk Test 2", assignedToUserId: attackerUserId } as any,
    ]);
    createdRequestIds.push(...created.map((r) => r.id));

    const rows = await db
      .select()
      .from(courierRequests)
      .where(eq(courierRequests.id, created[0].id));
    for (const r of created) {
      const [row] = await db.select().from(courierRequests).where(eq(courierRequests.id, r.id));
      expect(row.assignedToUserId).toBeNull();
    }
  });

  it("3. updateRequest cannot change assigned_to_user_id via camelCase key, even on an existing request", async () => {
    const [created] = await db
      .insert(courierRequests)
      .values({ customerName: "Assignment Containment Update Test A" })
      .returning();
    createdRequestIds.push(created.id);
    const attackerUserId = await seedUser();

    await repo.updateRequest(created.id, {
      customerName: "Assignment Containment Update Test A - edited",
      assignedToUserId: attackerUserId,
    });

    const [row] = await db.select().from(courierRequests).where(eq(courierRequests.id, created.id));
    expect(row.assignedToUserId).toBeNull();
    expect(row.customerName).toBe("Assignment Containment Update Test A - edited"); // the legitimate field DID update
  });

  it("4. updateRequest cannot change assigned_to_user_id via snake_case key, even on an existing request", async () => {
    const [created] = await db
      .insert(courierRequests)
      .values({ customerName: "Assignment Containment Update Test B" })
      .returning();
    createdRequestIds.push(created.id);
    const attackerUserId = await seedUser();

    await repo.updateRequest(created.id, {
      customerName: "Assignment Containment Update Test B - edited",
      assigned_to_user_id: attackerUserId,
    } as any);

    const [row] = await db.select().from(courierRequests).where(eq(courierRequests.id, created.id));
    expect(row.assignedToUserId).toBeNull();
    expect(row.customerName).toBe("Assignment Containment Update Test B - edited");
  });

  it("5. updateRequest cannot overwrite an already-assigned request's assignment", async () => {
    const preAssignedUserId = await seedUser();
    // Simulate a row that already has an assignment set — since no
    // production writer sets this column, the precondition is established
    // via a direct DB write, not via any application code path.
    const [created] = await db
      .insert(courierRequests)
      .values({ customerName: "Assignment Containment Update Test C", assignedToUserId: preAssignedUserId })
      .returning();
    createdRequestIds.push(created.id);
    const attackerUserId = await seedUser();

    await repo.updateRequest(created.id, {
      customerName: "Assignment Containment Update Test C - edited",
      assignedToUserId: attackerUserId,
    });

    const [row] = await db.select().from(courierRequests).where(eq(courierRequests.id, created.id));
    expect(row.assignedToUserId).toBe(preAssignedUserId);
  });
});
