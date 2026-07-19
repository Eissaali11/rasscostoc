import type { IUserRepository } from "@stockpro/contracts";
import type {
  AccountingIdentityLookupPort,
  AccountingTechnicianView,
} from "../../../application/ports/AccountingIdentityLookupPort";

function toTechnicianView(u: { id: string; fullName: string; regionId: string | null }): AccountingTechnicianView {
  return { id: u.id, fullName: u.fullName, regionId: u.regionId };
}

/**
 * ERP-005A-4 Phase 5 — backs AccountingIdentityLookupPort with identity's
 * own IUserRepository (from @stockpro/contracts, the same neutral, already-
 * published contract Phase 4's IdentityPortsAdapter uses). No changes were
 * needed to IUserRepository/DrizzleUserRepository — Phase 4 already added
 * getUsersByIds and getUsersByRegion, which cover everything this port
 * needs. Wired in the composition root only.
 */
export class AccountingIdentityPortAdapter implements AccountingIdentityLookupPort {
  constructor(private readonly userRepository: IUserRepository) {}

  async getTechniciansByIds(ids: readonly string[]): Promise<ReadonlyMap<string, AccountingTechnicianView>> {
    if (ids.length === 0) return new Map();
    const uniqueIds = [...new Set(ids)];
    const users = await this.userRepository.getUsersByIds(uniqueIds);
    return new Map(users.map((u) => [u.id, toTechnicianView(u)]));
  }

  async getTechnicianIdsInRegion(regionId: string): Promise<ReadonlySet<string>> {
    const users = await this.userRepository.getUsersByRegion(regionId);
    return new Set(users.map((u) => u.id));
  }
}
