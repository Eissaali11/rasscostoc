/**
 * OPS-PERM-S1-F4 §0/§7, hardened by R2 — proves applyCanonicalMembershipTransition
 * (the single choke point behind update/softDelete/deactivateUser/bulkDeactivate,
 * reached via the applyCanonicalStatusTransition wrapper for pure isActive
 * transitions) is actually WIRED to the last-active-admin guard for BOTH
 * isActive transitions and role changes — not just that the guard is correct
 * in isolation (see core/authorization/last-active-admin.guard.test.ts for
 * that). Fully mocked transactional context — no database; the real-Postgres
 * concurrency proof lives in
 * infrastructure/repositories/last-active-admin-concurrency.test.ts.
 */
import { describe, expect, it, vi } from "vitest";
import { applyCanonicalStatusTransition, applyCanonicalMembershipTransition } from "./UserManagement.use-case";
import { LastActiveAdminError } from "@core/authorization/last-active-admin.guard";
import type { IdentityTransactionalContext } from "../../../domain/repositories/IIdentityUnitOfWork";

const ACTOR = { id: "actor-1", username: "actor", role: "admin" };

function makeCtx(overrides: {
  target: { isActive: boolean; authGeneration: number; role: string };
  otherAdmins: Array<{ id: string; isActive: boolean }>;
}): IdentityTransactionalContext {
  const { target, otherAdmins } = overrides;
  return {
    userRepository: {
      getUser: vi.fn(async () => ({ role: target.role }) as any),
      getUsersByRole: vi.fn(async () => otherAdmins.map((a) => ({ id: a.id, isActive: a.isActive })) as any),
    } as any,
    refreshTokenRepository: { revokeAllForUser: vi.fn(async () => {}) } as any,
    lockUserForUpdate: vi.fn(async () => ({ isActive: target.isActive, authGeneration: target.authGeneration, role: target.role })),
    updateUserState: vi.fn(async () => {}),
    updateUserRole: vi.fn(async () => {}),
    // No-op in these fully-mocked tests — the real acquisition (and the concurrency guarantee it
    // provides) is proven for real against Postgres in last-active-admin-concurrency.test.ts.
    acquireAdminMembershipLock: vi.fn(async () => {}),
    deleteBearerSessionsForUser: vi.fn(async () => {}),
    deleteExpressSessionsForUser: vi.fn(async () => {}),
    writeAudit: vi.fn(async () => {}),
  };
}

describe("OPS-PERM-S1-F4 — last active admin protection is wired into user deactivation", () => {
  it("deactivating the LAST active admin (zero other active admins) is blocked before any write", async () => {
    const ctx = makeCtx({ target: { isActive: true, authGeneration: 0, role: "admin" }, otherAdmins: [{ id: "target", isActive: true }] });
    await expect(applyCanonicalStatusTransition(ctx, "target", false, ACTOR)).rejects.toBeInstanceOf(LastActiveAdminError);
    expect(ctx.updateUserState).not.toHaveBeenCalled();
    expect(ctx.writeAudit).not.toHaveBeenCalled();
  });

  it("deactivating an admin while another active admin remains is allowed", async () => {
    const ctx = makeCtx({
      target: { isActive: true, authGeneration: 0, role: "admin" },
      otherAdmins: [
        { id: "target", isActive: true },
        { id: "other-admin", isActive: true },
      ],
    });
    await expect(applyCanonicalStatusTransition(ctx, "target", false, ACTOR)).resolves.toBeUndefined();
    expect(ctx.updateUserState).toHaveBeenCalledWith("target", { isActive: false, authGeneration: 1 });
  });

  it("an inactive OTHER admin row does not count toward the safety margin", async () => {
    const ctx = makeCtx({
      target: { isActive: true, authGeneration: 0, role: "admin" },
      otherAdmins: [
        { id: "target", isActive: true },
        { id: "other-admin", isActive: false }, // already inactive — cannot save this deactivation
      ],
    });
    await expect(applyCanonicalStatusTransition(ctx, "target", false, ACTOR)).rejects.toBeInstanceOf(LastActiveAdminError);
  });

  it("deactivating a non-admin (supervisor) role is never subject to this guard", async () => {
    const ctx = makeCtx({ target: { isActive: true, authGeneration: 0, role: "supervisor" }, otherAdmins: [] });
    await expect(applyCanonicalStatusTransition(ctx, "target", false, ACTOR)).resolves.toBeUndefined();
  });

  it("reactivating an admin is never subject to this guard, regardless of other-admin count", async () => {
    const ctx = makeCtx({ target: { isActive: false, authGeneration: 1, role: "admin" }, otherAdmins: [] });
    await expect(applyCanonicalStatusTransition(ctx, "target", true, ACTOR)).resolves.toBeUndefined();
  });
});

