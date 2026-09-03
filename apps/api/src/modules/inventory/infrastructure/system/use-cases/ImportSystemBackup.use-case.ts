import { getDatabase } from "@core/database/connection";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { hashPassword } from "@server/utils/password";
import { ValidationError } from "@core/errors/AppError";
import { wouldBatchLeaveZeroActiveAdmins, LastActiveAdminError } from "@core/authorization/last-active-admin.guard";
import {
  buildIdentityTransactionalContext,
  computeMembershipDiff,
  applyMembershipMutation,
  type StatusTransitionActor,
} from "@modules/identity/presentation/http/identity.api";
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

  /** Rejects a backup user entry that isn't itself a plain record — a raw
   * `null`/string/array element would otherwise reach later field access as
   * an uncaught TypeError (a 500), not a deliberate validation failure. */
  private validateUserRecord(row: unknown): Record<string, unknown> {
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      throw new ValidationError(`Invalid user record in backup data: ${JSON.stringify(row)}`);
    }
    return row as Record<string, unknown>;
  }

  /** Distinguishes an absent `isActive` key (preserve the account's current
   * status / use the normal creation default) from one present but not a
   * genuine boolean (reject) — a distinction `value: unknown` alone cannot
   * express, since `undefined` would be indistinguishable from an explicit
   * `null`. isActive is a security transition request, not an ordinary
   * business toggle, so a malformed value here fails the whole restore
   * rather than silently defaulting to `true`. */
  private parseRestoredActiveState(userRecord: Record<string, unknown>): boolean | undefined {
    if (!Object.prototype.hasOwnProperty.call(userRecord, "isActive")) {
      return undefined;
    }
    const value = userRecord.isActive;
    if (typeof value === "boolean") {
      return value;
    }
    throw new ValidationError(`Invalid isActive value in backup user record: ${JSON.stringify(value)}`);
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

  async execute(backup: { data?: Record<string, unknown> }, actor: StatusTransitionActor): Promise<ImportSummary> {
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

      // OPS-PERM-S1-F4-R3 — every existing user this restore proposes to change
      // membership-relevant state (role and/or isActive) for. Collected here,
      // not written yet: the whole restore's combined effect on active-Admin
      // membership must be validated as ONE set before any of it is applied
      // (see wouldBatchLeaveZeroActiveAdmins's own doc comment for why a
      // row-at-a-time check — even one that sees prior rows' committed state
      // within the same transaction — is not equivalent and can miss the
      // combined effect, or wrongly reject a batch that is only safe once
      // every row is considered together).
      const pendingMembershipChanges: Array<{
        targetUserId: string;
        current: { isActive: boolean; role: string };
        currentAuthGeneration: number;
        proposed: { isActive?: boolean; role: string };
      }> = [];

      for (const row of importedUsers) {
        const user = this.validateUserRecord(row);
        const id = this.asString(user.id) ?? randomUUID();
        const username = this.asString(user.username);
        if (!username) continue;
        const resolvedActiveState = this.parseRestoredActiveState(user);

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

        let resolvedEmail = this.asString(user.email) ?? `${resolvedUsername}.${targetUserId.slice(0, 8)}@import.local`;

        const [emailOwner] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, resolvedEmail))
          .limit(1);

        if (emailOwner && emailOwner.id !== targetUserId) {
          resolvedEmail = `${resolvedUsername}.${targetUserId.slice(0, 8)}@import.local`;
        }

        const password = await this.normalizeImportedPassword(user.password);
        const proposedRole = this.normalizeRole(user.role);

        // OPS-PERM-S0-B1-C.I2A / R3: isActive AND role are deliberately excluded from this
        // payload. Both are security-relevant admin-membership state, restored only through
        // the same canonical transition every live action uses (generation bump, credential
        // invalidation, audit, last-active-admin protection) — never a bare column write, or a
        // restore could silently change either without any of those guarantees (exactly the
        // proven OPS-PERM-S1-F4-R2/R1 bypass this payload split closes for role).
        const ordinaryPayload = {
          username: resolvedUsername,
          email: resolvedEmail,
          password,
          fullName: this.asString(user.fullName) ?? resolvedUsername,
          profileImage: this.asString(user.profileImage),
          city: this.asString(user.city),
          regionId: this.asString(user.regionId),
        };

        if (existingById || existingByUsername) {
          await tx
            .update(users)
            .set({
              ...ordinaryPayload,
              updatedAt: new Date(),
            })
            .where(eq(users.id, targetUserId));

          const [currentState] = await tx
            .select({ isActive: users.isActive, role: users.role, authGeneration: users.authGeneration })
            .from(users)
            .where(eq(users.id, targetUserId))
            .limit(1);

          if (currentState) {
            pendingMembershipChanges.push({
              targetUserId,
              current: { isActive: currentState.isActive, role: currentState.role },
              currentAuthGeneration: currentState.authGeneration,
              proposed: { isActive: resolvedActiveState, role: proposedRole },
            });
          }
        } else {
          await tx
            .insert(users)
            .values({
              id: targetUserId,
              ...ordinaryPayload,
              role: proposedRole,
              // A genuinely new account has no prior credential lineage to
              // protect — its initial state may come directly from the
              // backup, and its generation always starts at 0 (the
              // repository/schema default; never restorable from a backup).
              // A brand-new row can only ever ADD to the active-Admin count,
              // never remove from it, so it never needs the batch check below.
              isActive: resolvedActiveState ?? true,
              createdAt: this.asDate(user.createdAt),
              updatedAt: this.asDate(user.updatedAt),
            });
        }

        importedUserIdMap.set(id, targetUserId);

        summary.users += 1;
      }

      // OPS-PERM-S1-F4-R3 — validate and apply the WHOLE restore batch's
      // effect on active-Admin membership as one set, before writing any of
      // it, using the exact same diff classification and advisory lock the
      // canonical single-row transition (R2) uses — never a second,
      // incompatible protection scheme.
      const identityCtx = buildIdentityTransactionalContext(tx);
      const membershipChanges = pendingMembershipChanges
        .map((p) => ({ ...p, diff: computeMembershipDiff(p.current, p.proposed) }))
        .filter((p) => p.diff.activeChanging || p.diff.roleChanging);

      const touchesAdminMembership = membershipChanges.some((p) => p.diff.wasActiveAdmin || p.diff.willBeActiveAdmin);

      if (touchesAdminMembership) {
        // Acquire the SAME transaction-scoped advisory lock every other
        // admin-membership-changing transaction acquires (R2), before reading
        // the authoritative roster — serializes this restore against every
        // other concurrent transaction (a PATCH-based demotion, a plain
        // deactivate, or another concurrent restore) capable of the same.
        await identityCtx.acquireAdminMembershipLock();

        const currentAdminRows = await tx
          .select({ id: users.id, isActive: users.isActive })
          .from(users)
          .where(eq(users.role, "admin"));
        const currentActiveAdminIds = new Set(currentAdminRows.filter((r) => r.isActive).map((r) => r.id));

        const proposedFinalActiveAdminByUserId = new Map(
          membershipChanges.map((p) => [p.targetUserId, p.diff.willBeActiveAdmin] as const)
        );

        if (wouldBatchLeaveZeroActiveAdmins(currentActiveAdminIds, proposedFinalActiveAdminByUserId)) {
          // Thrown inside the still-open restore transaction — the ENTIRE
          // restore (this batch's membership changes, every ordinary field
          // update above, and every other section of the backup) rolls back
          // atomically. No partial mutation, no audit row for any of it.
          throw new LastActiveAdminError();
        }
      }

      for (const p of membershipChanges) {
        await applyMembershipMutation(identityCtx, p.targetUserId, { ...p.diff, currentAuthGeneration: p.currentAuthGeneration }, actor);
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
