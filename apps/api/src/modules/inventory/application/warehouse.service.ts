import { 
  type Warehouse,
  type WarehouseInventory,
  type WarehouseTransfer,
  type WarehouseInventoryEntry,
  type InsertWarehouse,
  type InsertWarehouseInventory,
  type InsertWarehouseTransfer,
  type WarehouseWithStats,
  type WarehouseWithInventory,
  type WarehouseTransferWithDetails
} from "@shared/schema";
import type { IWarehouseRepository } from "./warehouse/contracts/IWarehouseRepository";

/**
 * Warehouse Management Service
 * Handles all warehouse-related operations including inventory and transfers
 */
export class WarehouseService {
  constructor(
    private readonly warehouseRepository: IWarehouseRepository
  ) {}

  /**
   * Get all warehouses with statistics
   */
  async getWarehouses(): Promise<WarehouseWithStats[]> {
    return this.warehouseRepository.getWarehouses();
  }

  /**
   * Get single warehouse with inventory
   */
  async getWarehouse(id: string): Promise<WarehouseWithInventory | undefined> {
    return this.warehouseRepository.getWarehouse(id);
  }

  /**
   * Create new warehouse
   */
  async createWarehouse(insertWarehouse: InsertWarehouse, createdBy: string): Promise<Warehouse> {
    return this.warehouseRepository.createWarehouse(insertWarehouse, createdBy);
  }

  /**
   * Update warehouse
   */
  async updateWarehouse(id: string, updates: Partial<InsertWarehouse>): Promise<Warehouse> {
    return this.warehouseRepository.updateWarehouse(id, updates);
  }

  /**
   * Delete warehouse
   */
  async deleteWarehouse(id: string): Promise<boolean> {
    return this.warehouseRepository.deleteWarehouse(id);
  }

  /**
   * Get warehouse inventory
   */
  async getWarehouseInventory(warehouseId: string): Promise<WarehouseInventory | undefined> {
    return this.warehouseRepository.getWarehouseInventory(warehouseId);
  }

  /**
   * Update warehouse inventory
   */
  async updateWarehouseInventory(warehouseId: string, updates: Partial<InsertWarehouseInventory>): Promise<WarehouseInventory> {
    return this.warehouseRepository.updateWarehouseInventory(warehouseId, updates);
  }

  /**
   * Get warehouse inventory entries
   */
  async getWarehouseInventoryEntries(warehouseId: string): Promise<WarehouseInventoryEntry[]> {
    return this.warehouseRepository.getWarehouseInventoryEntries(warehouseId);
  }

  /**
   * Upsert warehouse inventory entry
   */
  async upsertWarehouseInventoryEntry(
    warehouseId: string, 
    itemTypeId: string, 
    boxes: number, 
    units: number
  ): Promise<WarehouseInventoryEntry> {
    return this.warehouseRepository.upsertWarehouseInventoryEntry(warehouseId, itemTypeId, boxes, units);
  }

  /**
   * Get warehouse transfers
   */
  async getWarehouseTransfers(
    warehouseId?: string, 
    technicianId?: string, 
    regionId?: string, 
    limit?: number
  ): Promise<WarehouseTransferWithDetails[]> {
    return this.warehouseRepository.getWarehouseTransfers(warehouseId, technicianId, regionId, limit);
  }

  /**
   * Create warehouse transfer
   */
  async createWarehouseTransfer(data: InsertWarehouseTransfer): Promise<WarehouseTransfer> {
    return this.warehouseRepository.createWarehouseTransfer(data);
  }

  /**
   * Update warehouse transfer status
   */
  async updateWarehouseTransferStatus(id: string, status: string): Promise<WarehouseTransfer> {
    return this.warehouseRepository.updateWarehouseTransferStatus(id, status);
  }

  /**
   * Accept warehouse transfer
   */
  async acceptWarehouseTransfer(id: string): Promise<WarehouseTransfer> {
    return this.updateWarehouseTransferStatus(id, "accepted");
  }

  /**
   * Reject warehouse transfer
   */
  async rejectWarehouseTransfer(id: string, reason?: string): Promise<WarehouseTransfer> {
    return this.warehouseRepository.rejectWarehouseTransfer(id, reason);
  }

  /**
   * Get warehouses by region
   */
  async getWarehousesByRegion(regionId: string): Promise<Warehouse[]> {
    return this.warehouseRepository.getWarehousesByRegion(regionId);
  }

  /**
   * Get active warehouses
   */
  async getActiveWarehouses(): Promise<Warehouse[]> {
    return this.warehouseRepository.getActiveWarehouses();
  }

  /**
   * Search warehouses
   */
  async searchWarehouses(query: string): Promise<WarehouseWithStats[]> {
    return this.warehouseRepository.searchWarehouses(query);
  }
}