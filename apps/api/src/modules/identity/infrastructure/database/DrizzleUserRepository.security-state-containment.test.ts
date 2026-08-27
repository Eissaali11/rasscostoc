/**
 * OPS-PERM-S0-B1-C.I2A — runtime defense-in-depth proof for
 * DrizzleUserRepository.
 *
 * TypeScript's compile-time containment (OrdinaryUserFieldUpdate excluding
 * isActive/authGeneration, InsertUser excluding authGeneration) is proven
 * separately in UserManagement.use-case.test.ts. This file proves the
 * repository itself cannot be made to write either field even if a caller
 * bypasses the compiler entirely — e.g. an untyped/JavaScript caller, or a
 * value that arrived via `as any`. The unsafe casts below are deliberately
 * test-only, simulating exactly that scenario; no production code performs
 * a cast like this.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../../../core/config/db";
import { users, regions } from "@shared/schema";
import { hashPassword } from "../../../../utils/password";
import { DrizzleUserRepository } from "./DrizzleUserRepository";

describe("DrizzleUserRepository: runtime security-state write containment", () => {
  const repo = new DrizzleUserRepository();
  let regionId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error("Refusing to run: DATABASE_URL does not look like an isolated test database.");
    }
    regionId = randomUUID();
    await db.insert(regions).values({ id: regionId, name: `Containment Test Region ${randomUUID()}` });
  });

  afterEach(async () => {
    await db.delete(users).where(eq(users.regionId, regionId));
  });

  afterAll(async () => {
    await db.delete(regions).where(eq(regions.id, regionId));
  });

  async function makeUser(overrides: Record<string, unknown> = {}) {
    const id = randomUUID();
    const username = `containment.${randomUUID()}`;
    const created = await repo.createUser({
      id,
      username,
      email: `${username}@test.invalid`,
      password: await hashPassword("ContainmentTest!1"),
      fullName: "Containment Test User",
      role: "technician",
      regionId,
      ...overrides,
    } as any);
    return created;
  }

  it("A. createUser ignores an illicit runtime authGeneration value — persisted generation is always 0", async () => {
    // `as any` here simulates a caller that bypassed InsertUser's compile-time
    // omission of authGeneration entirely — never a production pattern.
    const created = await makeUser({ authGeneration: 999 } as any);
    expect(created.authGeneration).toBe(0);

    const [row] = await db.select({ authGeneration: users.authGeneration }).from(users).where(eq(users.id, created.id));
    expect(row.authGeneration).toBe(0);
  });

  it("B. updateUser ignores a runtime payload containing isActive — persisted isActive is unchanged", async () => {
    const created = await makeUser();
    expect(created.isActive).toBe(true);

    // Simulates an untyped caller passing a raw object that TypeScript's
    // OrdinaryUserFieldUpdate would never permit.
    const unsafePayload = { isActive: false, fullName: "Renamed" } as any;
    const updated = await repo.updateUser(created.id, unsafePayload);

    expect(updated.isActive).toBe(true);
    const [row] = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, created.id));
    expect(row.isActive).toBe(true);
  });

  it("C. updateUser ignores a runtime payload containing authGeneration — persisted generation is unchanged", async () => {
    const created = await makeUser();
    expect(created.authGeneration).toBe(0);

    const unsafePayload = { authGeneration: 42, fullName: "Renamed Again" } as any;
    const updated = await repo.updateUser(created.id, unsafePayload);

    expect(updated.authGeneration).toBe(0);
    const [row] = await db.select({ authGeneration: users.authGeneration }).from(users).where(eq(users.id, created.id));
    expect(row.authGeneration).toBe(0);
  });

  it("D. an ordinary legitimate field in the same update still changes successfully", async () => {
    const created = await makeUser();
    const unsafePayload = { isActive: false, authGeneration: 999, fullName: "Legitimately Renamed" } as any;
    const updated = await repo.updateUser(created.id, unsafePayload);

    expect(updated.fullName).toBe("Legitimately Renamed");
    expect(updated.isActive).toBe(true);
    expect(updated.authGeneration).toBe(0);
  });
});
