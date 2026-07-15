import type { CourierRequest, CourierExecution, CourierRequestItem, CourierExecutionAttempt } from "../courier.types";
import type { ListFilters, ItemUpdatePayload } from "../courier.types";

export interface ICourierRepository {
  // ── Request CRUD ──────────────────────────────────────────────────────────
  findRequestById(id: number, tx?: any): Promise<CourierRequest | null>;
  findRequestWithDetails(id: number, tx?: any): Promise<any | null>;
  findRequestByTid(tid: string, tx?: any): Promise<CourierRequest | null>;
  findExecutionByRequestId(requestId: number, tx?: any): Promise<CourierExecution | null>;
  listRequests(filters: ListFilters): Promise<{
    rows: any[];
    total: number;
    meta?: { sqlMs: number; countMs: number; rowsMs: number };
  }>;
  /** Full filtered set for Excel export (no pagination). */
  listRequestsForExport(filters: ListFilters): Promise<any[]>;
  listRequestsForExportPaged(filters: ListFilters, offset: number, limit: number): Promise<any[]>;
  countRequests(filters: ListFilters): Promise<number>;
  updateRequest(id: number, requestData: any, expectedVersion?: number, tx?: any): Promise<CourierRequest | null>;
  updateExecution(requestId: number, executionData: any, expectedVersion?: number, tx?: any): Promise<CourierExecution | null>;
  insertRequest(requestData: any, tx?: any): Promise<CourierRequest>;
  insertExecution(executionData: any, tx?: any): Promise<CourierExecution>;
  deleteRequest(id: number, tx?: any): Promise<boolean>;
  insertAuditLog(logData: any, tx?: any): Promise<void>;
  getLookups(tx?: any): Promise<any>;
  getDashboardStats(): Promise<{
    totalRequests: number;
    statuses: Record<string, number>;
    failures: Record<string, number>;
  }>;
  getAiMonitorStats(): Promise<{
    totalProcessed: number;
    totalApplied: number;
    averageConfidence: number;
  }>;

  // ── Request Items ─────────────────────────────────────────────────────────
  findRequestItems(requestId: number, tx?: any): Promise<CourierRequestItem[]>;
  findRequestItemBySerial(serial: string, tx?: any): Promise<CourierRequestItem[]>;
  findRequestItemById(id: number, tx?: any): Promise<CourierRequestItem | null>;
  insertRequestItems(items: any[], tx?: any): Promise<CourierRequestItem[]>;
  updateRequestItem(id: number, itemData: any, tx?: any): Promise<CourierRequestItem | null>;
  /** Delete all items attached to a request (used in re-assign flow). */
  deleteRequestItems(requestId: number, tx?: any): Promise<void>;
  /** Find request items by serial/simSerial across all requests. Used to detect conflicts. */
  findRequestItemsBySerials(serials: string[], statusFilter?: string, tx?: any): Promise<CourierRequestItem[]>;
  /** Bulk update a set of request items in one shot. */
  bulkUpdateRequestItems(updates: ItemUpdatePayload[], tx?: any): Promise<void>;

  // ── Execution Attempts ────────────────────────────────────────────────────
  findExecutionAttempts(requestId: number, tx?: any): Promise<CourierExecutionAttempt[]>;
  insertExecutionAttempt(attemptData: any, tx?: any): Promise<CourierExecutionAttempt>;

  // ── PDF Reports ───────────────────────────────────────────────────────────
  findPdfReportById(id: number, tx?: any): Promise<any | null>;
  listPdfReports(tx?: any): Promise<any[]>;
  insertPdfReport(data: any, tx?: any): Promise<any>;
  updatePdfReport(id: number, data: any, tx?: any): Promise<any>;

  // ── Transactions (Unit of Work) ───────────────────────────────────────────
  /** Execute a block inside a database transaction. */
  transaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;

  // ── Serial Lookup ─────────────────────────────────────────────────────────
  /** Resolve item type row and owner technician for a given inventory item id/type. */
  findItemTypeById(itemTypeId: string, tx?: any): Promise<{ id: string; nameAr: string; nameEn: string; category: string } | null>;
  findUserById(userId: string, tx?: any): Promise<{ id: string; fullName: string; username: string; technicianCode: string | null } | null>;
  /** Find the linked courier request item for a given inventory item serial. */
  findLinkedRequestItemBySerial(serial: string, tx?: any): Promise<{ requestId: number; id: number; itemType: string; status: string } | null>;

  // ── Import / Bulk ─────────────────────────────────────────────────────────
  /** Check duplicate TID existence before import. */
  existsRequestWithTid(tid: string, tx?: any): Promise<boolean>;
  insertRequestBulk(requests: any[], tx?: any): Promise<CourierRequest[]>;

  // ── Audit Logs ────────────────────────────────────────────────────────────
  listAuditLogs(limit?: number): Promise<any[]>;
}
