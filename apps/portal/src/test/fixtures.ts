/**
 * PHASE B1.3 — Portal Test Foundation: role and API fixtures.
 */
import type { UserSafe } from "@shared/schema";

export type TestRole = "technician" | "supervisor" | "admin";

export function createUserFixture(overrides: Partial<UserSafe> = {}): UserSafe {
  return {
    id: "test-user-id",
    username: "test.user",
    email: "test.user@test.invalid",
    fullName: "Test User",
    profileImage: null,
    city: null,
    role: "technician",
    regionId: null,
    employeeCode: null,
    technicianCode: null,
    department: null,
    permissions: null,
    isActive: true,
    fcmToken: null,
    telegramUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z") as unknown as UserSafe["createdAt"],
    updatedAt: new Date("2026-01-01T00:00:00.000Z") as unknown as UserSafe["updatedAt"],
    ...overrides,
  } as UserSafe;
}

export function createRoleFixture(role: TestRole, overrides: Partial<UserSafe> = {}): UserSafe {
  return createUserFixture({ role, ...overrides });
}

/** A generic { success: true, data } API-response envelope fixture, matching the shape most portal pages expect. */
export function createApiSuccessFixture<T>(data: T) {
  return { success: true, data };
}

/** A generic API error-response fixture. */
export function createApiErrorFixture(code: string, message: string) {
  return { success: false, code, message };
}
