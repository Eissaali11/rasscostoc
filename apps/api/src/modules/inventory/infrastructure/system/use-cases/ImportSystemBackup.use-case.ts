import { getDatabase } from "@core/database/connection";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { hashPassword } from "@server/utils/password";
import {
  inventoryItems,
  itemTypes,
  regions,
  supervisorWarehouses,
  transactions,
  inventoryRequests,
  warehouseInventory,
  warehouseInventoryEntries,
  warehouseTransfers,
  warehouses,
} from "@shared/schema";
import { getInventoryIdentityPorts } from "../../adapters/identity/identity-ports.registry";

type BackupDataset = {
  users?: unknown[];
  regions?: unknown[];
  itemTypes?: unknown[];
  inventoryItems?: unknown[];
  transactions?: unknown[];
  warehouses?: unknown[];
  warehouseInventory?: unknown[];
  warehouseInventoryEntries?: unknown[];
  supervisorWarehouses?: unknown[];
  inventoryRequests?: unknown[];
  warehouseTransfers?: unknown[];
};

export type ImportSummary = {
  users: number;
  regions: number;
  itemTypes: number;
  inventoryItems: number;
  transactions: number;
  warehouses: number;
  warehouseInventory: number;
  warehouseInventoryEntries: number;
  supervisorWarehouses: number;
  inventoryRequests: number;
  warehouseTransfers: number;
};

