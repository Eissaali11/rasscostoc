import { eq, inArray } from 'drizzle-orm';
import { techniciansInventory, warehouseInventory, warehouseTransfers } from "@shared/schema";
import type {
  IWarehouseTransferAdminRepository,
  LegacyStockSnapshot,
  WarehouseTransferAdminRecord,
} from "@modules/inventory/application/inventory/contracts/IWarehouseTransferAdminRepository";
import { getInventoryIdentityPorts } from "../adapters/identity/identity-ports.registry";

export class DrizzleWarehouseTransferAdminRepository implements IWarehouseTransferAdminRepository {
  constructor(private readonly executor: any) {}

  async getTransfersByIds(ids: string[]): Promise<WarehouseTransferAdminRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.executor
      .select({
        id: warehouseTransfers.id,
        warehouseId: warehouseTransfers.warehouseId,
        technicianId: warehouseTransfers.technicianId,
        itemType: warehouseTransfers.itemType,
        packagingType: warehouseTransfers.packagingType,
        quantity: warehouseTransfers.quantity,
        status: warehouseTransfers.status,
      })
      .from(warehouseTransfers)
      .where(inArray(warehouseTransfers.id, ids));

    return rows.map((row: any) => ({
      ...row,
      packagingType: row.packagingType as 'box' | 'unit',
    }));
  }

  async getWarehouseInventoryByWarehouseId(warehouseId: string): Promise<LegacyStockSnapshot | undefined> {
    const [row] = await this.executor
      .select({
        n950Boxes: warehouseInventory.n950Boxes,
        n950Units: warehouseInventory.n950Units,
        i9000sBoxes: warehouseInventory.i9000sBoxes,
        i9000sUnits: warehouseInventory.i9000sUnits,
        i9100Boxes: warehouseInventory.i9100Boxes,
        i9100Units: warehouseInventory.i9100Units,
        rollPaperBoxes: warehouseInventory.rollPaperBoxes,
        rollPaperUnits: warehouseInventory.rollPaperUnits,
        stickersBoxes: warehouseInventory.stickersBoxes,
        stickersUnits: warehouseInventory.stickersUnits,
        newBatteriesBoxes: warehouseInventory.newBatteriesBoxes,
        newBatteriesUnits: warehouseInventory.newBatteriesUnits,
        mobilySimBoxes: warehouseInventory.mobilySimBoxes,
        mobilySimUnits: warehouseInventory.mobilySimUnits,
        stcSimBoxes: warehouseInventory.stcSimBoxes,
        stcSimUnits: warehouseInventory.stcSimUnits,
        zainSimBoxes: warehouseInventory.zainSimBoxes,
        zainSimUnits: warehouseInventory.zainSimUnits,
        lebaraBoxes: warehouseInventory.lebaraBoxes,
        lebaraUnits: warehouseInventory.lebaraUnits,
      })
      .from(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, warehouseId));

    return row || undefined;
  }

  async updateWarehouseInventoryByWarehouseId(warehouseId: string, updates: LegacyStockSnapshot): Promise<void> {
    await this.executor
      .update(warehouseInventory)
      .set(updates)
      .where(eq(warehouseInventory.warehouseId, warehouseId));
  }

  async getTechnicianFullNameById(technicianId: string): Promise<string | undefined> {
    const user = await getInventoryIdentityPorts().getUserById(technicianId);
    return user?.fullName || undefined;
  }

  async getTechnicianMovingInventoryByName(technicianName: string): Promise<LegacyStockSnapshot | undefined> {
    const [row] = await this.executor
      .select({
        n950Boxes: techniciansInventory.n950Boxes,
        n950Units: techniciansInventory.n950Units,
        i9000sBoxes: techniciansInventory.i9000sBoxes,
        i9000sUnits: techniciansInventory.i9000sUnits,
        i9100Boxes: techniciansInventory.i9100Boxes,
        i9100Units: techniciansInventory.i9100Units,
        rollPaperBoxes: techniciansInventory.rollPaperBoxes,
        rollPaperUnits: techniciansInventory.rollPaperUnits,
        stickersBoxes: techniciansInventory.stickersBoxes,
        stickersUnits: techniciansInventory.stickersUnits,
        newBatteriesBoxes: techniciansInventory.newBatteriesBoxes,
        newBatteriesUnits: techniciansInventory.newBatteriesUnits,
        mobilySimBoxes: techniciansInventory.mobilySimBoxes,
        mobilySimUnits: techniciansInventory.mobilySimUnits,
        stcSimBoxes: techniciansInventory.stcSimBoxes,
        stcSimUnits: techniciansInventory.stcSimUnits,
        zainSimBoxes: techniciansInventory.zainSimBoxes,
        zainSimUnits: techniciansInventory.zainSimUnits,
        lebaraBoxes: techniciansInventory.lebaraBoxes,
        lebaraUnits: techniciansInventory.lebaraUnits,
      })
      .from(techniciansInventory)
      .where(eq(techniciansInventory.technicianName, technicianName));

    return row || undefined;
  }

  async updateTechnicianMovingInventoryByName(technicianName: string, updates: LegacyStockSnapshot): Promise<void> {
    await this.executor
      .update(techniciansInventory)
      .set(updates)
      .where(eq(techniciansInventory.technicianName, technicianName));
  }

  async deleteTransfersByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.executor
      .delete(warehouseTransfers)
      .where(inArray(warehouseTransfers.id, ids));
  }
}
