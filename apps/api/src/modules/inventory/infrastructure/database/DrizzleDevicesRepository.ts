import { and, eq, desc, sql, or } from 'drizzle-orm';
import { AppError } from '@core/errors/AppError';
import { getDatabase } from "@core/database/connection";
import {
  withdrawnDevices,
  receivedDevices,
  regions,
  technicianFixedInventoryEntries,
  technicianMovingInventoryEntries,
  stockMovements,
  type WithdrawnDevice,
  type ReceivedDevice,
  type InsertWithdrawnDevice,
  type InsertReceivedDevice
} from "@shared/schema";
import type { IDevicesRepository } from "@modules/inventory/application/devices/contracts/IDevicesRepository";
import { getInventoryIdentityPorts } from "../adapters/identity/identity-ports.registry";

export class DrizzleDevicesRepository implements IDevicesRepository {
  private get db() {
    return getDatabase();
  }

  async hasItemTypeColumn(): Promise<boolean> {
    const result = await this.db.execute(sql`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'received_devices'
        AND column_name = 'item_type_id'
      LIMIT 1
    `);

    const rows = (result as any).rows || [];
    return rows.length > 0;
  }

  async getWithdrawnDevices(): Promise<any[]> {
    return this.db
      .select({
        id: withdrawnDevices.id,
        city: withdrawnDevices.city,
        technicianName: withdrawnDevices.technicianName,
        terminalId: withdrawnDevices.terminalId,
        serialNumber: withdrawnDevices.serialNumber,
        battery: withdrawnDevices.battery,
        chargerCable: withdrawnDevices.chargerCable,
        chargerHead: withdrawnDevices.chargerHead,
        hasSim: withdrawnDevices.hasSim,
        simCardType: withdrawnDevices.simCardType,
        damagePart: withdrawnDevices.damagePart,
        notes: withdrawnDevices.notes,
        createdBy: withdrawnDevices.createdBy,
        regionId: withdrawnDevices.regionId,
        createdAt: withdrawnDevices.createdAt,
        updatedAt: withdrawnDevices.updatedAt,
        regionName: regions.name,
        status: sql<string>`'approved'`,
        isReceived: sql<boolean>`false`,
      })
      .from(withdrawnDevices)
      .leftJoin(regions, eq(withdrawnDevices.regionId, regions.id));
  }

  private async withTechnicianInfo<T extends { technicianId?: string | null }>(
    rows: T[]
  ): Promise<(T & { city?: string | null; technicianName?: string })[]> {
    const technicianIds = [...new Set(rows.map((r) => r.technicianId).filter(Boolean))] as string[];
    const usersById = await getInventoryIdentityPorts().getUsersByIds(technicianIds);
    return rows.map((row) => ({
      ...row,
      city: row.technicianId ? usersById.get(row.technicianId)?.city : undefined,
      technicianName: row.technicianId ? usersById.get(row.technicianId)?.fullName : undefined,
    }));
  }

  async getReceivedDevicesForWithdrawnList(): Promise<any[]> {
    const rows = await this.db
      .select({
        id: receivedDevices.id,
        technicianId: receivedDevices.technicianId,
        terminalId: receivedDevices.terminalId,
        serialNumber: receivedDevices.serialNumber,
        battery: receivedDevices.battery,
        chargerCable: receivedDevices.chargerCable,
        chargerHead: receivedDevices.chargerHead,
        hasSim: receivedDevices.hasSim,
        simCardType: receivedDevices.simCardType,
        damagePart: receivedDevices.damagePart,
        notes: receivedDevices.adminNotes,
        createdBy: receivedDevices.supervisorId,
        regionId: receivedDevices.regionId,
        createdAt: receivedDevices.createdAt,
        updatedAt: receivedDevices.updatedAt,
        regionName: regions.name,
        status: receivedDevices.status,
        isReceived: sql<boolean>`true`,
      })
      .from(receivedDevices)
      .leftJoin(regions, eq(receivedDevices.regionId, regions.id))
      .where(sql`${receivedDevices.status} IN ('pending', 'rejected')`);

    return this.withTechnicianInfo(rows);
  }

  async getWithdrawnDevicesByRegion(regionId: string): Promise<any[]> {
    return this.db
      .select({
        id: withdrawnDevices.id,
        city: withdrawnDevices.city,
        technicianName: withdrawnDevices.technicianName,
        terminalId: withdrawnDevices.terminalId,
        serialNumber: withdrawnDevices.serialNumber,
        battery: withdrawnDevices.battery,
        chargerCable: withdrawnDevices.chargerCable,
        chargerHead: withdrawnDevices.chargerHead,
        hasSim: withdrawnDevices.hasSim,
        simCardType: withdrawnDevices.simCardType,
        damagePart: withdrawnDevices.damagePart,
        notes: withdrawnDevices.notes,
        createdBy: withdrawnDevices.createdBy,
        regionId: withdrawnDevices.regionId,
        createdAt: withdrawnDevices.createdAt,
        updatedAt: withdrawnDevices.updatedAt,
        regionName: regions.name,
        status: sql<string>`'approved'`,
        isReceived: sql<boolean>`false`,
      })
      .from(withdrawnDevices)
      .leftJoin(regions, eq(withdrawnDevices.regionId, regions.id))
      .where(eq(withdrawnDevices.regionId, regionId));
  }

