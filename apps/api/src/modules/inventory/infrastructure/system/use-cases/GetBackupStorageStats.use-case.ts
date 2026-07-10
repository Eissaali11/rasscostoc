import { getDatabase } from "@core/database/connection";
import { sql } from "drizzle-orm";

export class GetBackupStorageStatsUseCase {
  async execute(): Promise<any> {
    const db = getDatabase();

    const sizeResult = await db.execute(sql`
      SELECT pg_database_size(current_database())::bigint AS used_bytes;
    `);

    const usedBytes = Number(sizeResult.rows?.[0]?.used_bytes ?? 0);

    const configuredCapacityGb = Number(process.env.BACKUP_STORAGE_CAPACITY_GB ?? "0");
    const totalBytes = configuredCapacityGb > 0
      ? Math.round(configuredCapacityGb * 1024 * 1024 * 1024)
      : usedBytes;

    const availableBytes = Math.max(totalBytes - usedBytes, 0);
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

    const lastBackupResult = await db.execute(sql`
      SELECT created_at
      FROM system_logs
      WHERE entity_type = 'backup'
        AND action = 'export'
        AND success = true
      ORDER BY created_at DESC
      LIMIT 1;
    `);

    const exportsCountResult = await db.execute(sql`
      SELECT COUNT(*)::bigint AS exports_count
      FROM system_logs
      WHERE entity_type = 'backup'
        AND action = 'export'
        AND success = true;
    `);

    const exportsCount = Number(exportsCountResult.rows?.[0]?.exports_count ?? 0);
    const lastBackupAt = lastBackupResult.rows?.[0]?.created_at ?? null;

    return {
      usedBytes,
      totalBytes,
      availableBytes,
      usedPercent,
      exportsCount,
      lastBackupAt,
      hasConfiguredCapacity: configuredCapacityGb > 0,
    };
  }
}
