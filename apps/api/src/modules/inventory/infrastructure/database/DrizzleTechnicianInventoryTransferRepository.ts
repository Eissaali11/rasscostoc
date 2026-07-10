import { and, eq } from 'drizzle-orm';
import {
  technicianFixedInventories,
  technicianFixedInventoryEntries,
  technicianMovingInventoryEntries,
} from "@shared/schema";
import type {
  TechnicianInventoryBalance,
  TransferInventoryType,
} from "@modules/inventory/application/inventory/contracts/ITechnicianInventoryTransferRepository";
import type { TechnicianFixedInventory } from '@shared/schema';

export class DrizzleTechnicianInventoryTransferRepository {
  constructor(private readonly executor: any) {}

  async getBalance(
    technicianId: string,
    itemTypeId: string,
    inventory: TransferInventoryType
  ): Promise<TechnicianInventoryBalance> {
    const table = this.getEntriesTable(inventory);

    const [entry] = await this.executor
      .select({
        boxes: table.boxes,
        units: table.units,
      })
      .from(table)
      .where(and(eq(table.technicianId, technicianId), eq(table.itemTypeId, itemTypeId)));

    return {
      boxes: entry?.boxes ?? 0,
      units: entry?.units ?? 0,
    };
  }

  async setBalance(
    technicianId: string,
    itemTypeId: string,
    inventory: TransferInventoryType,
    balance: TechnicianInventoryBalance
  ): Promise<void> {
    const table = this.getEntriesTable(inventory);

    const [existing] = await this.executor
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.technicianId, technicianId), eq(table.itemTypeId, itemTypeId)));

    if (existing) {
      await this.executor
        .update(table)
        .set({
          boxes: balance.boxes,
          units: balance.units,
          updatedAt: new Date(),
        })
        .where(eq(table.id, existing.id));
      return;
    }

    await this.executor.insert(table).values({
      technicianId,
      itemTypeId,
      boxes: balance.boxes,
      units: balance.units,
    });
  }

  async ensureTechnicianFixedInventory(technicianId: string): Promise<TechnicianFixedInventory> {
    const [existing] = await this.executor
      .select()
      .from(technicianFixedInventories)
      .where(eq(technicianFixedInventories.technicianId, technicianId));

    if (existing) {
      return existing;
    }

    const [created] = await this.executor
      .insert(technicianFixedInventories)
      .values({ technicianId })
      .returning();

    return created;
  }

  private getEntriesTable(inventory: TransferInventoryType) {
    return inventory === 'fixed'
      ? technicianFixedInventoryEntries
      : technicianMovingInventoryEntries;
  }
}
