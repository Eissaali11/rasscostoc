import { eq } from 'drizzle-orm';
import { getDatabase } from "@core/database/connection";
import type { ISupervisorUsersReadRepository } from '@stockpro/contracts';
import {
  technicianFixedInventories,
  techniciansInventory,
  type TechnicianFixedInventory,
  type TechnicianInventory,
  type UserSafe,
} from "@shared/schema";
import { UserRepository } from "@modules/identity/infrastructure/database/UserRepository";

export class DrizzleSupervisorUsersReadRepository implements ISupervisorUsersReadRepository {
  private readonly users = new UserRepository();

  private get db() {
    return getDatabase();
  }

  async getUserById(id: string): Promise<UserSafe | undefined> {
    return this.users.getUser(id);
  }

  async getTechnicianFixedInventory(technicianId: string): Promise<TechnicianFixedInventory | undefined> {
    const [inventory] = await this.db
      .select()
      .from(technicianFixedInventories)
      .where(eq(technicianFixedInventories.technicianId, technicianId));

    return inventory || undefined;
  }

  async getTechnicianMovingInventory(technicianId: string): Promise<TechnicianInventory | undefined> {
    const [inventory] = await this.db
      .select()
      .from(techniciansInventory)
      .where(eq(techniciansInventory.createdBy, technicianId));

    return inventory || undefined;
  }
}