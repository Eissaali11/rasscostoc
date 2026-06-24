import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const { Pool } = pg;

// Masked log of DATABASE_URL to help debugging (do not log full password)
if (process.env.DATABASE_URL) {
  try {
    const masked = process.env.DATABASE_URL.replace(/:\/\/:([^:]+):([^@]+)@/, '://$1:***@');
    // eslint-disable-next-line no-console
    console.info('[db] Using DATABASE_URL:', masked);
  } catch (e) {
    // ignore masking errors
  }
}

// Use standard PostgreSQL driver (works with both local and cloud PostgreSQL)
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
