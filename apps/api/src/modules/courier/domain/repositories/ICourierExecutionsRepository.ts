import type { CourierExecution, CourierExecutionAttempt } from "../courier.types";

export interface ICourierExecutionsRepository {
  findExecutionByRequestId(requestId: number, tx?: any): Promise<CourierExecution | null>;
  updateExecution(requestId: number, executionData: any, expectedVersion?: number, tx?: any): Promise<CourierExecution | null>;
  insertExecution(executionData: any, tx?: any): Promise<CourierExecution>;
  findExecutionAttempts(requestId: number, tx?: any): Promise<CourierExecutionAttempt[]>;
  insertExecutionAttempt(attemptData: any, tx?: any): Promise<CourierExecutionAttempt>;
}