describe("OPS-PERM-S1-F4-R2 — last active admin protection is wired into ROLE changes (Blocker 1 fix)", () => {
  it("demoting the LAST active admin's role away from admin is blocked before any write — the exact R1 bypass", async () => {
    const ctx = makeCtx({ target: { isActive: true, authGeneration: 0, role: "admin" }, otherAdmins: [{ id: "target", isActive: true }] });

    await expect(
      applyCanonicalMembershipTransition(ctx, "target", { role: "viewer" }, ACTOR)
    ).rejects.toBeInstanceOf(LastActiveAdminError);

    expect(ctx.updateUserRole).not.toHaveBeenCalled();
    expect(ctx.writeAudit).not.toHaveBeenCalled();
  });

  it("demoting an admin's role while another active admin remains is allowed and persists the new role", async () => {
    const ctx = makeCtx({
      target: { isActive: true, authGeneration: 0, role: "admin" },
      otherAdmins: [
        { id: "target", isActive: true },
        { id: "other-admin", isActive: true },
      ],
    });

    await applyCanonicalMembershipTransition(ctx, "target", { role: "viewer" }, ACTOR);

    expect(ctx.updateUserRole).toHaveBeenCalledWith("target", "viewer");
    // A pure role change never touches isActive/authGeneration.
    expect(ctx.updateUserState).not.toHaveBeenCalled();
  });

  it("promoting a non-admin to admin is never subject to this guard, regardless of admin count", async () => {
    const ctx = makeCtx({ target: { isActive: true, authGeneration: 0, role: "viewer" }, otherAdmins: [] });
    await applyCanonicalMembershipTransition(ctx, "target", { role: "admin" }, ACTOR);
    expect(ctx.updateUserRole).toHaveBeenCalledWith("target", "admin");
  });

  it("a role change to the SAME role the row already has is a no-op — no write, no audit", async () => {
    const ctx = makeCtx({ target: { isActive: true, authGeneration: 0, role: "admin" }, otherAdmins: [{ id: "target", isActive: true }] });
    await applyCanonicalMembershipTransition(ctx, "target", { role: "admin" }, ACTOR);
    expect(ctx.updateUserRole).not.toHaveBeenCalled();
    expect(ctx.writeAudit).not.toHaveBeenCalled();
  });

  it("demoting the last active admin's role while SIMULTANEOUSLY setting isActive=true changes nothing about the outcome — still blocked (role alone would already remove the last admin)", async () => {
    const ctx = makeCtx({ target: { isActive: true, authGeneration: 0, role: "admin" }, otherAdmins: [{ id: "target", isActive: true }] });
    await expect(
      applyCanonicalMembershipTransition(ctx, "target", { role: "viewer", isActive: true }, ACTOR)
    ).rejects.toBeInstanceOf(LastActiveAdminError);
    expect(ctx.updateUserRole).not.toHaveBeenCalled();
  });

  it("demoting the last active admin's role while ALSO deactivating is blocked exactly once (not evaluated as two independent unsafe operations)", async () => {
    const ctx = makeCtx({ target: { isActive: true, authGeneration: 0, role: "admin" }, otherAdmins: [{ id: "target", isActive: true }] });
    await expect(
      applyCanonicalMembershipTransition(ctx, "target", { role: "viewer", isActive: false }, ACTOR)
    ).rejects.toBeInstanceOf(LastActiveAdminError);
    expect(ctx.updateUserRole).not.toHaveBeenCalled();
    expect(ctx.updateUserState).not.toHaveBeenCalled();
    expect(ctx.writeAudit).not.toHaveBeenCalled();
  });

  it("an already-inactive admin can be freely demoted — it was never counted as an active admin", async () => {
    const ctx = makeCtx({ target: { isActive: false, authGeneration: 2, role: "admin" }, otherAdmins: [] });
    await applyCanonicalMembershipTransition(ctx, "target", { role: "viewer" }, ACTOR);
    expect(ctx.updateUserRole).toHaveBeenCalledWith("target", "viewer");
  });
});
