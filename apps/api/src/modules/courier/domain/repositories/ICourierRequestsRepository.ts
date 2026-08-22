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
  deleteAllRequests(tx?: any): Promise<number>;
  existsRequestWithTid(tid: string, tx?: any): Promise<boolean>;
  insertRequestBulk(requests: any[], tx?: any): Promise<CourierRequest[]>;
  // OPS-PERM-S0-B1-B.I1: server-side region-assignment contract — validates a
  // region id against the trusted regions table (existence + isActive) before
  // it is ever allowed to become courier_requests.region_id. Never trust a
  // client-supplied region id as valid without this check.
  findActiveRegionById(regionId: string, tx?: any): Promise<{ id: string; name: string } | null>;

  // Request Items
  findRequestItems(requestId: number, tx?: any): Promise<CourierRequestItem[]>;
  findRequestItemBySerial(serial: string, tx?: any): Promise<CourierRequestItem[]>;
  findRequestItemById(id: number, tx?: any): Promise<CourierRequestItem | null>;
  insertRequestItems(items: any[], tx?: any): Promise<CourierRequestItem[]>;
  updateRequestItem(id: number, itemData: any, tx?: any): Promise<CourierRequestItem | null>;
  deleteRequestItems(requestId: number, tx?: any): Promise<void>;
  findRequestItemsBySerials(serials: string[], statusFilter?: string, tx?: any): Promise<CourierRequestItem[]>;
  bulkUpdateRequestItems(updates: ItemUpdatePayload[], tx?: any): Promise<void>;
  getLookups(actor: { role: string; regionId: string | null }, tx?: any): Promise<any>;

  // Export & Count (required for async job handler without direct DB access)
  listRequestsForExport(filters: ListFilters): Promise<any[]>;
  listRequestsForExportPaged(filters: ListFilters, offset: number, limit: number): Promise<any[]>;
  countRequests(filters: ListFilters): Promise<number>;
}
