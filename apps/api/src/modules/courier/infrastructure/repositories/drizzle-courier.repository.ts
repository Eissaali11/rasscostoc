import { db } from "@server/core/config/db";
import {
  courierRequests,
  courierExecutions,
  courierCities,
  courierSimTypes,
  courierVendorTypes,
  courierFailureReasons,
  courierAuditLogs,
  users,
  courierRequestItems,
  courierExecutionAttempts,
  type CourierRequest,
  type CourierExecution,
  type CourierRequestItem,
  type CourierExecutionAttempt
} from "@shared/schema";
import { eq, and, or, sql, desc, count } from "drizzle-orm";
import type { ICourierRepository } from "../../domain/repositories/courier.repository.interface";
import type { ListFilters } from "../../application/courier.service";
import {
  buildCourierListConditions,
  courierListExecutionColumns,
  courierListRequestColumns,
} from "../courier-list-query";
import { metrics } from "@core/telemetry/metrics";

export class DrizzleCourierRepository implements ICourierRepository {
  async findRequestById(id: number, tx?: any): Promise<CourierRequest | null> {
    const client = tx || db;
    const [row] = await client
      .select()
      .from(courierRequests)
      .where(eq(courierRequests.id, id))
      .limit(1);
    return row || null;
  }

  async findRequestWithDetails(id: number, tx?: any): Promise<any | null> {
    const client = tx || db;
    const [row] = await client
      .select({
        request: courierRequests,
        execution: courierExecutions,
        createdByName: users.fullName
      })
      .from(courierRequests)
      .leftJoin(courierExecutions, eq(courierExecutions.requestId, courierRequests.id))
      .leftJoin(users, eq(users.id, courierRequests.createdBy))
      .where(eq(courierRequests.id, id))
      .limit(1);

    if (!row) return null;
    const items = await this.findRequestItems(id, client);
    return {
      ...row.request,
      created_by_name: row.createdByName,
      execution: row.execution,
      items,
    };
  }

  async findExecutionByRequestId(requestId: number, tx?: any): Promise<CourierExecution | null> {
    const client = tx || db;
    const [row] = await client
      .select()
      .from(courierExecutions)
      .where(eq(courierExecutions.requestId, requestId))
      .limit(1);
    return row || null;
  }

  async listRequests(filters: ListFilters): Promise<{
    rows: any[];
    total: number;
    meta?: { sqlMs: number; countMs: number; rowsMs: number };
  }> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 50;
    const offset = (page - 1) * pageSize;
    const includeTotal = filters.includeTotal !== false;

    const { whereClause, needsExecutionJoin } = buildCourierListConditions(filters);

    const listSelect = {
      ...courierListRequestColumns,
      executionId: courierListExecutionColumns.id,
      executionRequestId: courierListExecutionColumns.requestId,
      installationStatus: courierListExecutionColumns.installationStatus,
      salesTechnician: courierListExecutionColumns.salesTechnician,
      sn: courierListExecutionColumns.sn,
      simSerial: courierListExecutionColumns.simSerial,
      simType: courierListExecutionColumns.simType,
      deliveryDate: courierListExecutionColumns.deliveryDate,
      responseDate: courierListExecutionColumns.responseDate,
      responseReasonCode: courierListExecutionColumns.responseReasonCode,
      requestPriorityLevel: courierListExecutionColumns.requestPriorityLevel,
      executionTime: courierListExecutionColumns.time,
    };

    const t0 = Date.now();

    const rowsQuery = db
      .select(listSelect)
      .from(courierRequests)
      .leftJoin(courierExecutions, eq(courierExecutions.requestId, courierRequests.id))
      .where(whereClause)
      .orderBy(desc(courierRequests.id))
      .limit(pageSize)
      .offset(offset);

    let countMs = 0;
    let rowsMs = 0;
    let total = 0;
    let rows: Awaited<typeof rowsQuery>;

