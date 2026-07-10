// Repository Implementations and Interfaces
export * from './WarehouseRepository';
export * from './WarehouseInventoryRepository';
export * from './TechnicianInventoryRepository';
export * from './InventoryRequestsRepository';
export * from './TransferRepository';
export * from './TransferQueryRepository';
export * from './TransferExecutionRepository';
export * from './SystemLogsRepository';
export * from './DrizzleRegionRepository';
export * from './DrizzleDevicesRepository';
export * from './DrizzleTransactionsRepository';
export * from './DrizzleWarehouseRepository';

// Import all implementations
import { WarehouseInventoryRepository } from './WarehouseInventoryRepository';
import { TechnicianInventoryRepository } from './TechnicianInventoryRepository';
import { InventoryRequestsRepository } from './InventoryRequestsRepository';
import { TransferRepository } from './TransferRepository';
import { SystemLogsRepository } from './SystemLogsRepository';
import { DrizzleRegionRepository } from './DrizzleRegionRepository';
import { DrizzleDevicesRepository } from './DrizzleDevicesRepository';
import { DrizzleTransactionsRepository } from './DrizzleTransactionsRepository';
import { DrizzleWarehouseRepository } from './DrizzleWarehouseRepository';

// Repository Instances (Singleton pattern)
export const repositories = {
  warehouse: new DrizzleWarehouseRepository(),
  warehouseInventory: new WarehouseInventoryRepository(),
  technicianInventory: new TechnicianInventoryRepository(),
  inventoryRequests: new InventoryRequestsRepository(),
  transfer: new TransferRepository(),
  systemLogs: new SystemLogsRepository(),
  region: new DrizzleRegionRepository(),
  devices: new DrizzleDevicesRepository(),
  transactions: new DrizzleTransactionsRepository(),
};

// Type definitions for the repository container
export type Repositories = typeof repositories;

// Default export for convenience
export default repositories;