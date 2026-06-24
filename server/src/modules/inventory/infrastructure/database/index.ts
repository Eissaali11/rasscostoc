// Repository Implementations and Interfaces
export * from "@modules/identity/infrastructure/database/UserRepository";
export * from "@modules/identity/infrastructure/database/SupervisorRepository";
export * from './WarehouseRepository';
export * from './WarehouseInventoryRepository';
export * from './TechnicianInventoryRepository';
export * from './InventoryRequestsRepository';
export * from './TransferRepository';
export * from './TransferQueryRepository';
export * from './TransferExecutionRepository';
export * from './SystemLogsRepository';
export * from "@modules/identity/infrastructure/database/DrizzleUserRepository";
export * from './DrizzleRegionRepository';

// Import all implementations
import { SupervisorRepository } from "@modules/identity/infrastructure/database/SupervisorRepository";
import { WarehouseRepository } from './WarehouseRepository';
import { WarehouseInventoryRepository } from './WarehouseInventoryRepository';
import { TechnicianInventoryRepository } from './TechnicianInventoryRepository';
import { InventoryRequestsRepository } from './InventoryRequestsRepository';
import { TransferRepository } from './TransferRepository';
import { SystemLogsRepository } from './SystemLogsRepository';
import { DrizzleUserRepository } from "@modules/identity/infrastructure/database/DrizzleUserRepository";
import { DrizzleRegionRepository } from './DrizzleRegionRepository';

// Repository Instances (Singleton pattern)
export const repositories = {
  user: new DrizzleUserRepository(),
  supervisor: new SupervisorRepository(),
  warehouse: new WarehouseRepository(),
  warehouseInventory: new WarehouseInventoryRepository(),
  technicianInventory: new TechnicianInventoryRepository(),
  inventoryRequests: new InventoryRequestsRepository(),
  transfer: new TransferRepository(),
  systemLogs: new SystemLogsRepository(),
  region: new DrizzleRegionRepository(),
};

// Type definitions for the repository container
export type Repositories = typeof repositories;

// Default export for convenience
export default repositories;