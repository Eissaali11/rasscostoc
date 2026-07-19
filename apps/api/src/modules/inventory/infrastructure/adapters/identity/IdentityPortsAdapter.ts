import type { IUserRepository } from "@stockpro/contracts";
import type { IdentityUserReadPort, UserDisplayView } from "../../../application/ports/IdentityUserReadPort";
import type {
  TechnicianEligibilityPort,
  TechnicianDirectoryView,
  TechnicianEligibilityResult,
} from "../../../application/ports/TechnicianEligibilityPort";
import type { IdentityStatsPort } from "../../../application/ports/IdentityStatsPort";
import type { IdentityUserRestorePort, RestoreUserPayload } from "../../../application/ports/IdentityUserRestorePort";

function toDisplayView(u: { id: string; fullName: string; username: string; city: string | null; profileImage: string | null; regionId: string | null; role: string | null }): UserDisplayView {
  return {
    id: u.id,
    fullName: u.fullName,
    username: u.username,
    city: u.city,
    profileImage: u.profileImage,
    regionId: u.regionId,
    role: u.role,
  };
}

function toDirectoryView(u: { id: string; fullName: string; username: string; city: string | null; regionId: string | null }): TechnicianDirectoryView {
  return {
    id: u.id,
    fullName: u.fullName,
    username: u.username,
    city: u.city,
    regionId: u.regionId,
  };
}

/**
 * ERP-005A-4 Phase 4 — the single adapter implementing all four inventory-owned
 * identity ports, backed by identity's own IUserRepository (from
 * @stockpro/contracts, already a neutral, published contract — not an
 * internal identity import). Wired in the composition root only.
 */
export class IdentityPortsAdapter
  implements
    IdentityUserReadPort,
    TechnicianEligibilityPort,
    IdentityStatsPort,
    IdentityUserRestorePort
{
  constructor(private readonly userRepository: IUserRepository) {}

  // ── IdentityUserReadPort ──────────────────────────────────────────────
  async getUsersByIds(ids: readonly string[]): Promise<ReadonlyMap<string, UserDisplayView>> {
    if (ids.length === 0) return new Map();
    const uniqueIds = [...new Set(ids)];
    const users = await this.userRepository.getUsersByIds(uniqueIds);
    return new Map(users.map((u) => [u.id, toDisplayView(u)]));
  }

  async getUserById(id: string): Promise<UserDisplayView | null> {
    const user = await this.userRepository.getUser(id);
    return user ? toDisplayView(user) : null;
  }

  async searchUserIdsByName(term: string): Promise<ReadonlyArray<string>> {
    return this.userRepository.searchUserIdsByName(term);
  }

  // ── TechnicianEligibilityPort ─────────────────────────────────────────
  async verifyTechnicianEligibility(
    userId: string,
    allowedRoles: readonly string[]
  ): Promise<TechnicianEligibilityResult> {
    const eligible = await this.userRepository.userExistsWithRole(userId, allowedRoles);
    if (!eligible) return { userId, eligible: false, role: null };
    const user = await this.userRepository.getUser(userId);
    return { userId, eligible: true, role: user?.role ?? null };
  }

  async listTechnicians(filters?: { regionId?: string }): Promise<ReadonlyArray<TechnicianDirectoryView>> {
    const users = filters?.regionId
      ? await this.userRepository.getUsersByRegion(filters.regionId)
      : await this.userRepository.getUsersByRole("technician");
    const scoped = filters?.regionId
      ? users.filter((u) => u.role === "technician")
      : users;
    return scoped.map(toDirectoryView);
  }

  async getUserIdsByRegion(regionId: string): Promise<ReadonlyArray<string>> {
    const users = await this.userRepository.getUsersByRegion(regionId);
    return users.map((u) => u.id);
  }

  async getUserRegionId(userId: string): Promise<string | null> {
    return this.userRepository.getUserRegionId(userId);
  }

  async regionHasAssignedUsers(regionId: string): Promise<boolean> {
    return this.userRepository.userExistsInRegion(regionId);
  }

  async findTechnicianByCodeOrName(code: string): Promise<TechnicianDirectoryView | null> {
    const user = await this.userRepository.getUserByUsernameOrFullNameCI(code);
    return user ? toDirectoryView(user) : null;
  }

  // ── IdentityStatsPort ──────────────────────────────────────────────────
  async getUserCountsByRole(): Promise<Readonly<Record<string, number>>> {
    return this.userRepository.getUserCountsByRole();
  }

  async getActiveUserStats(): Promise<{ total: number; active: number }> {
    return this.userRepository.getActiveUserStats();
  }

  async getUserCountsByRegion(): Promise<ReadonlyArray<{ regionId: string | null; count: number }>> {
    return this.userRepository.getUserCountsByRegion();
  }

  async getUserCountsByRegionAndRole(): Promise<ReadonlyArray<{ regionId: string | null; role: string; count: number }>> {
    return this.userRepository.getUserCountsByRegionAndRole();
  }

  async getDistinctUserCityCount(): Promise<number> {
    return this.userRepository.getDistinctUserCityCount();
  }

  // ── IdentityUserRestorePort ────────────────────────────────────────────
  async restoreUser(payload: RestoreUserPayload, tx?: unknown): Promise<{ id: string }> {
    return this.userRepository.restoreUserFromBackup(payload, tx);
  }

  async getAllUsersForBackup() {
    return this.userRepository.getAllUsersForBackup();
  }
}
