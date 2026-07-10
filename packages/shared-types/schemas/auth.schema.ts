import { z } from "zod";
import { pgTable, text, varchar, timestamp, boolean, bigint } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users, type UserSafe } from "./organization.schema";

export const loginSchema = z.object({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export type LoginRequest = z.infer<typeof loginSchema>;

export type AuthResponse = {
  user: UserSafe;
  token?: string;
  refreshToken?: string;
  success: boolean;
  message?: string;
};

// Refresh tokens table for handling SSO & token rotation
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiry: timestamp("expiry").notNull(),
  isRevoked: boolean("is_revoked").notNull().default(false),
  replacedBy: text("replaced_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type RefreshToken = typeof refreshTokens.$inferSelect;

/**
 * Bearer sessions table — managed by Drizzle (replaces ad-hoc raw SQL creation in auth.middleware.ts)
 * Used as a fallback session store for legacy bearer tokens.
 */
export const bearerSessions = pgTable("bearer_sessions", {
  token: varchar("token", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  regionId: varchar("region_id", { length: 255 }),
  expiry: bigint("expiry", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type BearerSession = typeof bearerSessions.$inferSelect;
