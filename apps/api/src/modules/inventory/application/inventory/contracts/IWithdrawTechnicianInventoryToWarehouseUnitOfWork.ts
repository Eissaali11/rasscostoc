/**
 * DB-R1 / Phase C4.6C.2 — atomic withdrawal unit of work contract.
 *
 * The withdrawal touches four inventory representations
 * (technician_moving_inventory_entries, technicians_inventory legacy,
 * warehouse_inventory_entries, warehouse_inventory legacy) plus
 * system_logs. All five must commit or roll back together. This
 * transactional context exposes lock-then-read primitives so the use
 * case can acquire deterministic row locks BEFORE re-checking balances,
 * closing the read-then-write race confirmed in Phase C4.6C.1.
 */
export type InventoryEntry = {
  itemTypeId: string;
  boxes: number;
  units: number;
};

/**
 * Locks the single `warehouses` row for the given id (SELECT ... FOR
 * UPDATE) and returns its id. This row is guaranteed to exist for any
 * warehouseId that has already passed the use case's existence check,
 * making it a safe, always-present serialization anchor for ALL
 * concurrent withdrawals targeting the same warehouse -- regardless of
 * whether a warehouse_inventory_entries row for the specific item type
 * exists yet.
 */
export interface IWarehouseLockRepository {
  lockWarehouse(warehouseId: string): Promise<{ id: string } | undefined>;
}

export interface ITechnicianMovingInventoryLockRepository {
  /** SELECT ... FOR UPDATE, creating the row first (boxes=0, units=0) if absent. */
  lockOrCreateEntry(technicianId: string, itemTypeId: string): Promise<InventoryEntry>;
  setEntry(technicianId: string, itemTypeId: string, boxes: number, units: number): Promise<void>;
}

export interface IWarehouseMovingInventoryLockRepository {
  /** SELECT ... FOR UPDATE, creating the row first (boxes=0, units=0) if absent. */
  lockOrCreateEntry(warehouseId: string, itemTypeId: string): Promise<InventoryEntry>;
  setEntry(warehouseId: string, itemTypeId: string, boxes: number, units: number): Promise<void>;
}

export interface ILegacyTechnicianInventoryLockRepository {
  /** SELECT ... FOR UPDATE by createdBy=technicianId; undefined if the technician has no legacy row. */
  lockLegacyInventory(technicianId: string): Promise<Record<string, unknown> | undefined>;
  updateLegacyInventory(technicianId: string, updates: Record<string, number>): Promise<void>;
}

export interface ILegacyWarehouseInventoryLockRepository {
  /** SELECT ... FOR UPDATE by warehouseId; undefined if the warehouse has no legacy row. */
  lockLegacyInventory(warehouseId: string): Promise<Record<string, unknown> | undefined>;
  updateLegacyInventory(warehouseId: string, updates: Record<string, number>): Promise<void>;
}

export type WithdrawTechnicianInventoryToWarehouseTransactionalContext = {
  warehouseLock: IWarehouseLockRepository;
  technicianMovingInventory: ITechnicianMovingInventoryLockRepository;
  warehouseMovingInventory: IWarehouseMovingInventoryLockRepository;
  legacyTechnicianInventory: ILegacyTechnicianInventoryLockRepository;
  legacyWarehouseInventory: ILegacyWarehouseInventoryLockRepository;
};

export interface IWithdrawTechnicianInventoryToWarehouseUnitOfWork {
  execute<T>(
    work: (context: WithdrawTechnicianInventoryToWarehouseTransactionalContext) => Promise<T>
  ): Promise<T>;
}
