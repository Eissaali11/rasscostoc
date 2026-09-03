/**
 * OPS-PERM-S1-F4 — Permission Engine storage.
 *
 * Two additive tables only. Region scope reads directly off the existing
 * `users.region_id`; warehouse scope reads the existing `supervisor_warehouses`
 * relation — neither is duplicated here (OPS-PERM-S1-F3 §7: "avoid
 * duplicating domain relationships merely for the Permission Engine").
 * `users.permissions` (legacy free-text) is not read, migrated, or reused.
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./organization.schema";

/** Per-employee assigned permission overrides — "Assigned Permissions" (OPS-PERM-S1-F3 §4).
 * One row per (user, page, action); `value` is the explicit grant or revoke. Absence of a row for
 * a given (page, action) means "no override" — the evaluator falls through to the role's default
 * template, never to any other fallback. */
export const employeePermissionOverrides = pgTable(
  "employee_permission_overrides",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    page: text("page").notNull(),
    action: text("action").notNull(),
    value: text("value").notNull(), // 'grant' | 'revoke'
    grantedBy: varchar("granted_by").notNull().references(() => users.id),
    // Optimistic concurrency: incremented on every update by the write path, never by the client.
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userPageAction: unique("employee_permission_overrides_user_page_action_key").on(table.userId, table.page, table.action),
  })
);

/** Append-only change history for every permission write — same shape/intent as the existing
 * `system_logs` audit pattern used by courier/dashboard writes, applied here rather than
 * reinvented. Never updated or deleted by application code. */
export const permissionChangeAudit = pgTable("permission_change_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changedBy: varchar("changed_by").notNull().references(() => users.id),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id),
  page: text("page").notNull(),
  action: text("action").notNull(),
  oldValue: text("old_value"), // null | 'grant' | 'revoke'
  newValue: text("new_value"), // null (reset) | 'grant' | 'revoke'
  reason: text("reason"),
  changedAt: timestamp("changed_at").defaultNow(),
});

export const insertEmployeePermissionOverrideSchema = createInsertSchema(employeePermissionOverrides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPermissionChangeAuditSchema = createInsertSchema(permissionChangeAudit).omit({
  id: true,
  changedAt: true,
});

export type EmployeePermissionOverrideRow = typeof employeePermissionOverrides.$inferSelect;
export type InsertEmployeePermissionOverrideRow = z.infer<typeof insertEmployeePermissionOverrideSchema>;
export type PermissionChangeAuditRow = typeof permissionChangeAudit.$inferSelect;
export type InsertPermissionChangeAuditRow = z.infer<typeof insertPermissionChangeAuditSchema>;