  async getReceivedDevicesForWithdrawnListByRegion(regionId: string): Promise<any[]> {
    const rows = await this.db
      .select({
        id: receivedDevices.id,
        technicianId: receivedDevices.technicianId,
        terminalId: receivedDevices.terminalId,
        serialNumber: receivedDevices.serialNumber,
        battery: receivedDevices.battery,
        chargerCable: receivedDevices.chargerCable,
        chargerHead: receivedDevices.chargerHead,
        hasSim: receivedDevices.hasSim,
        simCardType: receivedDevices.simCardType,
        damagePart: receivedDevices.damagePart,
        notes: receivedDevices.adminNotes,
        createdBy: receivedDevices.supervisorId,
        regionId: receivedDevices.regionId,
        createdAt: receivedDevices.createdAt,
        updatedAt: receivedDevices.updatedAt,
        regionName: regions.name,
        status: receivedDevices.status,
        isReceived: sql<boolean>`true`,
      })
      .from(receivedDevices)
      .leftJoin(regions, eq(receivedDevices.regionId, regions.id))
      .where(and(
        eq(receivedDevices.regionId, regionId),
        sql`${receivedDevices.status} IN ('pending', 'rejected')`
      ));

    return this.withTechnicianInfo(rows);
  }

  async getWithdrawnDevice(id: string): Promise<any | undefined> {
    const [withdrawnDevice] = await this.db
      .select({
        id: withdrawnDevices.id,
        city: withdrawnDevices.city,
        technicianName: withdrawnDevices.technicianName,
        terminalId: withdrawnDevices.terminalId,
        serialNumber: withdrawnDevices.serialNumber,
        battery: withdrawnDevices.battery,
        chargerCable: withdrawnDevices.chargerCable,
        chargerHead: withdrawnDevices.chargerHead,
        hasSim: withdrawnDevices.hasSim,
        simCardType: withdrawnDevices.simCardType,
        damagePart: withdrawnDevices.damagePart,
        notes: withdrawnDevices.notes,
        createdBy: withdrawnDevices.createdBy,
        regionId: withdrawnDevices.regionId,
        createdAt: withdrawnDevices.createdAt,
        updatedAt: withdrawnDevices.updatedAt,
        regionName: regions.name,
        status: sql<string>`'approved'`,
        isReceived: sql<boolean>`false`,
      })
      .from(withdrawnDevices)
      .leftJoin(regions, eq(withdrawnDevices.regionId, regions.id))
      .where(eq(withdrawnDevices.id, id))
      .limit(1);

    if (withdrawnDevice) {
      return withdrawnDevice;
    }

    const [receivedDeviceRow] = await this.db
      .select({
        id: receivedDevices.id,
        technicianId: receivedDevices.technicianId,
        terminalId: receivedDevices.terminalId,
        serialNumber: receivedDevices.serialNumber,
        battery: receivedDevices.battery,
        chargerCable: receivedDevices.chargerCable,
        chargerHead: receivedDevices.chargerHead,
        hasSim: receivedDevices.hasSim,
        simCardType: receivedDevices.simCardType,
        damagePart: receivedDevices.damagePart,
        notes: receivedDevices.adminNotes,
        createdBy: receivedDevices.supervisorId,
        regionId: receivedDevices.regionId,
        createdAt: receivedDevices.createdAt,
        updatedAt: receivedDevices.updatedAt,
        regionName: regions.name,
        status: receivedDevices.status,
        isReceived: sql<boolean>`true`,
      })
      .from(receivedDevices)
      .leftJoin(regions, eq(receivedDevices.regionId, regions.id))
      .where(eq(receivedDevices.id, id))
      .limit(1);

    const [receivedDevice] = receivedDeviceRow ? await this.withTechnicianInfo([receivedDeviceRow]) : [];

    if (receivedDevice) {
      return {
        ...receivedDevice,
        city: receivedDevice.city || "غير محدد",
        technicianName: receivedDevice.technicianName || "غير محدد",
        terminalId: receivedDevice.terminalId || "غير محدد",
        battery: receivedDevice.battery ? "جيدة" : "سيئة",
        chargerCable: receivedDevice.chargerCable ? "موجود" : "غير موجود",
        chargerHead: receivedDevice.chargerHead ? "موجود" : "غير موجود",
        hasSim: receivedDevice.hasSim ? "نعم" : "لا",
      };
    }

    return undefined;
  }