export class ImportSystemBackupUseCase {
  private asString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private asNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private asBoolean(value: unknown, fallback = true): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return fallback;
  }

  private asDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }

  private normalizeRole(value: unknown): "admin" | "supervisor" | "technician" {
    const role = this.asString(value);
    if (role === "admin" || role === "supervisor" || role === "technician") return role;
    return "technician";
  }

  private normalizeItemTypeCategory(value: unknown): "devices" | "papers" | "sim" | "accessories" {
    const category = this.asString(value);
    if (category === "devices" || category === "papers" || category === "sim" || category === "accessories") {
      return category;
    }
    return "accessories";
  }

  private async normalizeImportedPassword(password: unknown): Promise<string> {
    const raw = this.asString(password);
    if (!raw) {
      return hashPassword(`Temp-${randomUUID()}`);
    }

    // Keep bcrypt hashes as-is, otherwise hash the plain value.
    if (raw.startsWith("$2")) return raw;
    return hashPassword(raw);
  }

  async execute(backup: { data?: Record<string, unknown> }): Promise<ImportSummary> {
    const db = getDatabase();
    const summary: ImportSummary = {
      users: 0,
      regions: 0,
      itemTypes: 0,
      inventoryItems: 0,
      transactions: 0,
      warehouses: 0,
      warehouseInventory: 0,
      warehouseInventoryEntries: 0,
      supervisorWarehouses: 0,
      inventoryRequests: 0,
      warehouseTransfers: 0,
    };

    const data = (backup.data ?? {}) as BackupDataset;

    const importedRegions = Array.isArray(data.regions) ? data.regions : [];
    const importedItemTypes = Array.isArray(data.itemTypes) ? data.itemTypes : [];
    const importedUsers = Array.isArray(data.users) ? data.users : [];
    const importedItems = Array.isArray(data.inventoryItems) ? data.inventoryItems : [];
    const importedTransactions = Array.isArray(data.transactions) ? data.transactions : [];
    const importedWarehouses = Array.isArray(data.warehouses) ? data.warehouses : [];
    const importedWarehouseInventory = Array.isArray(data.warehouseInventory)
      ? data.warehouseInventory
      : [];
    const importedWarehouseInventoryEntries = Array.isArray(data.warehouseInventoryEntries)
      ? data.warehouseInventoryEntries
      : [];
    const importedSupervisorWarehouses = Array.isArray(data.supervisorWarehouses)
      ? data.supervisorWarehouses
      : [];
    const importedInventoryRequests = Array.isArray(data.inventoryRequests)
      ? data.inventoryRequests
      : [];
    const importedWarehouseTransfers = Array.isArray(data.warehouseTransfers)
      ? data.warehouseTransfers
      : [];

    const importedUserIdMap = new Map<string, string>();

    await db.transaction(async (tx) => {
      for (const row of importedRegions) {
        const region = row as Record<string, unknown>;
        const id = this.asString(region.id) ?? randomUUID();
        const name = this.asString(region.name);
        if (!name) continue;

        await tx
          .insert(regions)
          .values({
            id,
            name,
            description: this.asString(region.description),
            isActive: this.asBoolean(region.isActive, true),
            createdAt: this.asDate(region.createdAt),
            updatedAt: this.asDate(region.updatedAt),
          })
          .onConflictDoUpdate({
            target: regions.id,
            set: {
              name,
              description: this.asString(region.description),
              isActive: this.asBoolean(region.isActive, true),
              updatedAt: new Date(),
            },
          });

        summary.regions += 1;
      }

      for (const row of importedUsers) {
        const user = row as Record<string, unknown>;
        const id = this.asString(user.id) ?? randomUUID();
        const username = this.asString(user.username);
        if (!username) continue;

        const password = await this.normalizeImportedPassword(user.password);

        const { id: targetUserId } = await getInventoryIdentityPorts().restoreUser(
          {
            sourceId: id,
            username,
            email: this.asString(user.email),
            password,
            fullName: this.asString(user.fullName),
            profileImage: this.asString(user.profileImage),
            city: this.asString(user.city),
            role: this.normalizeRole(user.role),
            regionId: this.asString(user.regionId),
            isActive: this.asBoolean(user.isActive, true),
            createdAt: this.asDate(user.createdAt),
            updatedAt: this.asDate(user.updatedAt),
          },
          tx
        );

        importedUserIdMap.set(id, targetUserId);

        summary.users += 1;
      }

      for (const row of importedItemTypes) {
        const itemType = row as Record<string, unknown>;
        const id = this.asString(itemType.id) ?? randomUUID();
        const nameAr = this.asString(itemType.nameAr);
        const nameEn = this.asString(itemType.nameEn);
        if (!nameAr || !nameEn) continue;

        const [existingById] = await tx
          .select({ id: itemTypes.id })
          .from(itemTypes)
          .where(eq(itemTypes.id, id))
          .limit(1);

        const [existingByNameAr] = await tx
          .select({ id: itemTypes.id })
          .from(itemTypes)
          .where(eq(itemTypes.nameAr, nameAr))
          .limit(1);

        const [existingByNameEn] = await tx
          .select({ id: itemTypes.id })
          .from(itemTypes)
          .where(eq(itemTypes.nameEn, nameEn))
          .limit(1);

        const targetItemTypeId = existingById?.id ?? existingByNameAr?.id ?? existingByNameEn?.id ?? id;

        const itemTypePayload = {
          nameAr,
          nameEn,
          category: this.normalizeItemTypeCategory(itemType.category),
          unitsPerBox: this.asNumber(itemType.unitsPerBox, 10),
          isActive: this.asBoolean(itemType.isActive, true),
          isVisible: this.asBoolean(itemType.isVisible, true),
          sortOrder: this.asNumber(itemType.sortOrder, 0),
          icon: this.asString(itemType.icon),
          color: this.asString(itemType.color),
        };

        if (existingById || existingByNameAr || existingByNameEn) {
          await tx
            .update(itemTypes)
            .set({
              ...itemTypePayload,
              updatedAt: new Date(),
            })
            .where(eq(itemTypes.id, targetItemTypeId));
        } else {
          await tx
            .insert(itemTypes)
            .values({
              id: targetItemTypeId,
              ...itemTypePayload,
              createdAt: this.asDate(itemType.createdAt),
              updatedAt: this.asDate(itemType.updatedAt),
            });
        }

        summary.itemTypes += 1;
      }

      for (const row of importedWarehouses) {
        const warehouse = row as Record<string, unknown>;
        const id = this.asString(warehouse.id) ?? randomUUID();
        const name = this.asString(warehouse.name);
        const location = this.asString(warehouse.location);
        if (!name || !location) continue;

        const fallbackCreatorRawId = this.asString((importedUsers[0] as Record<string, unknown> | undefined)?.id);
        const fallbackCreatorId = fallbackCreatorRawId
          ? importedUserIdMap.get(fallbackCreatorRawId) ?? fallbackCreatorRawId
          : null;
        const createdByRaw = this.asString(warehouse.createdBy);
        const createdBy = createdByRaw
          ? importedUserIdMap.get(createdByRaw) ?? createdByRaw
          : fallbackCreatorId;
        if (!createdBy) continue;

        await tx
          .insert(warehouses)
          .values({
            id,
            name,
            location,
            description: this.asString(warehouse.description),
            isActive: this.asBoolean(warehouse.isActive, true),
            createdBy,
            regionId: this.asString(warehouse.regionId),
            createdAt: this.asDate(warehouse.createdAt),
            updatedAt: this.asDate(warehouse.updatedAt),
          })
          .onConflictDoUpdate({
            target: warehouses.id,
            set: {
              name,
              location,
              description: this.asString(warehouse.description),
              isActive: this.asBoolean(warehouse.isActive, true),
              createdBy,
              regionId: this.asString(warehouse.regionId),
              updatedAt: new Date(),
            },
          });

        summary.warehouses += 1;
      }

      for (const row of importedWarehouseInventory) {
        const inventory = row as Record<string, unknown>;
        const id = this.asString(inventory.id) ?? randomUUID();
        const warehouseId = this.asString(inventory.warehouseId);
        if (!warehouseId) continue;

        await tx
          .insert(warehouseInventory)
          .values({
            id,
            warehouseId,
            n950Boxes: this.asNumber(inventory.n950Boxes, 0),
            n950Units: this.asNumber(inventory.n950Units, 0),
            i9000sBoxes: this.asNumber(inventory.i9000sBoxes, 0),
            i9000sUnits: this.asNumber(inventory.i9000sUnits, 0),
            i9100Boxes: this.asNumber(inventory.i9100Boxes, 0),
            i9100Units: this.asNumber(inventory.i9100Units, 0),
            rollPaperBoxes: this.asNumber(inventory.rollPaperBoxes, 0),
            rollPaperUnits: this.asNumber(inventory.rollPaperUnits, 0),
            stickersBoxes: this.asNumber(inventory.stickersBoxes, 0),
            stickersUnits: this.asNumber(inventory.stickersUnits, 0),
            newBatteriesBoxes: this.asNumber(inventory.newBatteriesBoxes, 0),
            newBatteriesUnits: this.asNumber(inventory.newBatteriesUnits, 0),
            mobilySimBoxes: this.asNumber(inventory.mobilySimBoxes, 0),
            mobilySimUnits: this.asNumber(inventory.mobilySimUnits, 0),
            stcSimBoxes: this.asNumber(inventory.stcSimBoxes, 0),
            stcSimUnits: this.asNumber(inventory.stcSimUnits, 0),
            zainSimBoxes: this.asNumber(inventory.zainSimBoxes, 0),
            zainSimUnits: this.asNumber(inventory.zainSimUnits, 0),
            lebaraBoxes: this.asNumber(inventory.lebaraBoxes, 0),
            lebaraUnits: this.asNumber(inventory.lebaraUnits, 0),
            updatedAt: this.asDate(inventory.updatedAt),
          })
          .onConflictDoUpdate({
            target: warehouseInventory.id,
            set: {
              warehouseId,
              n950Boxes: this.asNumber(inventory.n950Boxes, 0),
              n950Units: this.asNumber(inventory.n950Units, 0),
              i9000sBoxes: this.asNumber(inventory.i9000sBoxes, 0),
              i9000sUnits: this.asNumber(inventory.i9000sUnits, 0),
              i9100Boxes: this.asNumber(inventory.i9100Boxes, 0),
              i9100Units: this.asNumber(inventory.i9100Units, 0),
              rollPaperBoxes: this.asNumber(inventory.rollPaperBoxes, 0),
              rollPaperUnits: this.asNumber(inventory.rollPaperUnits, 0),
              stickersBoxes: this.asNumber(inventory.stickersBoxes, 0),
              stickersUnits: this.asNumber(inventory.stickersUnits, 0),
              newBatteriesBoxes: this.asNumber(inventory.newBatteriesBoxes, 0),
              newBatteriesUnits: this.asNumber(inventory.newBatteriesUnits, 0),
              mobilySimBoxes: this.asNumber(inventory.mobilySimBoxes, 0),
              mobilySimUnits: this.asNumber(inventory.mobilySimUnits, 0),
              stcSimBoxes: this.asNumber(inventory.stcSimBoxes, 0),
              stcSimUnits: this.asNumber(inventory.stcSimUnits, 0),
              zainSimBoxes: this.asNumber(inventory.zainSimBoxes, 0),
              zainSimUnits: this.asNumber(inventory.zainSimUnits, 0),
              lebaraBoxes: this.asNumber(inventory.lebaraBoxes, 0),
              lebaraUnits: this.asNumber(inventory.lebaraUnits, 0),
              updatedAt: new Date(),
            },
          });

        summary.warehouseInventory += 1;
      }

      for (const row of importedWarehouseInventoryEntries) {
        const entry = row as Record<string, unknown>;
        const id = this.asString(entry.id) ?? randomUUID();
        const warehouseId = this.asString(entry.warehouseId);
        const itemTypeId = this.asString(entry.itemTypeId);
        if (!warehouseId || !itemTypeId) continue;

        await tx
          .insert(warehouseInventoryEntries)
          .values({
            id,
            warehouseId,
            itemTypeId,
            boxes: this.asNumber(entry.boxes, 0),
            units: this.asNumber(entry.units, 0),
            updatedAt: this.asDate(entry.updatedAt),
          })
          .onConflictDoUpdate({
            target: warehouseInventoryEntries.id,
            set: {
              warehouseId,
              itemTypeId,
              boxes: this.asNumber(entry.boxes, 0),
              units: this.asNumber(entry.units, 0),
              updatedAt: new Date(),
            },
          });

        summary.warehouseInventoryEntries += 1;
      }

      for (const row of importedSupervisorWarehouses) {
        const assignment = row as Record<string, unknown>;
        const supervisorIdRaw = this.asString(assignment.supervisorId);
        const supervisorId = supervisorIdRaw
          ? importedUserIdMap.get(supervisorIdRaw) ?? supervisorIdRaw
          : null;
        const warehouseId = this.asString(assignment.warehouseId);
        if (!supervisorId || !warehouseId) continue;

        await tx
          .insert(supervisorWarehouses)
          .values({
            id: this.asString(assignment.id) ?? randomUUID(),
            supervisorId,
            warehouseId,
            createdAt: this.asDate(assignment.createdAt),
          })
          .onConflictDoNothing();

        summary.supervisorWarehouses += 1;
      }

      for (const row of importedInventoryRequests) {
        const request = row as Record<string, unknown>;
        const id = this.asString(request.id) ?? randomUUID();
        const technicianIdRaw = this.asString(request.technicianId);
        const technicianId = technicianIdRaw
          ? importedUserIdMap.get(technicianIdRaw) ?? technicianIdRaw
          : null;
        if (!technicianId) continue;

        const respondedByRaw = this.asString(request.respondedBy);
        const respondedBy = respondedByRaw
          ? importedUserIdMap.get(respondedByRaw) ?? respondedByRaw
          : null;

        await tx
          .insert(inventoryRequests)
          .values({
            id,
            technicianId,
            warehouseId: this.asString(request.warehouseId),
            n950Boxes: this.asNumber(request.n950Boxes, 0),
            n950Units: this.asNumber(request.n950Units, 0),
            i9000sBoxes: this.asNumber(request.i9000sBoxes, 0),
            i9000sUnits: this.asNumber(request.i9000sUnits, 0),
            i9100Boxes: this.asNumber(request.i9100Boxes, 0),
            i9100Units: this.asNumber(request.i9100Units, 0),
            rollPaperBoxes: this.asNumber(request.rollPaperBoxes, 0),
            rollPaperUnits: this.asNumber(request.rollPaperUnits, 0),
            stickersBoxes: this.asNumber(request.stickersBoxes, 0),
            stickersUnits: this.asNumber(request.stickersUnits, 0),
            newBatteriesBoxes: this.asNumber(request.newBatteriesBoxes, 0),
            newBatteriesUnits: this.asNumber(request.newBatteriesUnits, 0),
            mobilySimBoxes: this.asNumber(request.mobilySimBoxes, 0),
            mobilySimUnits: this.asNumber(request.mobilySimUnits, 0),
            stcSimBoxes: this.asNumber(request.stcSimBoxes, 0),
            stcSimUnits: this.asNumber(request.stcSimUnits, 0),
            zainSimBoxes: this.asNumber(request.zainSimBoxes, 0),
            zainSimUnits: this.asNumber(request.zainSimUnits, 0),
            lebaraBoxes: this.asNumber(request.lebaraBoxes, 0),
            lebaraUnits: this.asNumber(request.lebaraUnits, 0),
            notes: this.asString(request.notes),
            status: this.asString(request.status) ?? "pending",
            adminNotes: this.asString(request.adminNotes),
            respondedBy,
            respondedAt: request.respondedAt ? this.asDate(request.respondedAt) : null,
            createdAt: this.asDate(request.createdAt),
          })
          .onConflictDoUpdate({
            target: inventoryRequests.id,
            set: {
              technicianId,
              warehouseId: this.asString(request.warehouseId),
              n950Boxes: this.asNumber(request.n950Boxes, 0),
              n950Units: this.asNumber(request.n950Units, 0),
              i9000sBoxes: this.asNumber(request.i9000sBoxes, 0),
              i9000sUnits: this.asNumber(request.i9000sUnits, 0),
              i9100Boxes: this.asNumber(request.i9100Boxes, 0),
              i9100Units: this.asNumber(request.i9100Units, 0),
              rollPaperBoxes: this.asNumber(request.rollPaperBoxes, 0),
              rollPaperUnits: this.asNumber(request.rollPaperUnits, 0),
              stickersBoxes: this.asNumber(request.stickersBoxes, 0),
              stickersUnits: this.asNumber(request.stickersUnits, 0),
              newBatteriesBoxes: this.asNumber(request.newBatteriesBoxes, 0),
              newBatteriesUnits: this.asNumber(request.newBatteriesUnits, 0),
              mobilySimBoxes: this.asNumber(request.mobilySimBoxes, 0),
              mobilySimUnits: this.asNumber(request.mobilySimUnits, 0),
              stcSimBoxes: this.asNumber(request.stcSimBoxes, 0),
              stcSimUnits: this.asNumber(request.stcSimUnits, 0),
              zainSimBoxes: this.asNumber(request.zainSimBoxes, 0),
              zainSimUnits: this.asNumber(request.zainSimUnits, 0),
              lebaraBoxes: this.asNumber(request.lebaraBoxes, 0),
              lebaraUnits: this.asNumber(request.lebaraUnits, 0),
              notes: this.asString(request.notes),
              status: this.asString(request.status) ?? "pending",
              adminNotes: this.asString(request.adminNotes),
              respondedBy,
              respondedAt: request.respondedAt ? this.asDate(request.respondedAt) : null,
            },
          });

        summary.inventoryRequests += 1;
      }

      for (const row of importedWarehouseTransfers) {
        const transfer = row as Record<string, unknown>;
        const id = this.asString(transfer.id) ?? randomUUID();
        const warehouseId = this.asString(transfer.warehouseId);
        const technicianIdRaw = this.asString(transfer.technicianId);
        const technicianId = technicianIdRaw
          ? importedUserIdMap.get(technicianIdRaw) ?? technicianIdRaw
          : null;
        const performedByRaw = this.asString(transfer.performedBy);
        const performedBy = performedByRaw
          ? importedUserIdMap.get(performedByRaw) ?? performedByRaw
          : null;
        const itemType = this.asString(transfer.itemType);
        const packagingType = this.asString(transfer.packagingType);
        if (!warehouseId || !technicianId || !performedBy || !itemType || !packagingType) continue;

        await tx
          .insert(warehouseTransfers)
          .values({
            id,
            requestId: this.asString(transfer.requestId),
            warehouseId,
            technicianId,
            itemType,
            packagingType,
            quantity: this.asNumber(transfer.quantity, 0),
            performedBy,
            notes: this.asString(transfer.notes),
            status: this.asString(transfer.status) ?? "pending",
            rejectionReason: this.asString(transfer.rejectionReason),
            respondedAt: transfer.respondedAt ? this.asDate(transfer.respondedAt) : null,
            createdAt: this.asDate(transfer.createdAt),
          })
          .onConflictDoUpdate({
            target: warehouseTransfers.id,
            set: {
              requestId: this.asString(transfer.requestId),
              warehouseId,
              technicianId,
              itemType,
              packagingType,
              quantity: this.asNumber(transfer.quantity, 0),
              performedBy,
              notes: this.asString(transfer.notes),
              status: this.asString(transfer.status) ?? "pending",
              rejectionReason: this.asString(transfer.rejectionReason),
              respondedAt: transfer.respondedAt ? this.asDate(transfer.respondedAt) : null,
            },
          });

        summary.warehouseTransfers += 1;
      }

      for (const row of importedItems) {
        const item = row as Record<string, unknown>;
        const id = this.asString(item.id) ?? randomUUID();
        const name = this.asString(item.name);
        const type = this.asString(item.type);
        const unit = this.asString(item.unit);
        if (!name || !type || !unit) continue;

        await tx
          .insert(inventoryItems)
          .values({
            id,
            name,
            type,
            unit,
            quantity: this.asNumber(item.quantity, 0),
            minThreshold: this.asNumber(item.minThreshold, 5),
            technicianName: this.asString(item.technicianName),
            city: this.asString(item.city),
            regionId: this.asString(item.regionId),
            createdAt: this.asDate(item.createdAt),
            updatedAt: this.asDate(item.updatedAt),
          })
          .onConflictDoUpdate({
            target: inventoryItems.id,
            set: {
              name,
              type,
              unit,
              quantity: this.asNumber(item.quantity, 0),
              minThreshold: this.asNumber(item.minThreshold, 5),
              technicianName: this.asString(item.technicianName),
              city: this.asString(item.city),
              regionId: this.asString(item.regionId),
              updatedAt: new Date(),
            },
          });

        summary.inventoryItems += 1;
      }

      for (const row of importedTransactions) {
        const transaction = row as Record<string, unknown>;
        const id = this.asString(transaction.id) ?? randomUUID();
        const itemId = this.asString(transaction.itemId);
        if (!itemId) continue;

        const transactionUserIdRaw = this.asString(transaction.userId);
        const transactionUserId = transactionUserIdRaw
          ? importedUserIdMap.get(transactionUserIdRaw) ?? transactionUserIdRaw
          : null;

        await tx
          .insert(transactions)
          .values({
            id,
            itemId,
            userId: transactionUserId,
            type: this.asString(transaction.type) ?? "add",
            quantity: this.asNumber(transaction.quantity, 0),
            reason: this.asString(transaction.reason),
            createdAt: this.asDate(transaction.createdAt),
          })
          .onConflictDoUpdate({
            target: transactions.id,
            set: {
              itemId,
              userId: transactionUserId,
              type: this.asString(transaction.type) ?? "add",
              quantity: this.asNumber(transaction.quantity, 0),
              reason: this.asString(transaction.reason),
            },
          });

        summary.transactions += 1;
      }
    });

    return summary;
  }
}
