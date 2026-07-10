import type { InsertSystemLog, SystemLog } from "@shared/schema";

export type SystemLogsFilters = {
  limit?: number;
  offset?: number;
  userId?: string;
  regionId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  severity?: string;
  startDate?: Date | string;
  endDate?: Date | string;
};

export interface ISystemLogsRepository {
  getSystemLogs(filters?: SystemLogsFilters): Promise<SystemLog[]>;
  createSystemLog(log: InsertSystemLog): Promise<SystemLog>;
}
