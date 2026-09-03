import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import { employeePermissionOverrides, permissionChangeAudit } from "@shared/schema";
import type {
  ApplyOverrideChangeInput,
  IPermissionsRepository,
  PermissionChangeAuditEntry,
} from "../domain/repositories/IPermissionsRepository";
import { OverrideVersionConflictError } from "../domain/repositories/IPermissionsRepository";
import type { OverrideValue, PermissionOverride } from "../domain/types";

function toDomain(row: typeof employeePermissionOverrides.$inferSelect): PermissionOverride {
  return {
    id: row.id,
    userId: row.userId,
    page: row.page,
    action: row.action,
    value: row.value as OverrideValue,
    grantedBy: row.grantedBy,
    version: row.version,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
  };
}

export class DrizzlePermissionsRepository implements IPermissionsRepository {
  async getOverridesForUser(userId: string): Promise<PermissionOverride[]> {
    const rows = await getDatabase().select().from(employeePermissionOverrides).where(eq(employeePermissionOverrides.userId, userId));
    return rows.map(toDomain);
  }

  async applyOverrideChange(input: ApplyOverrideChangeInput): Promise<PermissionOverride | null> {
    const db = getDatabase();

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(employeePermissionOverrides)
        .where(
          and(
            eq(employeePermissionOverrides.userId, input.targetUserId),
            eq(employeePermissionOverrides.page, input.page),
            eq(employeePermissionOverrides.action, input.action)
          )
        )
        .limit(1);

      if (input.expectedVersion !== undefined) {
        if (!existing || existing.version !== input.expectedVersion) {
          throw new OverrideVersionConflictError();
        }
      }

      let result: PermissionOverride | null = null;

      if (input.newValue === null) {
        // Reset: delete the override row entirely, if present. Idempotent — resetting an
        // already-default permission is a legitimate no-op, not an error.
        if (existing) {
          await tx.delete(employeePermissionOverrides).where(eq(employeePermissionOverrides.id, existing.id));
        }
      } else if (existing) {
        const [updated] = await tx
          .update(employeePermissionOverrides)
          .set({ value: input.newValue, grantedBy: input.grantedBy, version: existing.version + 1, updatedAt: new Date() })
          .where(eq(employeePermissionOverrides.id, existing.id))
          .returning();
        result = toDomain(updated);
      } else {
        const [inserted] = await tx
          .insert(employeePermissionOverrides)
          .values({ userId: input.targetUserId, page: input.page, action: input.action, value: input.newValue, grantedBy: input.grantedBy })
          .returning();
        result = toDomain(inserted);
      }

      await tx.insert(permissionChangeAudit).values({
        changedBy: input.grantedBy,
        targetUserId: input.targetUserId,
        page: input.page,
        action: input.action,
        oldValue: existing?.value ?? null,
        newValue: input.newValue,
        reason: input.reason ?? null,
      });

      return result;
    });
  }

  async getAuditHistory(targetUserId: string, limit = 100): Promise<PermissionChangeAuditEntry[]> {
    const rows = await getDatabase()
      .select()
      .from(permissionChangeAudit)
      .where(eq(permissionChangeAudit.targetUserId, targetUserId))
      .orderBy(desc(permissionChangeAudit.changedAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      changedBy: row.changedBy,
      targetUserId: row.targetUserId,
      page: row.page,
      action: row.action,
      oldValue: row.oldValue,
      newValue: row.newValue,
      reason: row.reason,
      changedAt: row.changedAt ?? new Date(),
    }));
  }
}
