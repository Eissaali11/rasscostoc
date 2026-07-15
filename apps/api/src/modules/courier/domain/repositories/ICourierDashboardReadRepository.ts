export interface ICourierDashboardReadRepository {
  getDashboardStats(tx?: any): Promise<{
    totalRequests: number;
    statuses: Record<string, number>;
    failures: Record<string, number>;
  }>;
  getAiMonitorStats(tx?: any): Promise<{
    totalProcessed: number;
    totalApplied: number;
    averageConfidence: number;
  }>;
  listAuditLogs(limit?: number, tx?: any): Promise<any[]>;
  insertAuditLog(logData: any, tx?: any): Promise<void>;
}
