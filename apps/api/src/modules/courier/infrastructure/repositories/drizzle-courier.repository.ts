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
    return {
      ...row.request,
      created_by_name: row.createdByName,
      execution: row.execution
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

  async listRequests(filters: ListFilters): Promise<{ rows: any[]; total: number }> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 50;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (filters.q) {
      const qLike = `%${filters.q}%`;
      conditions.push(
        or(
          sql`${courierRequests.tid} LIKE ${qLike}`,
          sql`${courierRequests.terminalId} LIKE ${qLike}`,
          sql`${courierRequests.customerName} LIKE ${qLike}`,
          sql`${courierRequests.incidentNumber} LIKE ${qLike}`,
          sql`${courierRequests.mobile} LIKE ${qLike}`,
          sql`${courierExecutions.sn} LIKE ${qLike}`,
          sql`${courierExecutions.simSerial} LIKE ${qLike}`
        )
      );
    }
    if (filters.city) {
      conditions.push(eq(courierRequests.city, filters.city));
    }
    if (filters.technician) {
      conditions.push(eq(courierExecutions.salesTechnician, filters.technician));
    }
    if (filters.status) {
      if (filters.status === "pending") {
        conditions.push(or(sql`${courierExecutions.installationStatus} IS NULL`, sql`${courierExecutions.installationStatus} = ''`));
      } else if (filters.status === "Installation Completed") {
        conditions.push(or(
          eq(courierExecutions.installationStatus, "Installation Completed"),
          eq(courierExecutions.installationStatus, "Installation Completed - NL")
        ));
      } else {
        conditions.push(eq(courierExecutions.installationStatus, filters.status));
      }
    }
    if (filters.reason) {
      conditions.push(eq(courierExecutions.responseReasonCode, filters.reason));
    }
    if (filters.simType) {
      conditions.push(eq(courierExecutions.simType, filters.simType));
    }
    if (filters.vendor) {
      conditions.push(eq(courierRequests.vendorType, filters.vendor));
    }
    if (filters.priority) {
      conditions.push(eq(courierExecutions.requestPriorityLevel, filters.priority));
    }
    if (filters.dateFrom) {
      conditions.push(sql`${courierRequests.date} >= ${filters.dateFrom}`);
    }
    if (filters.dateTo) {
      conditions.push(sql`${courierRequests.date} <= ${filters.dateTo}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes] = await db
      .select({ count: count() })
      .from(courierRequests)
      .leftJoin(courierExecutions, eq(courierExecutions.requestId, courierRequests.id))
      .where(whereClause);

    const rows = await db
      .select({
        request: courierRequests,
        execution: courierExecutions,
        createdByName: users.fullName
      })
      .from(courierRequests)
      .leftJoin(courierExecutions, eq(courierExecutions.requestId, courierRequests.id))
      .leftJoin(users, eq(users.id, courierRequests.createdBy))
      .where(whereClause)
      .orderBy(desc(courierRequests.id))
      .limit(pageSize)
      .offset(offset);

    return {
      rows: rows.map((r) => ({
        ...r.request,
        created_by_name: r.createdByName,
        execution: r.execution
      })),
      total: totalRes?.count || 0
    };
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
