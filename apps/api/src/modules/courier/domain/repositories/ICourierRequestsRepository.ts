import type { CourierRequest, CourierRequestItem } from "../courier.types";
import type { ListFilters, ItemUpdatePayload } from "../courier.types";

export interface ICourierRequestsRepository {
  findRequestById(id: number, tx?: any): Promise<CourierRequest | null>;
  findRequestWithDetails(id: number, tx?: any): Promise<any | null>;
  findRequestByTid(tid: string, tx?: any): Promise<CourierRequest | null>;
  listRequests(filters: ListFilters): Promise<{
    rows: any[];
    total: number;
    meta?: { sqlMs: number; countMs: number; rowsMs: number };
  }>;
  listRequestsForExport(filters: ListFilters): Promise<any[]>;
  listRequestsForExportPaged(filters: ListFilters, offset: number, limit: number): Promise<any[]>;
  countRequests(filters: ListFilters): Promise<number>;
  updateRequest(id: number, requestData: any, expectedVersion?: number, tx?: any): Promise<CourierRequest | null>;
  insertRequest(requestData: any, tx?: any): Promise<CourierRequest>;
  deleteRequest(id: number, tx?: any): Promise<boolean>;
  existsRequestWithTid(tid: string, tx?: any): Promise<boolean>;
  insertRequestBulk(requests: any[], tx?: any): Promise<CourierRequest[]>;

  // Request Items
  findRequestItems(requestId: number, tx?: any): Promise<CourierRequestItem[]>;
  findRequestItemBySerial(serial: string, tx?: any): Promise<CourierRequestItem[]>;
  findRequestItemById(id: number, tx?: any): Promise<CourierRequestItem | null>;
  insertRequestItems(items: any[], tx?: any): Promise<CourierRequestItem[]>;
  updateRequestItem(id: number, itemData: any, tx?: any): Promise<CourierRequestItem | null>;
  deleteRequestItems(requestId: number, tx?: any): Promise<void>;
  findRequestItemsBySerials(serials: string[], statusFilter?: string, tx?: any): Promise<CourierRequestItem[]>;
  bulkUpdateRequestItems(updates: ItemUpdatePayload[], tx?: any): Promise<void>;
  getLookups(tx?: any): Promise<any>;

  // Export & Count (required for async job handler without direct DB access)
  listRequestsForExport(filters: ListFilters): Promise<any[]>;
  listRequestsForExportPaged(filters: ListFilters, offset: number, limit: number): Promise<any[]>;
  countRequests(filters: ListFilters): Promise<number>;
}
