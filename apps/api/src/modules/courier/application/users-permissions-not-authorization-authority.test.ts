// OPS-PERM-S1-F2 — users.permissions is NOT an authorization authority.
//
// FROZEN POLICY under test: the legacy `users.permissions` column is free-text
// profile storage. It must never grant page access, action access, data scope,
// sensitive-field access, override a role ceiling, or act as an authorization
// fallback.
//
// The one production consumer that violated this was CourierService
// .getRequestAuditLogs, whose `allowSensitive` flag admitted any actor whose
// permissions array contained the literal string "audit:sensitive". That column
// is written from arbitrary `extraProfile` JSON by the user create/update path
// (users.controller.ts), so a profile field could confer a security capability
// invisible to any permissions UI.
//
// `allowSensitive` gates exactly two fields in the formatted DTO —
// `ipAddress` and `deviceId` (audit-log-formatter.ts) — so these tests assert on
// those fields rather than on an internal boolean.
//
// Pure mocked-repository unit tests; no database required.
import { describe, expect, it, vi } from "vitest";
import { CourierService } from "./courier.service";

const SENSITIVE_IP = "203.0.113.77";
const SENSITIVE_DEVICE = "device-abc-123";

function makeService() {
  const requestsRepo: any = {
    getAuditLogsForRecord: vi.fn(async () => ({
      rows: [
        {
          id: 1,
          requestId: 1,
          status: "SUCCESS",
          changedBy: "someone",
          changedAt: new Date("2026-01-01T00:00:00Z"),
          ipAddress: SENSITIVE_IP,
          deviceId: SENSITIVE_DEVICE,
        },
      ],
      total: 1,
    })),
  };
  const service = new CourierService(
    {} as any,
    requestsRepo,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );
  return { service, requestsRepo };
}

async function sensitiveFieldsFor(requestingUser: any) {
  const { service } = makeService();
  const result = await service.getRequestAuditLogs(1, {}, requestingUser);
  const item: any = result.items[0];
  return { ipAddress: item.ipAddress, deviceId: item.deviceId };
}

describe("OPS-PERM-S1-F2 — users.permissions is not an authorization authority", () => {
  describe("legacy permissions text cannot grant sensitive access", () => {
    it('a technician carrying "audit:sensitive" is DENIED the sensitive fields', async () => {
      const fields = await sensitiveFieldsFor({
        id: "u1",
        role: "technician",
        permissions: ["audit:sensitive"],
      });
      expect(fields.ipAddress).toBeNull();
      expect(fields.deviceId).toBeNull();
    });

    it('a viewer carrying "audit:sensitive" is DENIED', async () => {
      const fields = await sensitiveFieldsFor({
        id: "u2",
        role: "viewer",
        permissions: ["audit:sensitive"],
      });
      expect(fields.ipAddress).toBeNull();
      expect(fields.deviceId).toBeNull();
    });

    it('a warehouse role carrying "audit:sensitive" is DENIED', async () => {
      const fields = await sensitiveFieldsFor({
        id: "u3",
        role: "warehouse",
        permissions: ["audit:sensitive"],
      });
      expect(fields.ipAddress).toBeNull();
      expect(fields.deviceId).toBeNull();
    });

    it("courier_supervisor cannot obtain supervisor-only sensitive access via permissions", async () => {
      // courier_supervisor is a legacy compatibility role and shares ROLE_ORDER 3
      // with supervisor, so any check that is not an exact string comparison would
      // admit it. It must be denied both by role and by the removed permissions path.
      const withPerm = await sensitiveFieldsFor({
        id: "u4",
        role: "courier_supervisor",
        permissions: ["audit:sensitive"],
      });
      expect(withPerm.ipAddress).toBeNull();
      expect(withPerm.deviceId).toBeNull();

      const withoutPerm = await sensitiveFieldsFor({ id: "u4", role: "courier_supervisor" });
      expect(withoutPerm.ipAddress).toBeNull();
      expect(withoutPerm.deviceId).toBeNull();
    });

    it("an unrecognized future role carrying the string is DENIED (fail closed)", async () => {
      const fields = await sensitiveFieldsFor({
        id: "u5",
        role: "some_future_role",
        permissions: ["audit:sensitive"],
      });
      expect(fields.ipAddress).toBeNull();
      expect(fields.deviceId).toBeNull();
    });
  });

  describe("legitimate role-based access is preserved, and is independent of permissions", () => {
    it("admin still receives the sensitive fields", async () => {
      const fields = await sensitiveFieldsFor({ id: "a1", role: "admin" });
      expect(fields.ipAddress).toBe(SENSITIVE_IP);
      expect(fields.deviceId).toBe(SENSITIVE_DEVICE);
    });

    it("supervisor still receives the sensitive fields", async () => {
      const fields = await sensitiveFieldsFor({ id: "s1", role: "supervisor" });
      expect(fields.ipAddress).toBe(SENSITIVE_IP);
      expect(fields.deviceId).toBe(SENSITIVE_DEVICE);
    });

    it("removing or emptying permissions does NOT revoke an already-authorized admin", async () => {
      for (const permissions of [undefined, null, [], ["something:else"]]) {
        const fields = await sensitiveFieldsFor({ id: "a2", role: "admin", permissions });
        expect(fields.ipAddress).toBe(SENSITIVE_IP);
        expect(fields.deviceId).toBe(SENSITIVE_DEVICE);
      }
    });
  });

  describe("malformed / profile-shaped values have zero authorization effect", () => {
    it("a raw JSON string is not treated as a permission grant", async () => {
      const fields = await sensitiveFieldsFor({
        id: "m1",
        role: "technician",
        permissions: '["audit:sensitive"]',
      });
      expect(fields.ipAddress).toBeNull();
      expect(fields.deviceId).toBeNull();
    });

    it("an extraProfile-shaped object cannot grant access", async () => {
      // users.controller.ts writes JSON.stringify(extraProfile) into this column,
      // so an object shape is the realistic production value.
      const fields = await sensitiveFieldsFor({
        id: "m2",
        role: "technician",
        permissions: { department: "ops", note: "audit:sensitive" },
      });
      expect(fields.ipAddress).toBeNull();
      expect(fields.deviceId).toBeNull();
    });

    it("a missing requestingUser fails closed", async () => {
      const fields = await sensitiveFieldsFor(undefined);
      expect(fields.ipAddress).toBeNull();
      expect(fields.deviceId).toBeNull();
    });
  });

  describe("scope boundaries are unchanged", () => {
    it("the record filter is still applied to the repository, not widened", async () => {
      const { service, requestsRepo } = makeService();
      await service.getRequestAuditLogs(42, { page: 2, limit: 5 }, { id: "a3", role: "admin" });
      expect(requestsRepo.getAuditLogsForRecord).toHaveBeenCalledWith(42, { page: 2, limit: 5 });
    });
  });
});
