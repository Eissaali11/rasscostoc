import { logger } from "@server/shared/utils/logger";
import { db as sharedDb, pool as sharedPool } from "@core/config/db";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { configService } from "@core/config/config.service";

/**
 * Database Connection Management
 * Centralized database initialization and configuration
 */

let db: ReturnType<typeof drizzle<typeof schema>> = sharedDb;
let pool = sharedPool;

function getDatabaseUrl(): string {
  return configService.databaseUrl;
}

export async function initializeDatabase(): Promise<void> {
  try {
    const databaseUrl = getDatabaseUrl();
    
    // Log masked URL for security
    const maskedUrl = databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
    logger.info(`Connecting to database: ${maskedUrl}`);

    // Test connection using the shared pool
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