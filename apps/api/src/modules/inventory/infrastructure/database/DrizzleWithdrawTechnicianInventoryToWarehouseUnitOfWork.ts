import { eq, and } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import {
  warehouses,
  technicianMovingInventoryEntries,
  warehouseInventoryEntries,
  techniciansInventory,
  warehouseInventory,
} from "@shared/schema";
import type {
  IWithdrawTechnicianInventoryToWarehouseUnitOfWork,
  WithdrawTechnicianInventoryToWarehouseTransactionalContext,
  InventoryEntry,
} from "@modules/inventory/application/inventory/contracts/IWithdrawTechnicianInventoryToWarehouseUnitOfWork";

/**
 * DB-R1 / Phase C4.6C.2 — locks the always-existing `warehouses` parent
 * row for the given id. This row is guaranteed to exist by the time the
 * use case reaches the transaction (its own pre-transaction existence
 * check already confirmed it), so it works as a serialization anchor
 * even when the per-item warehouse_inventory_entries row does not exist
 * yet -- unlike SELECT ... FOR UPDATE on a possibly-absent row, which
 * locks nothing.
 */
class DrizzleWarehouseLockRepository {
  constructor(private readonly executor: any) {}

  async lockWarehouse(warehouseId: string) {
    const [row] = await this.executor
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(eq(warehouses.id, warehouseId))
      .for("update");
    return row || undefined;
  }
}

class DrizzleTechnicianMovingInventoryLockRepository {
  constructor(private readonly executor: any) {}

  async lockOrCreateEntry(technicianId: string, itemTypeId: string): Promise<InventoryEntry> {
    const [existing] = await this.executor
      .select({ itemTypeId: technicianMovingInventoryEntries.itemTypeId, boxes: technicianMovingInventoryEntries.boxes, units: technicianMovingInventoryEntries.units })
      .from(technicianMovingInventoryEntries)
      .where(and(
        eq(technicianMovingInventoryEntries.technicianId, technicianId),
        eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
      ))
      .for("update");

    if (existing) return existing;

    // No unique constraint exists on (technicianId, itemTypeId) for this
    // table (schema-change-free zone for this remediation slice -- see
    // C4.6B "moving inventory CHECK" finding, tracked separately). The
    // warehouse-anchor lock acquired earlier in the same transaction
    // already serializes the realistic same-technician/same-warehouse
    // race; a first-ever-row race for the same technician across two
    // DIFFERENT warehouses simultaneously is a narrow residual edge not
    // covered by this insert-if-missing step.
    await this.executor
      .insert(technicianMovingInventoryEntries)
      .values({ technicianId, itemTypeId, boxes: 0, units: 0 });

    const [locked] = await this.executor
      .select({ itemTypeId: technicianMovingInventoryEntries.itemTypeId, boxes: technicianMovingInventoryEntries.boxes, units: technicianMovingInventoryEntries.units })
      .from(technicianMovingInventoryEntries)
      .where(and(
        eq(technicianMovingInventoryEntries.technicianId, technicianId),
        eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
      ))
      .for("update");

    return locked;
  }

  async setEntry(technicianId: string, itemTypeId: string, boxes: number, units: number): Promise<void> {
    await this.executor
      .update(technicianMovingInventoryEntries)
      .set({ boxes, units, updatedAt: new Date() })
      .where(and(
        eq(technicianMovingInventoryEntries.technicianId, technicianId),
        eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
      ));
  }
}

class DrizzleWarehouseMovingInventoryLockRepository {
  constructor(private readonly executor: any) {}

  async lockOrCreateEntry(warehouseId: string, itemTypeId: string): Promise<InventoryEntry> {
    // warehouse_inventory_entries HAS a unique(warehouseId, itemTypeId)
    // constraint (warehouse_inventory_entries_warehouse_item_unique), so
    // this insert-if-missing step is race-free even without the
    // warehouse anchor lock -- the anchor lock is still what serializes
    // the two concurrent transactions' access to this same row.
    await this.executor
      .insert(warehouseInventoryEntries)
      .values({ warehouseId, itemTypeId, boxes: 0, units: 0 })
      .onConflictDoNothing({
        target: [warehouseInventoryEntries.warehouseId, warehouseInventoryEntries.itemTypeId],
      });

    const [locked] = await this.executor
      .select({ itemTypeId: warehouseInventoryEntries.itemTypeId, boxes: warehouseInventoryEntries.boxes, units: warehouseInventoryEntries.units })
      .from(warehouseInventoryEntries)
      .where(and(
        eq(warehouseInventoryEntries.warehouseId, warehouseId),
        eq(warehouseInventoryEntries.itemTypeId, itemTypeId)
      ))
      .for("update");

    return locked;
  }

  async setEntry(warehouseId: string, itemTypeId: string, boxes: number, units: number): Promise<void> {
    await this.executor
      .update(warehouseInventoryEntries)
      .set({ boxes, units, updatedAt: new Date() })
      .where(and(
        eq(warehouseInventoryEntries.warehouseId, warehouseId),
        eq(warehouseInventoryEntries.itemTypeId, itemTypeId)
      ));
  }
}

class DrizzleLegacyTechnicianInventoryLockRepository {
  constructor(private readonly executor: any) {}

  async lockLegacyInventory(technicianId: string) {
    const [row] = await this.executor
      .select()
      .from(techniciansInventory)
      .where(eq(techniciansInventory.createdBy, technicianId))
      .for("update");
    return (row as Record<string, unknown> | undefined) || undefined;
  }

  async updateLegacyInventory(technicianId: string, updates: Record<string, number>) {
    await this.executor
      .update(techniciansInventory)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(techniciansInventory.createdBy, technicianId));
  }
}

class DrizzleLegacyWarehouseInventoryLockRepository {
  constructor(private readonly executor: any) {}

  async lockLegacyInventory(warehouseId: string) {
    const [row] = await this.executor
      .select()
      .from(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, warehouseId))
      .for("update");
    return (row as Record<string, unknown> | undefined) || undefined;
  }

  async updateLegacyInventory(warehouseId: string, updates: Record<string, number>) {
    await this.executor
      .update(warehouseInventory)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(warehouseInventory.warehouseId, warehouseId));
  }
}

export class DrizzleWithdrawTechnicianInventoryToWarehouseUnitOfWork
  implements IWithdrawTechnicianInventoryToWarehouseUnitOfWork
{
  private get db() {
    return getDatabase();
  }

  async execute<T>(
    work: (context: WithdrawTechnicianInventoryToWarehouseTransactionalContext) => Promise<T>
  ): Promise<T> {
    return this.db.transaction(async (tx: any) => {
      const context: WithdrawTechnicianInventoryToWarehouseTransactionalContext = {
        warehouseLock: new DrizzleWarehouseLockRepository(tx),
        technicianMovingInventory: new DrizzleTechnicianMovingInventoryLockRepository(tx),
        warehouseMovingInventory: new DrizzleWarehouseMovingInventoryLockRepository(tx),
        legacyTechnicianInventory: new DrizzleLegacyTechnicianInventoryLockRepository(tx),
        legacyWarehouseInventory: new DrizzleLegacyWarehouseInventoryLockRepository(tx),
      };

      return work(context);
    });
  }
}