    if (includeTotal) {
      const countStarted = Date.now();
      const countPromise = needsExecutionJoin
        ? db
            .select({ count: count() })
            .from(courierRequests)
            .leftJoin(courierExecutions, eq(courierExecutions.requestId, courierRequests.id))
            .where(whereClause)
        : db.select({ count: count() }).from(courierRequests).where(whereClause);

      const rowsStarted = Date.now();
      const [totalRes, rowRes] = await Promise.all([countPromise, rowsQuery]);
      countMs = Date.now() - countStarted;
      rowsMs = Date.now() - rowsStarted;
      total = Number(totalRes[0]?.count || 0);
      rows = rowRes;
    } else {
      const rowsStarted = Date.now();
      rows = await rowsQuery;
      rowsMs = Date.now() - rowsStarted;
      total = rows.length;
    }

    const sqlMs = Date.now() - t0;
    metrics.recordValue("courier_list_sql_ms", sqlMs);
    metrics.recordValue("courier_list_count_ms", countMs);
    metrics.recordValue("courier_list_rows_ms", rowsMs);

    return {
      rows: rows.map((r) => ({
        id: r.id,
        date: r.date,
        installationType: r.installationType,
        sim: r.sim,
        tid: r.tid,
        otp: r.otp,
        ticketingHolouly: r.ticketingHolouly,
        incidentNumber: r.incidentNumber,
        pinCode: r.pinCode,
        trsm: r.trsm,
        terminalId: r.terminalId,
        simSn: r.simSn,
        idData: r.idData,
        vendorType: r.vendorType,
        city: r.city,
        cityTec: r.cityTec,
        customerName: r.customerName,
        retailerName: r.retailerName,
        addressAr: r.addressAr,
        addressEn: r.addressEn,
        mobile: r.mobile,
        mobile2: r.mobile2,
        tecName: r.tecName,
        version: r.version,
        execution: r.executionId
          ? {
              id: r.executionId,
              requestId: r.executionRequestId,
              installationStatus: r.installationStatus,
              salesTechnician: r.salesTechnician,
              sn: r.sn,
              simSerial: r.simSerial,
              simType: r.simType,
              deliveryDate: r.deliveryDate,
              responseDate: r.responseDate,
              responseReasonCode: r.responseReasonCode,
              requestPriorityLevel: r.requestPriorityLevel,
              time: r.executionTime,
            }
          : null,
      })),
      total,
      meta: { sqlMs, countMs, rowsMs },
    };
  }

  async listRequestsForExport(filters: ListFilters): Promise<any[]> {
    const { whereClause } = buildCourierListConditions(filters);
    const rows = await db
      .select({
        request: courierRequests,
        execution: courierExecutions,
      })
      .from(courierRequests)
      .leftJoin(courierExecutions, eq(courierExecutions.requestId, courierRequests.id))
      .where(whereClause)
      .orderBy(desc(courierRequests.id));

    return rows.map((r) => ({
      ...r.request,
      execution: r.execution,
    }));
  }

  async updateRequest(id: number, requestData: any, expectedVersion?: number, tx?: any): Promise<CourierRequest | null> {
    const client = tx || db;
    let whereClause = eq(courierRequests.id, id);
    if (expectedVersion !== undefined) {
      whereClause = and(whereClause, eq(courierRequests.version, expectedVersion)) as any;
    }

    const [row] = await client
      .update(courierRequests)
      .set({
        ...requestData,
        updatedAt: new Date(),
        version: sql`version + 1`
      })
      .where(whereClause)
      .returning();

    return row || null;
  }

  async updateExecution(requestId: number, executionData: any, expectedVersion?: number, tx?: any): Promise<CourierExecution | null> {
    const client = tx || db;
    let whereClause = eq(courierExecutions.requestId, requestId);
    if (expectedVersion !== undefined) {
      whereClause = and(whereClause, eq(courierExecutions.version, expectedVersion)) as any;
    }

    const [row] = await client
      .update(courierExecutions)
      .set({
        ...executionData,
        updatedAt: new Date(),
        version: sql`version + 1`
      })
      .where(whereClause)
      .returning();

    return row || null;
  }

  async insertRequest(requestData: any, tx?: any): Promise<CourierRequest> {
    const client = tx || db;
    const [row] = await client
      .insert(courierRequests)
      .values({
        ...requestData,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return row;
  }

  async insertExecution(executionData: any, tx?: any): Promise<CourierExecution> {
    const client = tx || db;
    const [row] = await client
      .insert(courierExecutions)
      .values({
        ...executionData,
        enteredAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return row;
  }

  async deleteRequest(id: number, tx?: any): Promise<boolean> {
    const client = tx || db;
    const [deleted] = await client
      .delete(courierRequests)
      .where(eq(courierRequests.id, id))
      .returning();
    return !!deleted;
  }

  async insertAuditLog(logData: any, tx?: any): Promise<void> {
    const client = tx || db;
    await client.insert(courierAuditLogs).values({
      ...logData,
      changedAt: new Date()
    });
  }

  async getLookups(tx?: any): Promise<any> {
    const client = tx || db;
    const cities = await client.select().from(courierCities);
    const simTypes = await client.select().from(courierSimTypes);
    const vendorTypes = await client.select().from(courierVendorTypes);
    const failureReasons = await client.select().from(courierFailureReasons).orderBy(courierFailureReasons.sortOrder);

    const technicians = await client
      .select({
        id: users.id,
        username: users.username,
        name: users.fullName
      })
      .from(users)
      .where(eq(users.role, "technician"));

    return {
      cities,
      simTypes,
      vendorTypes,
      failureReasons,
      technicians: technicians.map((t: any) => ({
        id: t.id,
        code: t.username,
        name: t.name
      }))
    };
  }

  async findRequestItems(requestId: number, tx?: any): Promise<CourierRequestItem[]> {
    const client = tx || db;
    return client
      .select()
      .from(courierRequestItems)
      .where(eq(courierRequestItems.requestId, requestId));
  }

  async findRequestItemBySerial(serial: string, tx?: any): Promise<CourierRequestItem[]> {
    const client = tx || db;
    return client
      .select()
      .from(courierRequestItems)
      .where(
        or(
          eq(courierRequestItems.serialNumber, serial),
          eq(courierRequestItems.simSerial, serial)
        )
      );
  }

  async findRequestItemById(id: number, tx?: any): Promise<CourierRequestItem | null> {
    const client = tx || db;
    const [row] = await client
      .select()
      .from(courierRequestItems)
      .where(eq(courierRequestItems.id, id))
      .limit(1);
    return row || null;
  }

  async insertRequestItems(items: any[], tx?: any): Promise<CourierRequestItem[]> {
    const client = tx || db;
    if (items.length === 0) return [];
    return client
      .insert(courierRequestItems)
      .values(items)
      .returning();
  }

  async updateRequestItem(id: number, itemData: any, tx?: any): Promise<CourierRequestItem | null> {
    const client = tx || db;
    const [row] = await client
      .update(courierRequestItems)
      .set({ ...itemData, updatedAt: new Date() })
      .where(eq(courierRequestItems.id, id))
      .returning();
    return row || null;
  }

  async findExecutionAttempts(requestId: number, tx?: any): Promise<CourierExecutionAttempt[]> {
    const client = tx || db;
    return client
      .select()
      .from(courierExecutionAttempts)
      .where(eq(courierExecutionAttempts.requestId, requestId))
      .orderBy(desc(courierExecutionAttempts.attemptNumber));
  }

  async insertExecutionAttempt(attemptData: any, tx?: any): Promise<CourierExecutionAttempt> {
    const client = tx || db;
    const [row] = await client
      .insert(courierExecutionAttempts)
      .values({
        ...attemptData,
        createdAt: new Date(),
      })
      .returning();
    return row;
  }
}

export const drizzleCourierRepository = new DrizzleCourierRepository();
