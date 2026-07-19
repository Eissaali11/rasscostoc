import type { ISupervisorUsersReadRepository } from '@stockpro/contracts';
import type { TechnicianFixedInventory, TechnicianInventory, UserSafe } from "@shared/schema";
import { UserRepository } from "@modules/identity/infrastructure/database/UserRepository";
import { getInventoryTechnicianDataPort } from "../adapters/inventory-ports.registry";

export class DrizzleSupervisorUsersReadRepository implements ISupervisorUsersReadRepository {
  private readonly users = new UserRepository();

  async getUserById(id: string): Promise<UserSafe | undefined> {
    return this.users.getUser(id);
  }

  async getTechnicianFixedInventory(technicianId: string): Promise<TechnicianFixedInventory | undefined> {
    const inventory = await getInventoryTechnicianDataPort().getFixedInventoryByTechnicianId(technicianId);
    return inventory || undefined;
  }

  async getTechnicianMovingInventory(technicianId: string): Promise<TechnicianInventory | undefined> {
    const inventory = await getInventoryTechnicianDataPort().getMovingInventoryByCreatedBy(technicianId);
    return inventory || undefined;
  }
}