import { db } from "@core/config/db";
import { 
  withdrawnDevices,
  receivedDevices,
  users,
  technicianFixedInventoryEntries,
  technicianMovingInventoryEntries,
  type WithdrawnDevice,
  type ReceivedDevice,
  type InsertWithdrawnDevice,
  type InsertReceivedDevice
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

/**
 * Devices Management Service
 * Handles withdrawn and received devices operations
 */
export class DevicesService {
  private itemTypeColumnExists: boolean | null = null;

  private async hasItemTypeColumn(): Promise<boolean> {
    if (this.itemTypeColumnExists !== null) {
      return this.itemTypeColumnExists;
    }

    const result = await db.execute(sql`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'received_devices'
        AND column_name = 'item_type_id'
      LIMIT 1
    `);

    const rows = (result as any).rows || [];
    this.itemTypeColumnExists = rows.length > 0;
    return this.itemTypeColumnExists;
  }

  /**
   * Get all withdrawn devices
   */
  async getWithdrawnDevices(): Promise<WithdrawnDevice[]> {
    return db
      .select()
      .from(withdrawnDevices)
      .orderBy(desc(withdrawnDevices.createdAt));
  }

  /**
   * Get withdrawn devices by region
   */
  async getWithdrawnDevicesByRegion(regionId: string): Promise<WithdrawnDevice[]> {
    return db
      .select()
      .from(withdrawnDevices)
      .where(eq(withdrawnDevices.regionId, regionId))
      .orderBy(desc(withdrawnDevices.createdAt));
  }

  /**
   * Get single withdrawn device
   */
  async getWithdrawnDevice(id: string): Promise<WithdrawnDevice | undefined> {
    const [device] = await db
      .select()
      .from(withdrawnDevices)
      .where(eq(withdrawnDevices.id, id))
      .limit(1);

    return device || undefined;
  }

  /**
   * Create withdrawn device entry
   */
  async createWithdrawnDevice(data: InsertWithdrawnDevice): Promise<WithdrawnDevice> {
    const [newDevice] = await db
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

  /**
   * Update withdrawn device
   */
  async updateWithdrawnDevice(id: string, updates: Partial<InsertWithdrawnDevice>): Promise<WithdrawnDevice> {
    const [updatedDevice] = await db
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

  /**
   * Delete withdrawn device
   */
  async deleteWithdrawnDevice(id: string): Promise<boolean> {
    const result = await db
      .delete(withdrawnDevices)
      .where(eq(withdrawnDevices.id, id));

    return ((result as any).rowCount || (result as any).changes || 0) > 0;
  }

  /**
   * Get received devices with filters
   */
  async getReceivedDevices(filters?: { 
    status?: string; 
    technicianId?: string; 
    supervisorId?: string; 
    regionId?: string 
  }): Promise<ReceivedDevice[]> {
    const hasItemTypeColumn = await this.hasItemTypeColumn();

    if (!hasItemTypeColumn) {
      const result = await db.execute(sql`
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

    let query = db
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

  /**
   * Get single received device
   */
  async getReceivedDevice(id: string): Promise<ReceivedDevice | undefined> {
    const hasItemTypeColumn = await this.hasItemTypeColumn();

    if (!hasItemTypeColumn) {
      const result = await db.execute(sql`
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

    const [device] = await db
      .select()
      .from(receivedDevices)
      .where(eq(receivedDevices.id, id))
      .limit(1);

    return device || undefined;
  }

  /**
   * Create received device entry
   */
  async createReceivedDevice(data: InsertReceivedDevice): Promise<ReceivedDevice> {
    const hasItemTypeColumn = await this.hasItemTypeColumn();

    if (!hasItemTypeColumn) {
      const result = await db.execute(sql`
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

    const [newDevice] = await db
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

  /**
   * Update received device status
   */
  async updateReceivedDeviceStatus(
    id: string, 
    status: string, 
    approvedBy: string, 
    adminNotes?: string
  ): Promise<ReceivedDevice> {
    const existingDevice = await this.getReceivedDevice(id);
    if (!existingDevice) {
      throw new Error("Received device not found");
    }

    const hasItemTypeColumn = await this.hasItemTypeColumn();

    let updatedDevice: ReceivedDevice;

    if (!hasItemTypeColumn) {
      const result = await db.execute(sql`
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
      const [device] = await db
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

    // If status transitioned to approved, increment inventory
    if (status === "approved" && existingDevice.status !== "approved" && updatedDevice.itemTypeId) {
      const technicianId = updatedDevice.technicianId;
      const itemTypeId = updatedDevice.itemTypeId;
      const isFixed = (updatedDevice as any).inventoryType === "moving" ? false : true;

      if (isFixed) {
        const [existingStock] = await db
          .select()
          .from(technicianFixedInventoryEntries)
          .where(and(
            eq(technicianFixedInventoryEntries.technicianId, technicianId),
            eq(technicianFixedInventoryEntries.itemTypeId, itemTypeId)
          ));

        if (existingStock) {
          await db
            .update(technicianFixedInventoryEntries)
            .set({
              units: existingStock.units + 1,
              updatedAt: new Date()
            })
            .where(eq(technicianFixedInventoryEntries.id, existingStock.id));
        } else {
          await db
            .insert(technicianFixedInventoryEntries)
            .values({
              technicianId,
              itemTypeId,
              boxes: 0,
              units: 1
            });
        }
      } else {
        const [existingStock] = await db
          .select()
          .from(technicianMovingInventoryEntries)
          .where(and(
            eq(technicianMovingInventoryEntries.technicianId, technicianId),
            eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
          ));

        if (existingStock) {
          await db
            .update(technicianMovingInventoryEntries)
            .set({
              units: existingStock.units + 1,
              updatedAt: new Date()
            })
            .where(eq(technicianMovingInventoryEntries.id, existingStock.id));
        } else {
          await db
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

    return updatedDevice;
  }

  /**
   * Delete received device
   */
  async deleteReceivedDevice(id: string): Promise<boolean> {
    const result = await db
      .delete(receivedDevices)
      .where(eq(receivedDevices.id, id));

    return ((result as any).rowCount || (result as any).changes || 0) > 0;
  }

  /**
   * Count pending received devices
   */
  async getPendingReceivedDevicesCount(
    supervisorId?: string,
    regionId?: string | null,
  ): Promise<number> {
    let query = db
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

  /**
   * Get devices summary by region
   */
  async getDevicesSummaryByRegion(regionId: string) {
    const [withdrawnSummary] = await db
      .select({
        totalWithdrawn: sql<number>`COUNT(*)`,
        pendingWithdrawn: sql<number>`0`,
        approvedWithdrawn: sql<number>`0`,
        rejectedWithdrawn: sql<number>`0`
      })
      .from(withdrawnDevices)
      .where(eq(withdrawnDevices.regionId, regionId));

    const [receivedSummary] = await db
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

  /**
   * Get devices by technician
   */
  async getDevicesByTechnician(technicianId: string) {
    const [technician] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, technicianId))
      .limit(1);

    const withdrawn = await db
      .select()
      .from(withdrawnDevices)
      .where(eq(withdrawnDevices.technicianName, technician?.fullName || ""))
      .orderBy(desc(withdrawnDevices.createdAt));

    const hasItemTypeColumn = await this.hasItemTypeColumn();

    const received = hasItemTypeColumn
      ? await db
          .select()
          .from(receivedDevices)
          .where(eq(receivedDevices.technicianId, technicianId))
          .orderBy(desc(receivedDevices.createdAt))
      : (((await db.execute(sql`
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

  /**
   * Get pending devices for approval
   */
  async getPendingDevicesForApproval(supervisorId?: string) {
    let receivedQuery = db
      .select({
        id: receivedDevices.id,
        technicianId: receivedDevices.technicianId,
        terminalId: receivedDevices.terminalId,
        serialNumber: receivedDevices.serialNumber,
        status: receivedDevices.status,
        createdAt: receivedDevices.createdAt,
        technicianName: users.fullName,
        technicianCity: users.city,
        type: sql<string>`'received'`
      })
      .from(receivedDevices)
      .leftJoin(users, eq(receivedDevices.technicianId, users.id))
      .where(eq(receivedDevices.status, 'pending'))
      .$dynamic();

    if (supervisorId) {
      receivedQuery = receivedQuery.where(eq(receivedDevices.supervisorId, supervisorId));
    }

    const received = await receivedQuery;

    return [...received].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  /**
   * Approve multiple devices
   */
  async approveDevicesBatch(deviceIds: string[], approvedBy: string, type: 'withdrawn' | 'received') {
    if (type === 'withdrawn') {
      return db
        .update(withdrawnDevices)
        .set({ 
          updatedAt: new Date() 
        })
        .where(sql`${withdrawnDevices.id} = ANY(${deviceIds})`);
    } else {
      return db
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

  /**
   * Reject multiple devices
   */
  async rejectDevicesBatch(deviceIds: string[], approvedBy: string, adminNotes: string, type: 'withdrawn' | 'received') {
    if (type === 'withdrawn') {
      return db
        .update(withdrawnDevices)
        .set({ 
          notes: adminNotes,
          updatedAt: new Date() 
        })
        .where(sql`${withdrawnDevices.id} = ANY(${deviceIds})`);
    } else {
      return db
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

  /**
   * Deliver device by barcode (called by technician)
   */
  async deliverDeviceByBarcode(technicianId: string, barcode: string): Promise<ReceivedDevice> {
    const hasItemTypeColumn = await this.hasItemTypeColumn();

    // Find the device that is approved, belongs to the technician, and matches barcode (serialNumber or terminalId)
    let device: ReceivedDevice | undefined;

    if (!hasItemTypeColumn) {
      const result = await db.execute(sql`
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
      const [found] = await db
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

    // Update status to 'delivered'
    let updatedDevice: ReceivedDevice;

    if (!hasItemTypeColumn) {
      const result = await db.execute(sql`
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
      const [found] = await db
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
        const [existingStock] = await db
          .select()
          .from(technicianFixedInventoryEntries)
          .where(and(
            eq(technicianFixedInventoryEntries.technicianId, technicianId),
            eq(technicianFixedInventoryEntries.itemTypeId, itemTypeId)
          ));

        if (existingStock) {
          await db
            .update(technicianFixedInventoryEntries)
            .set({
              units: Math.max(0, existingStock.units - 1),
              updatedAt: new Date()
            })
            .where(eq(technicianFixedInventoryEntries.id, existingStock.id));
        }
      } else {
        const [existingStock] = await db
          .select()
          .from(technicianMovingInventoryEntries)
          .where(and(
            eq(technicianMovingInventoryEntries.technicianId, technicianId),
            eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
          ));

        if (existingStock) {
          await db
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
  }
}