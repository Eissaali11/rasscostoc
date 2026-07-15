import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { regions } from "./catalog.schema";
import { users } from "./organization.schema";

export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  regionId: varchar("region_id").references(() => regions.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  entityName: text("entity_name"),
  details: text("details"),
  description: text("description").notNull(),
  severity: text("severity").notNull().default("info"),
  success: boolean("success").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: varchar("key").primaryKey(),
  responseStatus: integer("response_status").notNull(),
  responseBody: text("response_body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  createdAt: true,
});

export const insertIdempotencyKeySchema = createInsertSchema(idempotencyKeys);

export const coreJobs = pgTable("core_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 50 }).notNull(), // 'EXPORT_EXCEL', 'BULK_IMPORT', 'AI_PROCESS'
  status: varchar("status", { length: 20 }).notNull().default("PENDING"), // 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  progress: integer("progress").notNull().default(0),
  progressDetails: text("progress_details"), // JSON: { processedRows, totalRows, etaSeconds, currentStep }
  payload: text("payload"), // JSON payload as text
  resultUrl: varchar("result_url", { length: 512 }),
  resultMetadata: text("result_metadata"), // JSON: { url, size, mime, checksum, expires }
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  nextRetryAt: timestamp("next_retry_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertCoreJobSchema = createInsertSchema(coreJobs);

export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
export type SystemLog = typeof systemLogs.$inferSelect;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type InsertIdempotencyKey = z.infer<typeof insertIdempotencyKeySchema>;
export type CoreJob = typeof coreJobs.$inferSelect;
export type InsertCoreJob = z.infer<typeof insertCoreJobSchema>;