  async getReceivedDevice(id: string): Promise<ReceivedDevice | undefined> {
    const hasItemTypeColumn = await this.hasItemTypeColumn();

    if (!hasItemTypeColumn) {
      const result = await this.db.execute(sql`
        SELECT
          id,
          technician_id as "technicianId",
          supervisor_id as "supervisorId",
          terminal_id as "terminalId",
          serial_number as "serialNumber",
          battery,
          charger_cable as "chargerCable",
          charger_head as "chargerHead",
          has_sim as "hasSim",
          sim_card_type as "simCardType",
          damage_part as "damagePart",
          status,
          admin_notes as "adminNotes",
          approved_by as "approvedBy",
          approved_at as "approvedAt",
          region_id as "regionId",
          created_at as "createdAt",
          updated_at as "updatedAt",
          NULL::varchar as "itemTypeId"
        FROM received_devices
        WHERE id = ${id}
        LIMIT 1
      `);

      const [device] = ((result as any).rows || []) as ReceivedDevice[];
      return device || undefined;
    }

    const [device] = await this.db
      .select()
      .from(receivedDevices)
      .where(eq(receivedDevices.id, id))
      .limit(1);

    return device || undefined;
  }

  async createWithdrawnDevice(data: InsertWithdrawnDevice): Promise<WithdrawnDevice> {
    const [newDevice] = await this.db
      .insert(withdrawnDevices)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    if (!newDevice) {
      throw new Error("Failed to create withdrawn device entry");
    }

    return newDevice;
  }

  async updateWithdrawnDevice(id: string, updates: Partial<InsertWithdrawnDevice>): Promise<WithdrawnDevice> {
    const [updatedDevice] = await this.db
      .update(withdrawnDevices)
      .set({ 
        ...updates, 
        updatedAt: new Date() 
      })
      .where(eq(withdrawnDevices.id, id))
      .returning();

    if (!updatedDevice) {
      throw new Error("Withdrawn device not found");
    }

    return updatedDevice;
  }

  async deleteWithdrawnDevice(id: string): Promise<boolean> {
    const withdrawnResult = await this.db
      .delete(withdrawnDevices)
      .where(eq(withdrawnDevices.id, id));

    const deletedWithdrawn = ((withdrawnResult as any).rowCount || (withdrawnResult as any).changes || 0) > 0;
    if (deletedWithdrawn) {
      return true;
    }

    const receivedResult = await this.db
      .delete(receivedDevices)
      .where(eq(receivedDevices.id, id));

    return ((receivedResult as any).rowCount || (receivedResult as any).changes || 0) > 0;
  }

  async deleteReceivedDevice(id: string): Promise<boolean> {
    const result = await this.db
      .delete(receivedDevices)
      .where(eq(receivedDevices.id, id));

    return ((result as any).rowCount || (result as any).changes || 0) > 0;
  }

