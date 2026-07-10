import type { CourierRequest, CourierExecution, CourierRequestItem, CourierExecutionAttempt } from "@shared/schema";
import type { ListFilters } from "../../application/courier.service";

export interface ICourierRepository {
  findRequestById(id: number, tx?: any): Promise<CourierRequest | null>;
  findRequestWithDetails(id: number, tx?: any): Promise<any | null>;
  findExecutionByRequestId(requestId: number, tx?: any): Promise<CourierExecution | null>;
  listRequests(filters: ListFilters): Promise<{ rows: any[]; total: number }>;
  updateRequest(id: number, requestData: any, expectedVersion?: number, tx?: any): Promise<CourierRequest | null>;
  updateExecution(requestId: number, executionData: any, expectedVersion?: number, tx?: any): Promise<CourierExecution | null>;
  insertRequest(requestData: any, tx?: any): Promise<CourierRequest>;
  insertExecution(executionData: any, tx?: any): Promise<CourierExecution>;
  deleteRequest(id: number, tx?: any): Promise<boolean>;
  insertAuditLog(logData: any, tx?: any): Promise<void>;
  getLookups(tx?: any): Promise<any>;

  // Request Items
  findRequestItems(requestId: number, tx?: any): Promise<CourierRequestItem[]>;
  findRequestItemBySerial(serial: string, tx?: any): Promise<CourierRequestItem[]>;
  findRequestItemById(id: number, tx?: any): Promise<CourierRequestItem | null>;
  insertRequestItems(items: any[], tx?: any): Promise<CourierRequestItem[]>;
  updateRequestItem(id: number, itemData: any, tx?: any): Promise<CourierRequestItem | null>;

  // Execution Attempts
  findExecutionAttempts(requestId: number, tx?: any): Promise<CourierExecutionAttempt[]>;
  insertExecutionAttempt(attemptData: any, tx?: any): Promise<CourierExecutionAttempt>;
}
