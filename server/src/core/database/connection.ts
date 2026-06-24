import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;
import type { Pool as PgPool } from "pg";
import { logger } from "@server/shared/utils/logger";
import * as schema from "@shared/schema";

/**
 * Database Connection Management
 * Centralized database initialization and configuration
 */

let db: ReturnType<typeof drizzle<typeof schema>>;
let pool: PgPool;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  return url;
}

export async function initializeDatabase(): Promise<void> {
  try {
    const databaseUrl = getDatabaseUrl();
    
    // Log masked URL for security
    const maskedUrl = databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
    logger.info(`Connecting to database: ${maskedUrl}`);

    // Create connection pool
    // Do not force SSL by NODE_ENV; rely on DATABASE_URL options (e.g. sslmode=require)
    pool = new Pool({
      connectionString: databaseUrl,
    });

    // Initialize Drizzle
    db = drizzle(pool, { schema });

    // Test connection
    await pool.query('SELECT 1');
    logger.info("Database connection test successful");

  } catch (error) {
    logger.error("Failed to initialize database:", error);
    throw error;
  }
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info("Database connection closed");
  }
}