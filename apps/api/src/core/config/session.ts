/**
 * Session configuration
 */

import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express } from "express";
import { pool } from "@core/config/db";
import { logger } from "@server/utils/logger";

// Extend Express Session to include user data
declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      role: string;
      username: string;
      regionId: string | null;
    };
  }
}

// Initialize PostgreSQL session store
const PgSession = connectPgSimple(session);

export function setupSession(app: Express): void {
  const isProduction = process.env.NODE_ENV === "production";
  const isHttps = process.env.HTTPS === "true" || (isProduction && process.env.TRUST_PROXY === "true");

  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  const sessionConfig: session.SessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isHttps, // Only secure on HTTPS
      httpOnly: true,
      sameSite: isHttps ? "none" : "lax", // Support cross-origin on HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (increased from 24 hours)
    },
    name: "sessionId",
  };

  // Use PostgreSQL store for persistent sessions
  sessionConfig.store = new PgSession({
    pool: pool, // Use existing database connection pool
    tableName: "session", // Table name for storing sessions
    createTableIfMissing: true, // Automatically create table if it doesn't exist
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
  });
  
  logger.info("Using PostgreSQL session store with auto-table creation", { source: "session" });

  app.use(session(sessionConfig));
}
