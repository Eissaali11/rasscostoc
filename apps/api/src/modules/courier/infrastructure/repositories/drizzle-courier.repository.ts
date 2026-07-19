import { db } from "@server/core/config/db";
import {
  courierRequests,
  courierExecutions,
  courierCities,
  courierSimTypes,
  courierVendorTypes,
  courierFailureReasons,
  courierAuditLogs,
  courierPdfReports,
  users,
  courierRequestItems,
  courierExecutionAttempts,
} from "@shared/schema";
import { eq, and, or, sql, desc, count, inArray, ilike } from "drizzle-orm";
import type { ICourierRepository } from "../../domain/repositories/courier.repository.interface";
import type { ICourierRequestsRepository } from "../../domain/repositories/ICourierRequestsRepository";
import type { ICourierExecutionsRepository } from "../../domain/repositories/ICourierExecutionsRepository";
import type { ICourierPdfRepository } from "../../domain/repositories/ICourierPdfRepository";
import type { ICourierDashboardReadRepository } from "../../domain/repositories/ICourierDashboardReadRepository";
import type {
  CourierRequest,
  CourierExecution,
  CourierRequestItem,
  CourierExecutionAttempt,
  CourierPdfReport,
  ListFilters,
  ItemUpdatePayload
} from "../../domain/courier.types";
import {
  CourierRequestMapper,
  CourierRequestItemMapper,
  CourierExecutionMapper,
  CourierPdfReportMapper,
  CourierExecutionAttemptMapper
} from "../mappers/courier.mapper";
import {
  buildCourierListConditions,
  courierListExecutionColumns,
  courierListRequestColumns,
} from "../courier-list-query";
import { metrics } from "@core/telemetry/metrics";