  async getReceivedDevices(filters?: { 
    status?: string; 
    technicianId?: string; 
    supervisorId?: string; 
    regionId?: string 
  }): Promise<ReceivedDevice[]> {
    const hasItemTypeColumn = await this.hasItemTypeColumn();

    if (!hasItemTypeColumn) {
      const result = await this.db.execute(sql`
        SELECT
          id,
          technician_id as "technicianId",
          supervisor_id as "supervisorId",
          terminal_id as "terminalId",
          serial_number as "serialNumber",
          battery,
          charger_cable as "chargerCable",
          charger_head as "chargerHead",
          has_sim as "hasSim",
          sim_card_type as "simCardType",
          damage_part as "damagePart",
          status,
          admin_notes as "adminNotes",
          approved_by as "approvedBy",
          approved_at as "approvedAt",
          region_id as "regionId",
          created_at as "createdAt",
          updated_at as "updatedAt",
          NULL::varchar as "itemTypeId"
        FROM received_devices
        WHERE (${filters?.status ?? null}::text IS NULL OR status = ${filters?.status ?? null})
          AND (${filters?.technicianId ?? null}::varchar IS NULL OR technician_id = ${filters?.technicianId ?? null})
          AND (${filters?.supervisorId ?? null}::varchar IS NULL OR supervisor_id = ${filters?.supervisorId ?? null})
          AND (${filters?.regionId ?? null}::varchar IS NULL OR region_id = ${filters?.regionId ?? null})
        ORDER BY created_at DESC
      `);

      return ((result as any).rows || []) as ReceivedDevice[];
    }

    let query = this.db
      .select()
      .from(receivedDevices)
      .$dynamic();

    const conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(receivedDevices.status, filters.status));
    }
    if (filters?.technicianId) {
      conditions.push(eq(receivedDevices.technicianId, filters.technicianId));
    }
    if (filters?.supervisorId) {
      conditions.push(eq(receivedDevices.supervisorId, filters.supervisorId));
    }
    if (filters?.regionId) {
      conditions.push(eq(receivedDevices.regionId, filters.regionId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(desc(receivedDevices.createdAt));
  }

  async createReceivedDevice(data: InsertReceivedDevice): Promise<ReceivedDevice> {
    // Check if there is already a pending received device request for this serial number
    const [existingPending] = await this.db
      .select({ id: receivedDevices.id })
      .from(receivedDevices)
      .where(
        and(
          eq(receivedDevices.serialNumber, data.serialNumber),
          eq(receivedDevices.status, "pending")
        )
      )
      .limit(1);

    if (existingPending) {
      throw new AppError("هذا الرقم التسلسلي بانتظار المراجعة بالفعل في الإشعارات ولا يمكن تكراره", 400);
    }

    const hasItemTypeColumn = await this.hasItemTypeColumn();

    if (!hasItemTypeColumn) {
      const result = await this.db.execute(sql`
        INSERT INTO received_devices (
          technician_id,
          supervisor_id,
          terminal_id,
          serial_number,
          battery,
          charger_cable,
          charger_head,
          has_sim,
          sim_card_type,
          damage_part,
          status,
          region_id,
          created_at,
          updated_at
        )
        VALUES (
          ${data.technicianId},
          ${data.supervisorId ?? null},
          ${data.terminalId},
          ${data.serialNumber},
          ${data.battery ?? false},
          ${data.chargerCable ?? false},
          ${data.chargerHead ?? false},
          ${data.hasSim ?? false},
          ${data.simCardType ?? null},
          ${data.damagePart ?? ""},
          'pending',
          ${data.regionId ?? null},
          NOW(),
          NOW()
        )
        RETURNING
          id,
          technician_id as "technicianId",
          supervisor_id as "supervisorId",
          terminal_id as "terminalId",
          serial_number as "serialNumber",
          battery,
          charger_cable as "chargerCable",
          charger_head as "chargerHead",
          has_sim as "hasSim",
          sim_card_type as "simCardType",
          damage_part as "damagePart",
          status,
          admin_notes as "adminNotes",
          approved_by as "approvedBy",
          approved_at as "approvedAt",
          region_id as "regionId",
          created_at as "createdAt",
          updated_at as "updatedAt",
          NULL::varchar as "itemTypeId"
      `);

      const [newDevice] = ((result as any).rows || []) as ReceivedDevice[];

      if (!newDevice) {
        throw new Error("Failed to create received device entry");
      }

      return newDevice;
    }

    const [newDevice] = await this.db
      .insert(receivedDevices)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    if (!newDevice) {
      throw new Error("Failed to create received device entry");
    }

    return newDevice;
  }

  async updateReceivedDevice(id: string, updates: Partial<InsertReceivedDevice>): Promise<ReceivedDevice> {
    const hasItemTypeColumn = await this.hasItemTypeColumn();

    if (!hasItemTypeColumn) {
      const result = await this.db.execute(sql`
        UPDATE received_devices
        SET
          technician_id = COALESCE(${updates.technicianId ?? null}, technician_id),
          supervisor_id = COALESCE(${updates.supervisorId ?? null}, supervisor_id),
          terminal_id = COALESCE(${updates.terminalId ?? null}, terminal_id),
          serial_number = COALESCE(${updates.serialNumber ?? null}, serial_number),
          battery = COALESCE(${updates.battery ?? null}, battery),
          charger_cable = COALESCE(${updates.chargerCable ?? null}, charger_cable),
          charger_head = COALESCE(${updates.chargerHead ?? null}, charger_head),
          has_sim = COALESCE(${updates.hasSim ?? null}, has_sim),
          sim_card_type = COALESCE(${updates.simCardType ?? null}, sim_card_type),
          damage_part = COALESCE(${updates.damagePart ?? null}, damage_part),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING
          id,
          technician_id as "technicianId",
          supervisor_id as "supervisorId",
          terminal_id as "terminalId",
          serial_number as "serialNumber",
          battery,
          charger_cable as "chargerCable",
          charger_head as "chargerHead",
          has_sim as "hasSim",
          sim_card_type as "simCardType",
          damage_part as "damagePart",
          status,
          admin_notes as "adminNotes",
          approved_by as "approvedBy",
          approved_at as "approvedAt",
          region_id as "regionId",
          created_at as "createdAt",
          updated_at as "updatedAt",
          NULL::varchar as "itemTypeId"
      `);

      const [updated] = ((result as any).rows || []) as ReceivedDevice[];
      if (!updated) {
        throw new Error("Received device not found");
      }
      return updated;
    }

    const [updated] = await this.db
      .update(receivedDevices)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(receivedDevices.id, id))
      .returning();

    if (!updated) {
      throw new Error("Received device not found");
    }
    return updated;
  }

  async updateReceivedDeviceStatus(
    id: string,
    status: string,
    approvedBy: string,
    adminNotes?: string,
    existingDevice?: any
  ): Promise<ReceivedDevice> {
    const hasItemTypeColumn = await this.hasItemTypeColumn();

    return await this.db.transaction(async (tx) => {
      let updatedDevice: ReceivedDevice;

      if (!hasItemTypeColumn) {
        const result = await tx.execute(sql`
          UPDATE received_devices
          SET
            status = ${status},
            approved_by = ${approvedBy},
            admin_notes = ${adminNotes ?? null},
            approved_at = NOW(),
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING
            id,
            technician_id as "technicianId",
            supervisor_id as "supervisorId",
            terminal_id as "terminalId",
            serial_number as "serialNumber",
            battery,
            charger_cable as "chargerCable",
            charger_head as "chargerHead",
            has_sim as "hasSim",
            sim_card_type as "simCardType",
            damage_part as "damagePart",
            status,
            admin_notes as "adminNotes",
            approved_by as "approvedBy",
            approved_at as "approvedAt",
            region_id as "regionId",
            created_at as "createdAt",
            updated_at as "updatedAt",
            NULL::varchar as "itemTypeId"
        `);

        const [device] = ((result as any).rows || []) as ReceivedDevice[];
        if (!device) {
          throw new Error("Received device not found");
        }
        updatedDevice = device;
      } else {
        const [device] = await tx
          .update(receivedDevices)
          .set({
            status,
            approvedBy,
            adminNotes,
            approvedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(receivedDevices.id, id))
          .returning();

        if (!device) {
          throw new Error("Received device not found");
        }
        updatedDevice = device;
      }

      // If status transitioned to approved, create a withdrawn device entry and increment inventory
      if (status === "approved" && existingDevice?.status !== "approved") {
        const technician = await getInventoryIdentityPorts().getUserById(updatedDevice.technicianId);

        if (technician) {
          await tx.insert(withdrawnDevices).values({
            city: technician.city || "غير محدد",
            technicianName: technician.fullName || "غير محدد",
            terminalId: updatedDevice.terminalId || "غير محدد",
            serialNumber: updatedDevice.serialNumber,
            battery: updatedDevice.battery ? "جيدة" : "سيئة",
            chargerCable: updatedDevice.chargerCable ? "موجود" : "غير موجود",
            chargerHead: updatedDevice.chargerHead ? "موجود" : "غير موجود",
            hasSim: updatedDevice.hasSim ? "نعم" : "لا",
            simCardType: updatedDevice.simCardType || "غير محدد",
            damagePart: updatedDevice.damagePart || "سليم",
            notes: adminNotes || null,
            createdBy: approvedBy,
            regionId: updatedDevice.regionId,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        // Increment inventory if itemTypeId exists
        if (updatedDevice.itemTypeId) {
          const technicianId = updatedDevice.technicianId;
          const itemTypeId = updatedDevice.itemTypeId;
          const isFixed = (updatedDevice as any).inventoryType === "moving" ? false : true;

          if (isFixed) {
            const [existingStock] = await tx
              .select()
              .from(technicianFixedInventoryEntries)
              .where(and(
                eq(technicianFixedInventoryEntries.technicianId, technicianId),
                eq(technicianFixedInventoryEntries.itemTypeId, itemTypeId)
              ));

            if (existingStock) {
              await tx
                .update(technicianFixedInventoryEntries)
                .set({
                  units: existingStock.units + 1,
                  updatedAt: new Date()
                })
                .where(eq(technicianFixedInventoryEntries.id, existingStock.id));
            } else {
              await tx
                .insert(technicianFixedInventoryEntries)
                .values({
                  technicianId,
                  itemTypeId,
                  boxes: 0,
                  units: 1
                });
            }
          } else {
            const [existingStock] = await tx
              .select()
              .from(technicianMovingInventoryEntries)
              .where(and(
                eq(technicianMovingInventoryEntries.technicianId, technicianId),
                eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
              ));

            if (existingStock) {
              await tx
                .update(technicianMovingInventoryEntries)
                .set({
                  units: existingStock.units + 1,
                  updatedAt: new Date()
                })
                .where(eq(technicianMovingInventoryEntries.id, existingStock.id));
            } else {
              await tx
                .insert(technicianMovingInventoryEntries)
                .values({
                  technicianId,
                  itemTypeId,
                  boxes: 0,
                  units: 1
                });
            }
          }
        }
      }

      return updatedDevice;
    });
  }

  async getPendingReceivedDevicesCount(supervisorId?: string, regionId?: string | null): Promise<number> {
    let query = this.db
      .select({ count: sql<number>`count(*)` })
      .from(receivedDevices)
      .$dynamic();

    const conditions = [eq(receivedDevices.status, 'pending')];

    if (supervisorId) {
      conditions.push(eq(receivedDevices.supervisorId, supervisorId));
    }

    if (regionId) {
      conditions.push(eq(receivedDevices.regionId, regionId));
    }

    query = query.where(and(...conditions));

    const [{ count }] = await query;
    return Number(count);
  }

  async getDevicesSummaryByRegion(regionId: string): Promise<any> {
    const [withdrawnSummary] = await this.db
      .select({
        totalWithdrawn: sql<number>`COUNT(*)`,
        pendingWithdrawn: sql<number>`0`,
        approvedWithdrawn: sql<number>`0`,
        rejectedWithdrawn: sql<number>`0`
      })
      .from(withdrawnDevices)
      .where(eq(withdrawnDevices.regionId, regionId));

    const [receivedSummary] = await this.db
      .select({
        totalReceived: sql<number>`COUNT(*)`,
        pendingReceived: sql<number>`COUNT(CASE WHEN ${receivedDevices.status} = 'pending' THEN 1 END)`,
        approvedReceived: sql<number>`COUNT(CASE WHEN ${receivedDevices.status} = 'approved' THEN 1 END)`,
        rejectedReceived: sql<number>`COUNT(CASE WHEN ${receivedDevices.status} = 'rejected' THEN 1 END)`
      })
      .from(receivedDevices)
      .where(eq(receivedDevices.regionId, regionId));

    return {
      ...withdrawnSummary,
      ...receivedSummary
    };
  }

  async getDevicesByTechnician(technicianId: string): Promise<{ withdrawn: any[]; received: any[] }> {
    const technician = await getInventoryIdentityPorts().getUserById(technicianId);

    const withdrawn = await this.db
      .select()
      .from(withdrawnDevices)
      .where(eq(withdrawnDevices.technicianName, technician?.fullName || ""))
      .orderBy(desc(withdrawnDevices.createdAt));

    const hasItemTypeColumn = await this.hasItemTypeColumn();

    const received = hasItemTypeColumn
      ? await this.db
          .select()
          .from(receivedDevices)
          .where(eq(receivedDevices.technicianId, technicianId))
          .orderBy(desc(receivedDevices.createdAt))
      : (((await this.db.execute(sql`
          SELECT
            id,
            technician_id as "technicianId",
            supervisor_id as "supervisorId",
            terminal_id as "terminalId",
            serial_number as "serialNumber",
            battery,
            charger_cable as "chargerCable",
            charger_head as "chargerHead",
            has_sim as "hasSim",
            sim_card_type as "simCardType",
            damage_part as "damagePart",
            status,
            admin_notes as "adminNotes",
            approved_by as "approvedBy",
            approved_at as "approvedAt",
            region_id as "regionId",
            created_at as "createdAt",
            updated_at as "updatedAt",
            NULL::varchar as "itemTypeId"
          FROM received_devices
          WHERE technician_id = ${technicianId}
          ORDER BY created_at DESC
        `)) as any).rows || []);

    return {
      withdrawn,
      received
    };
  }

  async getPendingDevicesForApproval(supervisorId?: string): Promise<any[]> {
    let receivedQuery = this.db
      .select({
        id: receivedDevices.id,
        technicianId: receivedDevices.technicianId,
        terminalId: receivedDevices.terminalId,
        serialNumber: receivedDevices.serialNumber,
        status: receivedDevices.status,
        createdAt: receivedDevices.createdAt,
        type: sql<string>`'received'`
      })
      .from(receivedDevices)
      .where(eq(receivedDevices.status, 'pending'))
      .$dynamic();

    if (supervisorId) {
      receivedQuery = receivedQuery.where(eq(receivedDevices.supervisorId, supervisorId));
    }

    const receivedRows = await receivedQuery;
    const technicianIds = [...new Set(receivedRows.map((r) => r.technicianId).filter(Boolean))];
    const techsById = await getInventoryIdentityPorts().getUsersByIds(technicianIds as string[]);
    const received = receivedRows.map((row) => ({
      ...row,
      technicianName: row.technicianId ? techsById.get(row.technicianId)?.fullName : undefined,
      technicianCity: row.technicianId ? techsById.get(row.technicianId)?.city : undefined,
    }));

    return [...received].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  async approveDevicesBatch(deviceIds: string[], approvedBy: string, type: 'withdrawn' | 'received'): Promise<any> {
    if (type === 'withdrawn') {
      return this.db
        .update(withdrawnDevices)
        .set({ 
          updatedAt: new Date() 
        })
        .where(sql`${withdrawnDevices.id} = ANY(${deviceIds})`);
    } else {
      return this.db
        .update(receivedDevices)
        .set({ 
          status: 'approved', 
          approvedBy,
          approvedAt: new Date(),
          updatedAt: new Date() 
        })
        .where(sql`${receivedDevices.id} = ANY(${deviceIds})`);
    }
  }

  async rejectDevicesBatch(deviceIds: string[], approvedBy: string, adminNotes: string, type: 'withdrawn' | 'received'): Promise<any> {
    if (type === 'withdrawn') {
      return this.db
        .update(withdrawnDevices)
        .set({ 
          notes: adminNotes,
          updatedAt: new Date() 
        })
        .where(sql`${withdrawnDevices.id} = ANY(${deviceIds})`);
    } else {
      return this.db
        .update(receivedDevices)
        .set({ 
          status: 'rejected', 
          approvedBy,
          adminNotes,
          approvedAt: new Date(),
          updatedAt: new Date() 
        })
        .where(sql`${receivedDevices.id} = ANY(${deviceIds})`);
    }
  }

  async deliverDeviceByBarcode(technicianId: string, barcode: string): Promise<ReceivedDevice> {
    const hasItemTypeColumn = await this.hasItemTypeColumn();

    // Find the device that is approved, belongs to the technician, and matches barcode (serialNumber or terminalId)
    let device: ReceivedDevice | undefined;

    if (!hasItemTypeColumn) {
      const result = await this.db.execute(sql`
        SELECT
          id,
          technician_id as "technicianId",
          supervisor_id as "supervisorId",
          terminal_id as "terminalId",
          serial_number as "serialNumber",
          battery,
          charger_cable as "chargerCable",
          charger_head as "chargerHead",
          has_sim as "hasSim",
          sim_card_type as "simCardType",
          damage_part as "damagePart",
          status,
          admin_notes as "adminNotes",
          approved_by as "approvedBy",
          approved_at as "approvedAt",
          region_id as "regionId",
          created_at as "createdAt",
          updated_at as "updatedAt",
          NULL::varchar as "itemTypeId"
        FROM received_devices
        WHERE technician_id = ${technicianId}
          AND status = 'approved'
          AND (serial_number = ${barcode} OR terminal_id = ${barcode})
        LIMIT 1
      `);
      const [found] = ((result as any).rows || []) as ReceivedDevice[];
      device = found;
    } else {
      const [found] = await this.db
        .select()
        .from(receivedDevices)
        .where(and(
          eq(receivedDevices.technicianId, technicianId),
          eq(receivedDevices.status, 'approved'),
          sql`(${receivedDevices.serialNumber} = ${barcode} OR ${receivedDevices.terminalId} = ${barcode})`
        ))
        .limit(1);
      device = found || undefined;
    }

    if (!device) {
      throw new Error("الجهاز غير موجود في عهدتك كـ 'مقبول' أو رمز الباركود غير مطابق");
    }

    return await this.db.transaction(async (tx) => {
      // Update status to 'delivered'
      let updatedDevice: ReceivedDevice;

      if (!hasItemTypeColumn) {
        const result = await tx.execute(sql`
          UPDATE received_devices
          SET
            status = 'delivered',
            updated_at = NOW()
          WHERE id = ${device.id}
          RETURNING
            id,
            technician_id as "technicianId",
            supervisor_id as "supervisorId",
            terminal_id as "terminalId",
            serial_number as "serialNumber",
            battery,
            charger_cable as "chargerCable",
            charger_head as "chargerHead",
            has_sim as "hasSim",
            sim_card_type as "simCardType",
            damage_part as "damagePart",
            status,
            admin_notes as "adminNotes",
            approved_by as "approvedBy",
            approved_at as "approvedAt",
            region_id as "regionId",
            created_at as "createdAt",
            updated_at as "updatedAt",
            NULL::varchar as "itemTypeId"
        `);
        const [found] = ((result as any).rows || []) as ReceivedDevice[];
        updatedDevice = found;
      } else {
        const [found] = await tx
          .update(receivedDevices)
          .set({
            status: 'delivered',
            updatedAt: new Date()
          })
          .where(eq(receivedDevices.id, device.id))
          .returning();
        updatedDevice = found;
      }

      // Decrement inventory by 1 unit
      if (updatedDevice.itemTypeId) {
        const itemTypeId = updatedDevice.itemTypeId;
        const isFixed = (updatedDevice as any).inventoryType === "moving" ? false : true;

        if (isFixed) {
          const [existingStock] = await tx
            .select()
            .from(technicianFixedInventoryEntries)
            .where(and(
              eq(technicianFixedInventoryEntries.technicianId, technicianId),
              eq(technicianFixedInventoryEntries.itemTypeId, itemTypeId)
            ));

          if (existingStock) {
            await tx
              .update(technicianFixedInventoryEntries)
              .set({
                units: Math.max(0, existingStock.units - 1),
                updatedAt: new Date()
              })
              .where(eq(technicianFixedInventoryEntries.id, existingStock.id));
          }
        } else {
          const [existingStock] = await tx
            .select()
            .from(technicianMovingInventoryEntries)
            .where(and(
              eq(technicianMovingInventoryEntries.technicianId, technicianId),
              eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
            ));

          if (existingStock) {
            await tx
              .update(technicianMovingInventoryEntries)
              .set({
                units: Math.max(0, existingStock.units - 1),
                updatedAt: new Date()
              })
              .where(eq(technicianMovingInventoryEntries.id, existingStock.id));
          }
        }
      }

      return updatedDevice;
    });
  }

  async deductTechnicianInventory(data: {
    technicianCode: string;
    devices: { serialNumber: string; model?: string }[];
    notes?: string;
    actor: { id: string; username: string; role: string; regionId: string | null };
  }): Promise<any[]> {
    const { technicianCode, devices, notes, actor } = data;

    // Helper to resolve device model to standard itemTypeId
    const resolveItemTypeId = (modelStr?: string): string => {
      const s = String(modelStr || "").toLowerCase();
      if (s.includes("n950") || s.includes("newland")) return "n950";
      if (s.includes("a920") || s.includes("pax") || s.includes("i9000")) return "i9000s";
      if (s.includes("i9100")) return "i9100";
      return "n950"; // default to n950
    };

    // Find the technician user in StockPro
    const tech = await getInventoryIdentityPorts().findTechnicianByCodeOrName(technicianCode);

    if (!tech) {
      throw new Error(`لم يتم العثور على المندوب بالرمز أو الاسم: ${technicianCode}`);
    }

    return await this.db.transaction(async (tx) => {
      const results = [];
      for (const device of devices) {
        // Look up device in received_devices (custody)
        const [deviceRow] = await tx
          .select()
          .from(receivedDevices)
          .where(
            and(
              eq(receivedDevices.technicianId, tech.id),
              eq(receivedDevices.status, "approved"),
              or(
                eq(receivedDevices.serialNumber, device.serialNumber),
                eq(receivedDevices.terminalId, device.serialNumber)
              )
            )
          )
          .limit(1);

        const itemTypeId = deviceRow?.itemTypeId || resolveItemTypeId(device.model);
        const isFixed = deviceRow ? (deviceRow.inventoryType !== "moving") : false;

        if (deviceRow) {
          // Update status to delivered
          await tx
            .update(receivedDevices)
            .set({
              status: "delivered",
              updatedAt: new Date()
            })
            .where(eq(receivedDevices.id, deviceRow.id));
        } else {
          // Auto-create delivered received_device entry for logging/audit purposes
          await tx
            .insert(receivedDevices)
            .values({
              technicianId: tech.id,
              serialNumber: device.serialNumber,
              terminalId: device.serialNumber,
              itemTypeId: itemTypeId,
              status: "delivered",
              inventoryType: "moving",
              createdAt: new Date(),
              updatedAt: new Date()
            });
        }

        // Decrement units in technician inventory
        if (isFixed) {
          const [existingStock] = await tx
            .select()
            .from(technicianFixedInventoryEntries)
            .where(
              and(
                eq(technicianFixedInventoryEntries.technicianId, tech.id),
                eq(technicianFixedInventoryEntries.itemTypeId, itemTypeId)
              )
            );

          if (existingStock) {
            await tx
              .update(technicianFixedInventoryEntries)
              .set({
                units: Math.max(0, existingStock.units - 1),
                updatedAt: new Date()
              })
              .where(eq(technicianFixedInventoryEntries.id, existingStock.id));
          }
        } else {
          const [existingStock] = await tx
            .select()
            .from(technicianMovingInventoryEntries)
            .where(
              and(
                eq(technicianMovingInventoryEntries.technicianId, tech.id),
                eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
              )
            );

          if (existingStock) {
            await tx
              .update(technicianMovingInventoryEntries)
              .set({
                units: Math.max(0, existingStock.units - 1),
                updatedAt: new Date()
              })
              .where(eq(technicianMovingInventoryEntries.id, existingStock.id));
          }
        }

        // Write stock movement log
        await tx.insert(stockMovements).values({
          technicianId: tech.id,
          itemType: itemTypeId,
          packagingType: "unit",
          quantity: 1,
          fromInventory: `technician:${tech.id}:${isFixed ? 'fixed' : 'moving'}`,
          toInventory: "customer",
          reason: "rassco_delivery_ocr",
          performedBy: actor.id,
          notes: notes || `Auto deducted via PDF report OCR for Serial: ${device.serialNumber}`,
          createdAt: new Date()
        });

        results.push({
          serialNumber: device.serialNumber,
          itemTypeId,
          status: "delivered"
        });
      }
      return results;
    });
  }
}
