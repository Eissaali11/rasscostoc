import 'dotenv/config';
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../server/src/core/config/db";

async function runMigrations() {
  console.log("⏳ Running migrations...");
  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migrations failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
