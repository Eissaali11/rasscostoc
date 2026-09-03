import type { IUserRepository } from "@stockpro/contracts";
import type { PermissionActor } from "../domain/types";
import type { IActorLookup } from "../application/PermissionsService";

/** Adapts the existing identity IUserRepository to the narrow read this module needs, rather
 * than the Permission Engine standing up its own user-storage access (OPS-PERM-S1-F3 §7: avoid
 * duplicating domain relationships). */
export class UserRepositoryActorLookup implements IActorLookup {
  constructor(private readonly users: IUserRepository) {}

  async getActor(userId: string): Promise<PermissionActor | undefined> {
    const user = await this.users.getUser(userId);
    if (!user) return undefined;
    return { id: user.id, role: user.role, regionId: user.regionId ?? null, isActive: user.isActive };
  }

  /** Active admins other than `excludingUserId` — feeds the last-active-admin guard. */
  async countOtherActiveAdmins(excludingUserId: string): Promise<number> {
    const admins = await this.users.getUsersByRole("admin");
    return admins.filter((a) => a.id !== excludingUserId && a.isActive).length;
  }
}
