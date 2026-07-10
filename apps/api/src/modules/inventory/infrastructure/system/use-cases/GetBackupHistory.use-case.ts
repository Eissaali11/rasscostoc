import { getDatabase } from "@core/database/connection";
import { sql } from "drizzle-orm";

export class GetBackupHistoryUseCase {
  async execute(limit: number): Promise<any[]> {
    const db = getDatabase();

    const historyResult = await db.execute(sql`
      SELECT id, entity_name, details, created_at
      FROM system_logs
      WHERE entity_type = 'backup'
        AND action = 'export'
        AND success = true
      ORDER BY created_at DESC
      LIMIT ${limit};
    `);

    return historyResult.rows.map((row: any) => {
      let details: Record<string, unknown> = {};

      if (typeof row.details === 'string' && row.details.trim().length > 0) {
        try {
          details = JSON.parse(row.details);
        } catch {
          details = {};
        }
      }

      const createdAtIso = row.created_at ? new Date(row.created_at).toISOString() : null;
      const fallbackName = createdAtIso
        ? `backup_${createdAtIso.replace(/[:.]/g, '-')}.json`
        : 'backup_unknown.json';

      return {
        id: String(row.id),
        name: String((details.filename as string) || row.entity_name || fallbackName),
        createdAt: createdAtIso,
        sizeBytes: Number(details.backupSizeBytes ?? 0),
        type: 'سحابي',
      };
    });
  }
}
