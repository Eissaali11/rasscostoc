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
    const masked = process.env.DATABASE_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
    // eslint-disable-next-line no-console
    console.info('[db] Using DATABASE_URL:', masked);
  } catch (e) {
    // ignore masking errors
  }
}

// ERP-008 Phase 4: max was previously unset, silently defaulting to pg's
// built-in ceiling of 10 per process. Under multi-process/PM2-cluster
// operation, total connections = this value × process count × node count,
// which must stay under Postgres's own max_connections — see
// docs/production/ERP-008-PRODUCTION-HARDENING.md Phase 4 §11 for the
// budget worked out for this deployment. Configurable so ops can tune it
// per-environment without a code change.
const poolMax = process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : 10;

// Use standard PostgreSQL driver (works with both local and cloud PostgreSQL)
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: poolMax });
export const db = drizzle({ client: pool, schema });
