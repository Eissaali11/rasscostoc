/**
 * System controller (logs, backup, etc.)
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { GetSystemLogsUseCase } from "@modules/inventory/application/system-logs/use-cases/GetSystemLogs.use-case";
import { repositories } from "@modules/inventory/infrastructure/database";
import { getDatabase } from "@core/database/connection";
import {
  inventoryItems,
  itemTypes,
  regions,
  supervisorWarehouses,
  transactions,
  users,
  inventoryRequests,
  warehouseInventory,
  warehouseInventoryEntries,
  warehouseTransfers,
  warehouses,
} from "@shared/schema";
import { hashPassword } from "@server/utils/password";

const getSystemLogsUseCase = new GetSystemLogsUseCase(repositories.systemLogs);

async function exportAllData(): Promise<{ exportedAt: string; data: Record<string, unknown> }> {
  const db = getDatabase();

  const [
    allUsers,
    allRegions,
    allItemTypes,
    allItems,
    allTransactions,
    allWarehouses,
    allWarehouseInventory,
    allWarehouseInventoryEntries,
    allSupervisorWarehouses,
    allInventoryRequests,
    allWarehouseTransfers,
  ] = await Promise.all([
    db.select().from(users),
    db.select().from(regions),
    db.select().from(itemTypes),
    db.select().from(inventoryItems),
    db.select().from(transactions),
    db.select().from(warehouses),
    db.select().from(warehouseInventory),
    db.select().from(warehouseInventoryEntries),
    db.select().from(supervisorWarehouses),
    db.select().from(inventoryRequests),
    db.select().from(warehouseTransfers),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    data: {
      users: allUsers,
      regions: allRegions,
      itemTypes: allItemTypes,
      inventoryItems: allItems,
      transactions: allTransactions,
      warehouses: allWarehouses,
      warehouseInventory: allWarehouseInventory,
      warehouseInventoryEntries: allWarehouseInventoryEntries,
      supervisorWarehouses: allSupervisorWarehouses,
      inventoryRequests: allInventoryRequests,
      warehouseTransfers: allWarehouseTransfers,
    },
  };
}

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

type ImportSummary = {
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

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function normalizeRole(value: unknown): "admin" | "supervisor" | "technician" {
  const role = asString(value);
  if (role === "admin" || role === "supervisor" || role === "technician") return role;
  return "technician";
}

function normalizeItemTypeCategory(value: unknown): "devices" | "papers" | "sim" | "accessories" {
  const category = asString(value);
  if (category === "devices" || category === "papers" || category === "sim" || category === "accessories") {
    return category;
  }
  return "accessories";
}

async function normalizeImportedPassword(password: unknown): Promise<string> {
  const raw = asString(password);
  if (!raw) {
    return hashPassword(`Temp-${randomUUID()}`);
  }

  // Keep bcrypt hashes as-is, otherwise hash the plain value.
  if (raw.startsWith("$2")) return raw;
  return hashPassword(raw);
}

async function importAllData(backup: { data?: Record<string, unknown> }): Promise<ImportSummary> {
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
      const id = asString(region.id) ?? randomUUID();
      const name = asString(region.name);
      if (!name) continue;

      await tx
        .insert(regions)
        .values({
          id,
          name,
          description: asString(region.description),
          isActive: asBoolean(region.isActive, true),
          createdAt: asDate(region.createdAt),
          updatedAt: asDate(region.updatedAt),
        })
        .onConflictDoUpdate({
          target: regions.id,
          set: {
            name,
            description: asString(region.description),
            isActive: asBoolean(region.isActive, true),
            updatedAt: new Date(),
          },
        });

      summary.regions += 1;
    }

    for (const row of importedUsers) {
      const user = row as Record<string, unknown>;
      const id = asString(user.id) ?? randomUUID();
      const username = asString(user.username);
      if (!username) continue;

      const [existingById] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      const [existingByUsername] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      const targetUserId = existingById?.id ?? existingByUsername?.id ?? id;
      let resolvedUsername = username;

      const [usernameOwner] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, resolvedUsername))
        .limit(1);

      if (usernameOwner && usernameOwner.id !== targetUserId) {
        resolvedUsername = `${username}_${targetUserId.slice(0, 8)}`;
      }

      let resolvedEmail = asString(user.email) ?? `${resolvedUsername}.${targetUserId.slice(0, 8)}@import.local`;

      const [emailOwner] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, resolvedEmail))
        .limit(1);

      if (emailOwner && emailOwner.id !== targetUserId) {
        resolvedEmail = `${resolvedUsername}.${targetUserId.slice(0, 8)}@import.local`;
      }

      const password = await normalizeImportedPassword(user.password);

      const userPayload = {
        username: resolvedUsername,
        email: resolvedEmail,
        password,
        fullName: asString(user.fullName) ?? resolvedUsername,
        profileImage: asString(user.profileImage),
        city: asString(user.city),
        role: normalizeRole(user.role),
        regionId: asString(user.regionId),
        isActive: asBoolean(user.isActive, true),
      };

      if (existingById || existingByUsername) {
        await tx
          .update(users)
          .set({
            ...userPayload,
            updatedAt: new Date(),
          })
          .where(eq(users.id, targetUserId));
      } else {
        await tx
          .insert(users)
          .values({
            id: targetUserId,
            ...userPayload,
            createdAt: asDate(user.createdAt),
            updatedAt: asDate(user.updatedAt),
          });
      }

      importedUserIdMap.set(id, targetUserId);

      summary.users += 1;
    }

    for (const row of importedItemTypes) {
      const itemType = row as Record<string, unknown>;
      const id = asString(itemType.id) ?? randomUUID();
      const nameAr = asString(itemType.nameAr);
      const nameEn = asString(itemType.nameEn);
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
        category: normalizeItemTypeCategory(itemType.category),
        unitsPerBox: asNumber(itemType.unitsPerBox, 10),
        isActive: asBoolean(itemType.isActive, true),
        isVisible: asBoolean(itemType.isVisible, true),
        sortOrder: asNumber(itemType.sortOrder, 0),
        icon: asString(itemType.icon),
        color: asString(itemType.color),
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
            createdAt: asDate(itemType.createdAt),
            updatedAt: asDate(itemType.updatedAt),
          });
      }

      summary.itemTypes += 1;
    }

    for (const row of importedWarehouses) {
      const warehouse = row as Record<string, unknown>;
      const id = asString(warehouse.id) ?? randomUUID();
      const name = asString(warehouse.name);
      const location = asString(warehouse.location);
      if (!name || !location) continue;

      const fallbackCreatorRawId = asString((importedUsers[0] as Record<string, unknown> | undefined)?.id);
      const fallbackCreatorId = fallbackCreatorRawId
        ? importedUserIdMap.get(fallbackCreatorRawId) ?? fallbackCreatorRawId
        : null;
      const createdByRaw = asString(warehouse.createdBy);
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
          description: asString(warehouse.description),
          isActive: asBoolean(warehouse.isActive, true),
          createdBy,
          regionId: asString(warehouse.regionId),
          createdAt: asDate(warehouse.createdAt),
          updatedAt: asDate(warehouse.updatedAt),
        })
        .onConflictDoUpdate({
          target: warehouses.id,
          set: {
            name,
            location,
            description: asString(warehouse.description),
            isActive: asBoolean(warehouse.isActive, true),
            createdBy,
            regionId: asString(warehouse.regionId),
            updatedAt: new Date(),
          },
        });

      summary.warehouses += 1;
    }

    for (const row of importedWarehouseInventory) {
      const inventory = row as Record<string, unknown>;
      const id = asString(inventory.id) ?? randomUUID();
      const warehouseId = asString(inventory.warehouseId);
      if (!warehouseId) continue;

      await tx
        .insert(warehouseInventory)
        .values({
          id,
          warehouseId,
          n950Boxes: asNumber(inventory.n950Boxes, 0),
          n950Units: asNumber(inventory.n950Units, 0),
          i9000sBoxes: asNumber(inventory.i9000sBoxes, 0),
          i9000sUnits: asNumber(inventory.i9000sUnits, 0),
          i9100Boxes: asNumber(inventory.i9100Boxes, 0),
          i9100Units: asNumber(inventory.i9100Units, 0),
          rollPaperBoxes: asNumber(inventory.rollPaperBoxes, 0),
          rollPaperUnits: asNumber(inventory.rollPaperUnits, 0),
          stickersBoxes: asNumber(inventory.stickersBoxes, 0),
          stickersUnits: asNumber(inventory.stickersUnits, 0),
          newBatteriesBoxes: asNumber(inventory.newBatteriesBoxes, 0),
          newBatteriesUnits: asNumber(inventory.newBatteriesUnits, 0),
          mobilySimBoxes: asNumber(inventory.mobilySimBoxes, 0),
          mobilySimUnits: asNumber(inventory.mobilySimUnits, 0),
          stcSimBoxes: asNumber(inventory.stcSimBoxes, 0),
          stcSimUnits: asNumber(inventory.stcSimUnits, 0),
          zainSimBoxes: asNumber(inventory.zainSimBoxes, 0),
          zainSimUnits: asNumber(inventory.zainSimUnits, 0),
          lebaraBoxes: asNumber(inventory.lebaraBoxes, 0),
          lebaraUnits: asNumber(inventory.lebaraUnits, 0),
          updatedAt: asDate(inventory.updatedAt),
        })
        .onConflictDoUpdate({
          target: warehouseInventory.id,
          set: {
            warehouseId,
            n950Boxes: asNumber(inventory.n950Boxes, 0),
            n950Units: asNumber(inventory.n950Units, 0),
            i9000sBoxes: asNumber(inventory.i9000sBoxes, 0),
            i9000sUnits: asNumber(inventory.i9000sUnits, 0),
            i9100Boxes: asNumber(inventory.i9100Boxes, 0),
            i9100Units: asNumber(inventory.i9100Units, 0),
            rollPaperBoxes: asNumber(inventory.rollPaperBoxes, 0),
            rollPaperUnits: asNumber(inventory.rollPaperUnits, 0),
            stickersBoxes: asNumber(inventory.stickersBoxes, 0),
            stickersUnits: asNumber(inventory.stickersUnits, 0),
            newBatteriesBoxes: asNumber(inventory.newBatteriesBoxes, 0),
            newBatteriesUnits: asNumber(inventory.newBatteriesUnits, 0),
            mobilySimBoxes: asNumber(inventory.mobilySimBoxes, 0),
            mobilySimUnits: asNumber(inventory.mobilySimUnits, 0),
            stcSimBoxes: asNumber(inventory.stcSimBoxes, 0),
            stcSimUnits: asNumber(inventory.stcSimUnits, 0),
            zainSimBoxes: asNumber(inventory.zainSimBoxes, 0),
            zainSimUnits: asNumber(inventory.zainSimUnits, 0),
            lebaraBoxes: asNumber(inventory.lebaraBoxes, 0),
            lebaraUnits: asNumber(inventory.lebaraUnits, 0),
            updatedAt: new Date(),
          },
        });

      summary.warehouseInventory += 1;
    }

    for (const row of importedWarehouseInventoryEntries) {
      const entry = row as Record<string, unknown>;
      const id = asString(entry.id) ?? randomUUID();
      const warehouseId = asString(entry.warehouseId);
      const itemTypeId = asString(entry.itemTypeId);
      if (!warehouseId || !itemTypeId) continue;

      await tx
        .insert(warehouseInventoryEntries)
        .values({
          id,
          warehouseId,
          itemTypeId,
          boxes: asNumber(entry.boxes, 0),
          units: asNumber(entry.units, 0),
          updatedAt: asDate(entry.updatedAt),
        })
        .onConflictDoUpdate({
          target: warehouseInventoryEntries.id,
          set: {
            warehouseId,
            itemTypeId,
            boxes: asNumber(entry.boxes, 0),
            units: asNumber(entry.units, 0),
            updatedAt: new Date(),
          },
        });

      summary.warehouseInventoryEntries += 1;
    }

    for (const row of importedSupervisorWarehouses) {
      const assignment = row as Record<string, unknown>;
      const supervisorIdRaw = asString(assignment.supervisorId);
      const supervisorId = supervisorIdRaw
        ? importedUserIdMap.get(supervisorIdRaw) ?? supervisorIdRaw
        : null;
      const warehouseId = asString(assignment.warehouseId);
      if (!supervisorId || !warehouseId) continue;

      await tx
        .insert(supervisorWarehouses)
        .values({
          id: asString(assignment.id) ?? randomUUID(),
          supervisorId,
          warehouseId,
          createdAt: asDate(assignment.createdAt),
        })
        .onConflictDoNothing();

      summary.supervisorWarehouses += 1;
    }

    for (const row of importedInventoryRequests) {
      const request = row as Record<string, unknown>;
      const id = asString(request.id) ?? randomUUID();
      const technicianIdRaw = asString(request.technicianId);
      const technicianId = technicianIdRaw
        ? importedUserIdMap.get(technicianIdRaw) ?? technicianIdRaw
        : null;
      if (!technicianId) continue;

      const respondedByRaw = asString(request.respondedBy);
      const respondedBy = respondedByRaw
        ? importedUserIdMap.get(respondedByRaw) ?? respondedByRaw
        : null;

      await tx
        .insert(inventoryRequests)
        .values({
          id,
          technicianId,
          warehouseId: asString(request.warehouseId),
          n950Boxes: asNumber(request.n950Boxes, 0),
          n950Units: asNumber(request.n950Units, 0),
          i9000sBoxes: asNumber(request.i9000sBoxes, 0),
          i9000sUnits: asNumber(request.i9000sUnits, 0),
          i9100Boxes: asNumber(request.i9100Boxes, 0),
          i9100Units: asNumber(request.i9100Units, 0),
          rollPaperBoxes: asNumber(request.rollPaperBoxes, 0),
          rollPaperUnits: asNumber(request.rollPaperUnits, 0),
          stickersBoxes: asNumber(request.stickersBoxes, 0),
          stickersUnits: asNumber(request.stickersUnits, 0),
          newBatteriesBoxes: asNumber(request.newBatteriesBoxes, 0),
          newBatteriesUnits: asNumber(request.newBatteriesUnits, 0),
          mobilySimBoxes: asNumber(request.mobilySimBoxes, 0),
          mobilySimUnits: asNumber(request.mobilySimUnits, 0),
          stcSimBoxes: asNumber(request.stcSimBoxes, 0),
          stcSimUnits: asNumber(request.stcSimUnits, 0),
          zainSimBoxes: asNumber(request.zainSimBoxes, 0),
          zainSimUnits: asNumber(request.zainSimUnits, 0),
          lebaraBoxes: asNumber(request.lebaraBoxes, 0),
          lebaraUnits: asNumber(request.lebaraUnits, 0),
          notes: asString(request.notes),
          status: asString(request.status) ?? "pending",
          adminNotes: asString(request.adminNotes),
          respondedBy,
          respondedAt: request.respondedAt ? asDate(request.respondedAt) : null,
          createdAt: asDate(request.createdAt),
        })
        .onConflictDoUpdate({
          target: inventoryRequests.id,
          set: {
            technicianId,
            warehouseId: asString(request.warehouseId),
            n950Boxes: asNumber(request.n950Boxes, 0),
            n950Units: asNumber(request.n950Units, 0),
            i9000sBoxes: asNumber(request.i9000sBoxes, 0),
            i9000sUnits: asNumber(request.i9000sUnits, 0),
            i9100Boxes: asNumber(request.i9100Boxes, 0),
            i9100Units: asNumber(request.i9100Units, 0),
            rollPaperBoxes: asNumber(request.rollPaperBoxes, 0),
            rollPaperUnits: asNumber(request.rollPaperUnits, 0),
            stickersBoxes: asNumber(request.stickersBoxes, 0),
            stickersUnits: asNumber(request.stickersUnits, 0),
            newBatteriesBoxes: asNumber(request.newBatteriesBoxes, 0),
            newBatteriesUnits: asNumber(request.newBatteriesUnits, 0),
            mobilySimBoxes: asNumber(request.mobilySimBoxes, 0),
            mobilySimUnits: asNumber(request.mobilySimUnits, 0),
            stcSimBoxes: asNumber(request.stcSimBoxes, 0),
            stcSimUnits: asNumber(request.stcSimUnits, 0),
            zainSimBoxes: asNumber(request.zainSimBoxes, 0),
            zainSimUnits: asNumber(request.zainSimUnits, 0),
            lebaraBoxes: asNumber(request.lebaraBoxes, 0),
            lebaraUnits: asNumber(request.lebaraUnits, 0),
            notes: asString(request.notes),
            status: asString(request.status) ?? "pending",
            adminNotes: asString(request.adminNotes),
            respondedBy,
            respondedAt: request.respondedAt ? asDate(request.respondedAt) : null,
          },
        });

      summary.inventoryRequests += 1;
    }

    for (const row of importedWarehouseTransfers) {
      const transfer = row as Record<string, unknown>;
      const id = asString(transfer.id) ?? randomUUID();
      const warehouseId = asString(transfer.warehouseId);
      const technicianIdRaw = asString(transfer.technicianId);
      const technicianId = technicianIdRaw
        ? importedUserIdMap.get(technicianIdRaw) ?? technicianIdRaw
        : null;
      const performedByRaw = asString(transfer.performedBy);
      const performedBy = performedByRaw
        ? importedUserIdMap.get(performedByRaw) ?? performedByRaw
        : null;
      const itemType = asString(transfer.itemType);
      const packagingType = asString(transfer.packagingType);
      if (!warehouseId || !technicianId || !performedBy || !itemType || !packagingType) continue;

      await tx
        .insert(warehouseTransfers)
        .values({
          id,
          requestId: asString(transfer.requestId),
          warehouseId,
          technicianId,
          itemType,
          packagingType,
          quantity: asNumber(transfer.quantity, 0),
          performedBy,
          notes: asString(transfer.notes),
          status: asString(transfer.status) ?? "pending",
          rejectionReason: asString(transfer.rejectionReason),
          respondedAt: transfer.respondedAt ? asDate(transfer.respondedAt) : null,
          createdAt: asDate(transfer.createdAt),
        })
        .onConflictDoUpdate({
          target: warehouseTransfers.id,
          set: {
            requestId: asString(transfer.requestId),
            warehouseId,
            technicianId,
            itemType,
            packagingType,
            quantity: asNumber(transfer.quantity, 0),
            performedBy,
            notes: asString(transfer.notes),
            status: asString(transfer.status) ?? "pending",
            rejectionReason: asString(transfer.rejectionReason),
            respondedAt: transfer.respondedAt ? asDate(transfer.respondedAt) : null,
          },
        });

      summary.warehouseTransfers += 1;
    }

    for (const row of importedItems) {
      const item = row as Record<string, unknown>;
      const id = asString(item.id) ?? randomUUID();
      const name = asString(item.name);
      const type = asString(item.type);
      const unit = asString(item.unit);
      if (!name || !type || !unit) continue;

      await tx
        .insert(inventoryItems)
        .values({
          id,
          name,
          type,
          unit,
          quantity: asNumber(item.quantity, 0),
          minThreshold: asNumber(item.minThreshold, 5),
          technicianName: asString(item.technicianName),
          city: asString(item.city),
          regionId: asString(item.regionId),
          createdAt: asDate(item.createdAt),
          updatedAt: asDate(item.updatedAt),
        })
        .onConflictDoUpdate({
          target: inventoryItems.id,
          set: {
            name,
            type,
            unit,
            quantity: asNumber(item.quantity, 0),
            minThreshold: asNumber(item.minThreshold, 5),
            technicianName: asString(item.technicianName),
            city: asString(item.city),
            regionId: asString(item.regionId),
            updatedAt: new Date(),
          },
        });

      summary.inventoryItems += 1;
    }

    for (const row of importedTransactions) {
      const transaction = row as Record<string, unknown>;
      const id = asString(transaction.id) ?? randomUUID();
      const itemId = asString(transaction.itemId);
      if (!itemId) continue;

      const transactionUserIdRaw = asString(transaction.userId);
      const transactionUserId = transactionUserIdRaw
        ? importedUserIdMap.get(transactionUserIdRaw) ?? transactionUserIdRaw
        : null;

      await tx
        .insert(transactions)
        .values({
          id,
          itemId,
          userId: transactionUserId,
          type: asString(transaction.type) ?? "add",
          quantity: asNumber(transaction.quantity, 0),
          reason: asString(transaction.reason),
          createdAt: asDate(transaction.createdAt),
        })
        .onConflictDoUpdate({
          target: transactions.id,
          set: {
            itemId,
            userId: transactionUserId,
            type: asString(transaction.type) ?? "add",
            quantity: asNumber(transaction.quantity, 0),
            reason: asString(transaction.reason),
          },
        });

      summary.transactions += 1;
    }
  });

  return summary;
}

const systemLogsFiltersSchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val) : undefined)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val) : undefined)),
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  severity: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export class SystemController {
  /**
   * GET /api/system-logs
   * Get system logs
   */
  getLogs = asyncHandler(async (req: Request, res: Response) => {
    const query = systemLogsFiltersSchema.parse(req.query);

    const filters: any = {
      page: query.page,
      limit: query.limit,
      userId: query.userId,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      severity: query.severity,
      startDate: query.startDate,
      endDate: query.endDate,
    };

    // Remove undefined filters
    Object.keys(filters).forEach((key) => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    const result = await getSystemLogsUseCase.execute(filters);
    res.json(result);
  });

  /**
   * GET /api/admin/backup
   * Create database backup
   */
  createBackup = asyncHandler(async (req: Request, res: Response) => {
    const backup = await exportAllData();
    const backupPayload = JSON.stringify(backup);
    const backupSizeBytes = Buffer.byteLength(backupPayload, "utf8");
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    
    // Log the backup operation
    await repositories.systemLogs.createSystemLog({
      userId: req.user!.id,
      userName: req.user!.username,
      userRole: req.user!.role,
      action: 'export',
      entityType: 'backup',
      entityId: 'system',
      entityName: 'نسخة احتياطية كاملة',
      description: 'تصدير نسخة احتياطية كاملة لجميع بيانات النظام',
      details: JSON.stringify({
        backupSizeBytes,
        exportedAt: backup.exportedAt,
        filename,
      }),
      severity: 'info',
      success: true
    });
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup);
  });

  /**
   * GET /api/admin/backup/history
   * Return backup history from system logs
   */
  getBackupHistory = asyncHandler(async (req: Request, res: Response) => {
    const db = getDatabase();
    const parsedLimit = Number(req.query.limit ?? 25);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.floor(parsedLimit), 1), 200)
      : 25;

    const historyResult = await db.execute(sql`
      SELECT id, entity_name, details, created_at
      FROM system_logs
      WHERE entity_type = 'backup'
        AND action = 'export'
        AND success = true
      ORDER BY created_at DESC
      LIMIT ${limit};
    `);

    const items = historyResult.rows.map((row: any) => {
      let details: Record<string, unknown> = {};

      if (typeof row.details === 'string' && row.details.trim().length > 0) {
        try {
          details = JSON.parse(row.details);
        } catch {
          details = {};
        }
      }

      const createdAtIso = row.created_at ? new Date(row.created_at).toISOString() : null;
      const fallbackName = createdAtIso
        ? `backup_${createdAtIso.replace(/[:.]/g, '-')}.json`
        : 'backup_unknown.json';

      return {
        id: String(row.id),
        name: String((details.filename as string) || row.entity_name || fallbackName),
        createdAt: createdAtIso,
        sizeBytes: Number(details.backupSizeBytes ?? 0),
        type: 'سحابي',
      };
    });

    res.json({ items });
  });

  /**
   * POST /api/admin/restore
   * Restore database from backup
   */
  restoreBackup = asyncHandler(async (req: Request, res: Response) => {
    const backup = req.body;

    if (!backup || !backup.data) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid backup file" 
      });
    }

    const imported = await importAllData(backup);

    // Log the restore operation
    const restorePayload = JSON.stringify(backup);
    const restoreSizeBytes = Buffer.byteLength(restorePayload, "utf8");

    await repositories.systemLogs.createSystemLog({
      userId: req.user!.id,
      userName: req.user!.username,
      userRole: req.user!.role,
      action: 'import',
      entityType: 'backup',
      entityId: 'system',
      entityName: 'استعادة نسخة احتياطية',
      description: 'استعادة نسخة احتياطية كاملة لجميع بيانات النظام',
      details: JSON.stringify({
        restoreSizeBytes,
        imported,
      }),
      severity: 'warning',
      success: true
    });

    res.json({ success: true, message: "Backup restored successfully", imported });
  });

  /**
   * GET /api/admin/backup/storage-stats
   * Return live storage stats based on stored database size
   */
  getBackupStorageStats = asyncHandler(async (_req: Request, res: Response) => {
    const db = getDatabase();

    const sizeResult = await db.execute(sql`
      SELECT pg_database_size(current_database())::bigint AS used_bytes;
    `);

    const usedBytes = Number(sizeResult.rows?.[0]?.used_bytes ?? 0);

    const configuredCapacityGb = Number(process.env.BACKUP_STORAGE_CAPACITY_GB ?? "0");
    const totalBytes = configuredCapacityGb > 0
      ? Math.round(configuredCapacityGb * 1024 * 1024 * 1024)
      : usedBytes;

    const availableBytes = Math.max(totalBytes - usedBytes, 0);
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

    const lastBackupResult = await db.execute(sql`
      SELECT created_at
      FROM system_logs
      WHERE entity_type = 'backup'
        AND action = 'export'
        AND success = true
      ORDER BY created_at DESC
      LIMIT 1;
    `);

    const exportsCountResult = await db.execute(sql`
      SELECT COUNT(*)::bigint AS exports_count
      FROM system_logs
      WHERE entity_type = 'backup'
        AND action = 'export'
        AND success = true;
    `);

    const exportsCount = Number(exportsCountResult.rows?.[0]?.exports_count ?? 0);
    const lastBackupAt = lastBackupResult.rows?.[0]?.created_at ?? null;

    res.json({
      usedBytes,
      totalBytes,
      availableBytes,
      usedPercent,
      exportsCount,
      lastBackupAt,
      hasConfiguredCapacity: configuredCapacityGb > 0,
    });
  });
}

export const systemController = new SystemController();
