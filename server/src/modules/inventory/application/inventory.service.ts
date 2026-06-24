import { db } from "@core/config/db";
import { 
  inventoryItems, 
  regions,
  type InventoryItem,
  type InsertInventoryItem,
  type InventoryItemWithStatus
} from "@shared/schema";
import { eq, desc, and, or, ilike } from "drizzle-orm";

/**
 * Inventory Management Service
 * Handles all inventory-related operations
 */
export class InventoryService {
  
  private getItemStatus(item: InventoryItem): 'available' | 'low' | 'out' {
    if (item.quantity === 0) return 'out';
    if (item.quantity <= item.minThreshold) return 'low';
    return 'available';
  }

  /**
   * Get all inventory items with status
   */
  async getInventoryItems(): Promise<InventoryItemWithStatus[]> {
    const items = await db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        type: inventoryItems.type,
        unit: inventoryItems.unit,
        quantity: inventoryItems.quantity,
        minThreshold: inventoryItems.minThreshold,
        technicianName: inventoryItems.technicianName,
        city: inventoryItems.city,
        regionId: inventoryItems.regionId,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
        regionName: regions.name,
      })
      .from(inventoryItems)
      .leftJoin(regions, eq(inventoryItems.regionId, regions.id));

    return items.map(item => ({
      ...item,
      regionName: item.regionName || "غير محدد",
      status: this.getItemStatus(item)
    }));
  }

  /**
   * Get single inventory item by ID
   */
  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id));
    return item || undefined;
  }

  /**
   * Create new inventory item
   */
  async createInventoryItem(insertItem: InsertInventoryItem): Promise<InventoryItem> {
    const [newItem] = await db
      .insert(inventoryItems)
      .values(insertItem)
      .returning();
    
    if (!newItem) {
      throw new Error("Failed to create inventory item");
    }
    
    return newItem;
  }

  /**
   * Update inventory item
   */
  async updateInventoryItem(id: string, updates: Partial<InsertInventoryItem>): Promise<InventoryItem> {
    const [updatedItem] = await db
      .update(inventoryItems)
      .set(updates)
      .where(eq(inventoryItems.id, id))
      .returning();
    
    if (!updatedItem) {
      throw new Error("Inventory item not found");
    }
    
    return updatedItem;
  }

  /**
   * Delete inventory item
   */
  async deleteInventoryItem(id: string): Promise<boolean> {
    const result = await db
      .delete(inventoryItems)
      .where(eq(inventoryItems.id, id));
    
    return (result as any).changes > 0;
  }

  /**
   * Search inventory items
   */
  async searchInventoryItems(query: string, regionId?: string): Promise<InventoryItemWithStatus[]> {
    let whereConditions = or(
      ilike(inventoryItems.name, `%${query}%`),
      ilike(inventoryItems.type, `%${query}%`),
      ilike(inventoryItems.technicianName, `%${query}%`),
      ilike(inventoryItems.city, `%${query}%`)
    );

    if (regionId) {
      whereConditions = and(whereConditions, eq(inventoryItems.regionId, regionId));
    }

    const items = await db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        type: inventoryItems.type,
        unit: inventoryItems.unit,
        quantity: inventoryItems.quantity,
        minThreshold: inventoryItems.minThreshold,
        technicianName: inventoryItems.technicianName,
        city: inventoryItems.city,
        regionId: inventoryItems.regionId,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
        regionName: regions.name,
      })
      .from(inventoryItems)
      .leftJoin(regions, eq(inventoryItems.regionId, regions.id))
      .where(whereConditions);

    return items.map(item => ({
      ...item,
      regionName: item.regionName || "غير محدد",
      status: this.getItemStatus(item)
    }));
  }

  /**
   * Get inventory items by region
   */
  async getInventoryItemsByRegion(regionId: string): Promise<InventoryItemWithStatus[]> {
    const items = await db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        type: inventoryItems.type,
        unit: inventoryItems.unit,
        quantity: inventoryItems.quantity,
        minThreshold: inventoryItems.minThreshold,
        technicianName: inventoryItems.technicianName,
        city: inventoryItems.city,
        regionId: inventoryItems.regionId,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
        regionName: regions.name,
      })
      .from(inventoryItems)
      .leftJoin(regions, eq(inventoryItems.regionId, regions.id))
      .where(eq(inventoryItems.regionId, regionId));

    return items.map(item => ({
      ...item,
      regionName: item.regionName || "غير محدد",
      status: this.getItemStatus(item)
    }));
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(): Promise<InventoryItemWithStatus[]> {
    const items = await this.getInventoryItems();
    return items.filter(item => item.status === 'low' || item.status === 'out');
  }

  /**
   * Update item quantity
   */
  async updateItemQuantity(id: string, newQuantity: number): Promise<InventoryItem> {
    if (newQuantity < 0) {
      throw new Error("Quantity cannot be negative");
    }

    return this.updateInventoryItem(id, {
      quantity: newQuantity,
    });
  }

  /**
   * Adjust item quantity (add or subtract)
   */
  async adjustItemQuantity(id: string, adjustment: number): Promise<InventoryItem> {
    const item = await this.getInventoryItem(id);
    if (!item) {
      throw new Error("Item not found");
    }

    const newQuantity = item.quantity + adjustment;
    if (newQuantity < 0) {
      throw new Error("Insufficient quantity");
    }

    return this.updateItemQuantity(id, newQuantity);
  }
}