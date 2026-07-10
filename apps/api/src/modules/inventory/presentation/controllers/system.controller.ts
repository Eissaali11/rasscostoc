/**
 * System controller (logs, backup, etc.)
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { z } from "zod";
import type { ISystemLogsRepository } from "@modules/inventory/application/system-logs/contracts/ISystemLogsRepository";
import type { ExportSystemBackupUseCase } from "@modules/inventory/infrastructure/system/use-cases/ExportSystemBackup.use-case";
import type { ImportSystemBackupUseCase } from "@modules/inventory/infrastructure/system/use-cases/ImportSystemBackup.use-case";
import type { GetBackupHistoryUseCase } from "@modules/inventory/infrastructure/system/use-cases/GetBackupHistory.use-case";
import type { GetBackupStorageStatsUseCase } from "@modules/inventory/infrastructure/system/use-cases/GetBackupStorageStats.use-case";
import type { GetSystemLogsUseCase } from "@modules/inventory/application/system-logs/use-cases/GetSystemLogs.use-case";

const systemLogsFiltersSchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val) : undefined)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val) : undefined)),
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  severity: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export class SystemController {
  constructor(
    private readonly systemLogsRepository: ISystemLogsRepository,
    private readonly exportSystemBackupUseCase: ExportSystemBackupUseCase,
    private readonly importSystemBackupUseCase: ImportSystemBackupUseCase,
    private readonly getBackupHistoryUseCase: GetBackupHistoryUseCase,
    private readonly getBackupStorageStatsUseCase: GetBackupStorageStatsUseCase,
    private readonly getSystemLogsUseCase: GetSystemLogsUseCase,
  ) {}

  /**
   * GET /api/system-logs
   * Get system logs
   */
  getLogs = asyncHandler(async (req: Request, res: Response) => {
    const query = systemLogsFiltersSchema.parse(req.query);

    const filters: any = {
      page: query.page,
      limit: query.limit,
      userId: query.userId,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      severity: query.severity,
      startDate: query.startDate,
      endDate: query.endDate,
    };

    // Remove undefined filters
    Object.keys(filters).forEach((key) => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    const result = await this.getSystemLogsUseCase.execute(filters);
    res.json(result);
  });

  /**
   * GET /api/admin/backup
   * Create database backup
   */
  createBackup = asyncHandler(async (req: Request, res: Response) => {
    const backup = await this.exportSystemBackupUseCase.execute();
    const backupPayload = JSON.stringify(backup);
    const backupSizeBytes = Buffer.byteLength(backupPayload, "utf8");
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    
    // Log the backup operation
    await this.systemLogsRepository.createSystemLog({
      userId: req.user!.id,
      userName: req.user!.username,
      userRole: req.user!.role,
      action: 'export',
      entityType: 'backup',
      entityId: 'system',
      entityName: 'نسخة احتياطية كاملة',
      description: 'تصدير نسخة احتياطية كاملة لجميع بيانات النظام',
      details: JSON.stringify({
        backupSizeBytes,
        exportedAt: backup.exportedAt,
        filename,
      }),
      severity: 'info',
      success: true
    });
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup);
  });

  /**
   * GET /api/admin/backup/history
   * Return backup history from system logs
   */
  getBackupHistory = asyncHandler(async (req: Request, res: Response) => {
    const parsedLimit = Number(req.query.limit ?? 25);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.floor(parsedLimit), 1), 200)
      : 25;

    const items = await this.getBackupHistoryUseCase.execute(limit);
    res.json({ items });
  });

  /**
   * POST /api/admin/restore
   * Restore database from backup
   */
  restoreBackup = asyncHandler(async (req: Request, res: Response) => {
    const backup = req.body;

    if (!backup || !backup.data) {
      res.status(400).json({ 
        success: false,
        message: "Invalid backup file" 
      });
      return;
    }

    const imported = await this.importSystemBackupUseCase.execute(backup);

    // Log the restore operation
    const restorePayload = JSON.stringify(backup);
    const restoreSizeBytes = Buffer.byteLength(restorePayload, "utf8");

    await this.systemLogsRepository.createSystemLog({
      userId: req.user!.id,
      userName: req.user!.username,
      userRole: req.user!.role,
      action: 'import',
      entityType: 'backup',
      entityId: 'system',
      entityName: 'استعادة نسخة احتياطية',
      description: 'استعادة نسخة احتياطية كاملة لجميع بيانات النظام',
      details: JSON.stringify({
        restoreSizeBytes,
        imported,
      }),
      severity: 'warning',
      success: true
    });

    res.json({ success: true, message: "Backup restored successfully", imported });
  });

  /**
   * GET /api/admin/backup/storage-stats
   * Return live storage stats based on stored database size
   */
  getBackupStorageStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await this.getBackupStorageStatsUseCase.execute();
    res.json(stats);
  });
}