export class DrizzleCourierRepository implements
  ICourierRepository,
  ICourierRequestsRepository,
  ICourierExecutionsRepository,
  ICourierPdfRepository,
  ICourierDashboardReadRepository
{
  constructor(private readonly tx?: any) {}

  private getClient(tx?: any) {
    return tx || this.tx || db;
  }

  // ── Transaction ────────────────────────────────────────────────────────────
  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return db.transaction(fn);
  }

  // ── Request CRUD ───────────────────────────────────────────────────────────
  async findRequestById(id: number, tx?: any): Promise<CourierRequest | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(courierRequests)
      .where(eq(courierRequests.id, id))
      .limit(1);
    return row ? CourierRequestMapper.toDomain(row) : null;
  }

  async findRequestWithDetails(id: number, tx?: any): Promise<any | null> {
    const client = this.getClient(tx);
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
      ...CourierRequestMapper.toDomain(row.request),
      created_by_name: row.createdByName,
      execution: row.execution ? CourierExecutionMapper.toDomain(row.execution) : null,
      items,
    };
  }

  async findRequestByTid(tid: string, tx?: any): Promise<CourierRequest | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(courierRequests)
      .where(eq(courierRequests.tid, tid))
      .limit(1);
    return row ? CourierRequestMapper.toDomain(row) : null;
  }

  async existsRequestWithTid(tid: string, tx?: any): Promise<boolean> {
    const row = await this.findRequestByTid(tid, tx);
    return row !== null;
  }

  async findExecutionByRequestId(requestId: number, tx?: any): Promise<CourierExecution | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(courierExecutions)
      .where(eq(courierExecutions.requestId, requestId))
      .limit(1);
    return row ? CourierExecutionMapper.toDomain(row) : null;
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
      ...CourierRequestMapper.toDomain(r.request),
      execution: r.execution ? CourierExecutionMapper.toDomain(r.execution) : null,
    }));
  }

  async listRequestsForExportPaged(filters: ListFilters, offset: number, limit: number): Promise<any[]> {
    const { whereClause } = buildCourierListConditions(filters);
    const rows = await db
      .select({
        request: courierRequests,
        execution: courierExecutions,
      })
      .from(courierRequests)
      .leftJoin(courierExecutions, eq(courierExecutions.requestId, courierRequests.id))
      .where(whereClause)
      .orderBy(desc(courierRequests.id))
      .offset(offset)
      .limit(limit);

    return rows.map((r) => ({
      ...CourierRequestMapper.toDomain(r.request),
      execution: r.execution ? CourierExecutionMapper.toDomain(r.execution) : null,
    }));
  }

  async countRequests(filters: ListFilters): Promise<number> {
    const { whereClause, needsExecutionJoin } = buildCourierListConditions(filters);
    const countPromise = needsExecutionJoin
      ? db
          .select({ count: count() })
          .from(courierRequests)
          .leftJoin(courierExecutions, eq(courierExecutions.requestId, courierRequests.id))
          .where(whereClause)
      : db.select({ count: count() }).from(courierRequests).where(whereClause);

    const [res] = await countPromise;
    return Number(res?.count || 0);
  }

  async updateRequest(id: number, requestData: any, expectedVersion?: number, tx?: any): Promise<CourierRequest | null> {
    const client = this.getClient(tx);
    let whereClause = eq(courierRequests.id, id);
    if (expectedVersion !== undefined) {
      whereClause = and(whereClause, eq(courierRequests.version, expectedVersion)) as any;
    }

    const mappedData = CourierRequestMapper.toPersistence(requestData);
    const [row] = await client
      .update(courierRequests)
      .set({
        ...mappedData,
        updatedAt: new Date(),
        version: sql`version + 1`
      })
      .where(whereClause)
      .returning();

    return row ? CourierRequestMapper.toDomain(row) : null;
  }

  async updateExecution(requestId: number, executionData: any, expectedVersion?: number, tx?: any): Promise<CourierExecution | null> {
    const client = this.getClient(tx);
    let whereClause = eq(courierExecutions.requestId, requestId);
    if (expectedVersion !== undefined) {
      whereClause = and(whereClause, eq(courierExecutions.version, expectedVersion)) as any;
    }

    const mappedData = CourierExecutionMapper.toPersistence(executionData);
    const [row] = await client
      .update(courierExecutions)
      .set({
        ...mappedData,
        updatedAt: new Date(),
        version: sql`version + 1`
      })
      .where(whereClause)
      .returning();

    return row ? CourierExecutionMapper.toDomain(row) : null;
  }

  async insertRequest(requestData: any, tx?: any): Promise<CourierRequest> {
    const client = this.getClient(tx);
    const mappedData = CourierRequestMapper.toPersistence(requestData);
    const [row] = await client
      .insert(courierRequests)
      .values({
        ...mappedData,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return CourierRequestMapper.toDomain(row);
  }

  async insertRequestBulk(requests: any[], tx?: any): Promise<CourierRequest[]> {
    const client = this.getClient(tx);
    if (requests.length === 0) return [];
    const mappedRequests = requests.map(r => ({
      ...CourierRequestMapper.toPersistence(r),
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    const rows = await client
      .insert(courierRequests)
      .values(mappedRequests)
      .returning();
    return rows.map((r: any) => CourierRequestMapper.toDomain(r));
  }

  async insertExecution(executionData: any, tx?: any): Promise<CourierExecution> {
    const client = this.getClient(tx);
    const mappedData = CourierExecutionMapper.toPersistence(executionData);
    const [row] = await client
      .insert(courierExecutions)
      .values({
        ...mappedData,
        enteredAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return CourierExecutionMapper.toDomain(row);
  }

  async deleteRequest(id: number, tx?: any): Promise<boolean> {
    const client = this.getClient(tx);
    const [deleted] = await client
      .delete(courierRequests)
      .where(eq(courierRequests.id, id))
      .returning();
    return !!deleted;
  }

  async insertAuditLog(logData: any, tx?: any): Promise<void> {
    const client = this.getClient(tx);
    await client.insert(courierAuditLogs).values({
      ...logData,
      changedAt: new Date()
    });
  }

  async listAuditLogs(limit: number = 100): Promise<any[]> {
    return db
      .select({
        id: courierAuditLogs.id,
        tableName: courierAuditLogs.tableName,
        recordId: courierAuditLogs.recordId,
        action: courierAuditLogs.action,
        fieldName: courierAuditLogs.fieldName,
        oldValue: courierAuditLogs.oldValue,
        newValue: courierAuditLogs.newValue,
        changedBy: users.fullName,
        changedAt: courierAuditLogs.changedAt
      })
      .from(courierAuditLogs)
      .leftJoin(users, eq(users.id, courierAuditLogs.changedBy))
      .orderBy(desc(courierAuditLogs.changedAt))
      .limit(limit);
  }

  async getLookups(tx?: any): Promise<any> {
    const client = this.getClient(tx);
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

  async getDashboardStats(): Promise<{ totalRequests: number; statuses: Record<string, number>; failures: Record<string, number> }> {
    const [totalRes] = await db.select({ count: count() }).from(courierRequests);

    const statusCounts = await db
      .select({ status: courierExecutions.installationStatus, count: count() })
      .from(courierExecutions)
      .groupBy(courierExecutions.installationStatus);

    const failureCounts = await db
      .select({ reason: courierExecutions.responseReasonCode, count: count() })
      .from(courierExecutions)
      .where(sql`${courierExecutions.responseReasonCode} IS NOT NULL`)
      .groupBy(courierExecutions.responseReasonCode);

    return {
      totalRequests: Number(totalRes?.count || 0),
      statuses: statusCounts.reduce((acc: any, curr) => {
        if (curr.status) acc[curr.status] = Number(curr.count);
        return acc;
      }, {}),
      failures: failureCounts.reduce((acc: any, curr) => {
        if (curr.reason) acc[curr.reason] = Number(curr.count);
        return acc;
      }, {})
    };
  }

  async getAiMonitorStats(): Promise<{ totalProcessed: number; totalApplied: number; averageConfidence: number }> {
    const [totalReports] = await db.select({ count: count() }).from(courierPdfReports);
    const [appliedReports] = await db.select({ count: count() }).from(courierPdfReports).where(eq(courierPdfReports.status, "applied"));

    const [avgConf] = await db
      .select({ avg: sql<number>`AVG(overall_confidence)` })
      .from(courierPdfReports)
      .where(sql`overall_confidence IS NOT NULL`);

    return {
      totalProcessed: Number(totalReports?.count || 0),
      totalApplied: Number(appliedReports?.count || 0),
      averageConfidence: avgConf?.avg ? Math.round(Number(avgConf.avg)) : 0
    };
  }

  // ── Request Items ──────────────────────────────────────────────────────────
  async findRequestItems(requestId: number, tx?: any): Promise<CourierRequestItem[]> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(courierRequestItems)
      .where(eq(courierRequestItems.requestId, requestId));
    return rows.map((r: any) => CourierRequestItemMapper.toDomain(r));
  }

  async findRequestItemBySerial(serial: string, tx?: any): Promise<CourierRequestItem[]> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(courierRequestItems)
      .where(
        or(
          eq(courierRequestItems.serialNumber, serial),
          eq(courierRequestItems.simSerial, serial)
        )
      );
    return rows.map((r: any) => CourierRequestItemMapper.toDomain(r));
  }

  async findRequestItemById(id: number, tx?: any): Promise<CourierRequestItem | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select()
      .from(courierRequestItems)
      .where(eq(courierRequestItems.id, id))
      .limit(1);
    return row ? CourierRequestItemMapper.toDomain(row) : null;
  }

  async insertRequestItems(items: any[], tx?: any): Promise<CourierRequestItem[]> {
    const client = this.getClient(tx);
    if (items.length === 0) return [];
    const mapped = items.map(i => CourierRequestItemMapper.toPersistence(i));
    const rows = await client
      .insert(courierRequestItems)
      .values(mapped)
      .returning();
    return rows.map((r: any) => CourierRequestItemMapper.toDomain(r));
  }

  async updateRequestItem(id: number, itemData: any, tx?: any): Promise<CourierRequestItem | null> {
    const client = this.getClient(tx);
    const mapped = CourierRequestItemMapper.toPersistence(itemData);
    const [row] = await client
      .update(courierRequestItems)
      .set({ ...mapped, updatedAt: new Date() })
      .where(eq(courierRequestItems.id, id))
      .returning();
    return row ? CourierRequestItemMapper.toDomain(row) : null;
  }

  async deleteRequestItems(requestId: number, tx?: any): Promise<void> {
    const client = this.getClient(tx);
    await client
      .delete(courierRequestItems)
      .where(eq(courierRequestItems.requestId, requestId));
  }

  async findRequestItemsBySerials(serials: string[], statusFilter?: string, tx?: any): Promise<CourierRequestItem[]> {
    const client = this.getClient(tx);
    const serialCondition = or(
      inArray(courierRequestItems.serialNumber, serials),
      inArray(courierRequestItems.simSerial, serials)
    );
    const whereClause = statusFilter
      ? and(serialCondition, eq(courierRequestItems.status, statusFilter))
      : serialCondition;

    const rows = await client
      .select()
      .from(courierRequestItems)
      .where(whereClause);
    return rows.map((r: any) => CourierRequestItemMapper.toDomain(r));
  }

  async bulkUpdateRequestItems(updates: ItemUpdatePayload[], tx?: any): Promise<void> {
    const client = this.getClient(tx);
    for (const u of updates) {
      const { itemId, ...fields } = u;
      const mapped = CourierRequestItemMapper.toPersistence(fields);
      await client
        .update(courierRequestItems)
        .set({ ...mapped, updatedAt: new Date() })
        .where(eq(courierRequestItems.id, itemId));
    }
  }

  // ── Execution Attempts ─────────────────────────────────────────────────────
  async findExecutionAttempts(requestId: number, tx?: any): Promise<CourierExecutionAttempt[]> {
    const client = this.getClient(tx);
    const rows = await client
      .select()
      .from(courierExecutionAttempts)
      .where(eq(courierExecutionAttempts.requestId, requestId))
      .orderBy(desc(courierExecutionAttempts.attemptNumber));
    return rows.map((r: any) => CourierExecutionAttemptMapper.toDomain(r));
  }

  async insertExecutionAttempt(attemptData: any, tx?: any): Promise<CourierExecutionAttempt> {
    const client = this.getClient(tx);
    const mapped = CourierExecutionAttemptMapper.toPersistence(attemptData);
    const [row] = await client
      .insert(courierExecutionAttempts)
      .values({ ...mapped, createdAt: new Date() })
      .returning();
    return CourierExecutionAttemptMapper.toDomain(row);
  }

  // ── PDF Reports ────────────────────────────────────────────────────────────
  async findPdfReportById(id: number, tx?: any): Promise<CourierPdfReport | null> {
    const client = this.getClient(tx);
    const [report] = await client
      .select({
        id: courierPdfReports.id,
        requestId: courierPdfReports.requestId,
        fileName: courierPdfReports.fileName,
        filePath: courierPdfReports.filePath,
        uploadedBy: courierPdfReports.uploadedBy,
        uploadedAt: courierPdfReports.uploadedAt,
        status: courierPdfReports.status,
        ocrText: courierPdfReports.ocrText,
        extractedJson: courierPdfReports.extractedJson,
        overallConfidence: courierPdfReports.overallConfidence
      })
      .from(courierPdfReports)
      .where(eq(courierPdfReports.id, id))
      .limit(1);
    return report ? CourierPdfReportMapper.toDomain(report) : null;
  }

  async listPdfReports(tx?: any): Promise<CourierPdfReport[]> {
    const client = this.getClient(tx);
    const rows = await client
      .select({
        id: courierPdfReports.id,
        requestId: courierPdfReports.requestId,
        fileName: courierPdfReports.fileName,
        filePath: courierPdfReports.filePath,
        uploadedBy: courierPdfReports.uploadedBy,
        uploadedAt: courierPdfReports.uploadedAt,
        status: courierPdfReports.status,
        ocrText: courierPdfReports.ocrText,
        extractedJson: courierPdfReports.extractedJson,
        overallConfidence: courierPdfReports.overallConfidence
      })
      .from(courierPdfReports)
      .orderBy(desc(courierPdfReports.id))
      .limit(100);
    return rows.map((r: any) => CourierPdfReportMapper.toDomain(r));
  }

  async insertPdfReport(data: any, tx?: any): Promise<CourierPdfReport> {
    const client = this.getClient(tx);
    const mapped = CourierPdfReportMapper.toPersistence(data);
    const [row] = await client
      .insert(courierPdfReports)
      .values(mapped)
      .returning();
    return CourierPdfReportMapper.toDomain(row);
  }

  async updatePdfReport(id: number, data: any, tx?: any): Promise<CourierPdfReport> {
    const client = this.getClient(tx);
    const mapped = CourierPdfReportMapper.toPersistence(data);
    const [row] = await client
      .update(courierPdfReports)
      .set(mapped)
      .where(eq(courierPdfReports.id, id))
      .returning();
    return CourierPdfReportMapper.toDomain(row);
  }

  // ── Serial Lookup Support ──────────────────────────────────────────────────
  // Inventory catalog/item lookups moved to CourierInventoryPortAdapter (composition).

  async findUserById(userId: string, tx?: any): Promise<{ id: string; fullName: string; username: string; technicianCode: string | null; role: string; regionId: number | null } | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select({ id: users.id, fullName: users.fullName, username: users.username, technicianCode: users.technicianCode, role: users.role, regionId: users.regionId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row || null;
  }

  async findUserByCodeOrUsername(code: string, tx?: any): Promise<{ id: string; fullName: string; username: string; technicianCode: string | null } | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select({ id: users.id, fullName: users.fullName, username: users.username, technicianCode: users.technicianCode })
      .from(users)
      .where(
        or(
          eq(users.username, code),
          eq(users.fullName, code),
          eq(users.technicianCode, code)
        )
      )
      .limit(1);
    return row || null;
  }

  async findUserByFuzzyName(name: string, tx?: any): Promise<{ id: string; fullName: string; username: string; technicianCode: string | null } | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select({ id: users.id, fullName: users.fullName, username: users.username, technicianCode: users.technicianCode })
      .from(users)
      .where(
        or(
          ilike(users.fullName, `%${name}%`),
          ilike(users.username, `%${name}%`),
          ilike(users.technicianCode, `%${name}%`)
        )
      )
      .limit(1);
    return row || null;
  }

  async findLinkedRequestItemBySerial(serial: string, tx?: any): Promise<{ requestId: number; id: number; itemType: string; status: string } | null> {
    const client = this.getClient(tx);
    const [row] = await client
      .select({
        requestId: courierRequestItems.requestId,
        id: courierRequestItems.id,
        itemType: courierRequestItems.itemType,
        status: courierRequestItems.status,
      })
      .from(courierRequestItems)
      .where(
        or(
          eq(courierRequestItems.serialNumber, serial),
          eq(courierRequestItems.simSerial, serial)
        )
      )
      .limit(1);
    return row || null;
  }
}

export const drizzleCourierRepository = new DrizzleCourierRepository();
