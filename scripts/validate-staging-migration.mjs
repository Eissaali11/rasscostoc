import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const databaseUrl = "postgresql://postgres:postgres@localhost:5432/nulip_staging";

async function run() {
  console.log("⏳ Connecting to staging database...");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  console.log("⏳ Resolving bearer_sessions table conflict (dropping legacy table)...");
  const dropStart = Date.now();
  await client.query("DROP TABLE IF EXISTS public.bearer_sessions CASCADE");
  const dropDuration = Date.now() - dropStart;
  console.log(`✅ Dropped legacy bearer_sessions table in ${dropDuration}ms.`);

  const db = drizzle(client);
  const migrationsFolder = resolve(root, "migrations");

  console.log(`⏳ Running Drizzle migrations from: ${migrationsFolder}...`);
  const migrateStart = Date.now();
  let migrateError = null;

  try {
    await migrate(db, { migrationsFolder });
    console.log(`✅ Migrations applied successfully in ${Date.now() - migrateStart}ms!`);
  } catch (err) {
    migrateError = err;
    console.error("❌ Migration execution failed:", err);
  }

  if (!migrateError) {
    console.log("⏳ Verifying new table structures...");

    // Check bearer_sessions structure
    const bsCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'bearer_sessions'
      ORDER BY column_name
    `);
    console.log("\n## bearer_sessions verified columns (snake_case):");
    for (const c of bsCols.rows) {
      console.log(`- ${c.column_name}: ${c.data_type}`);
    }

    // Check newly added tables
    const tables = ["refresh_tokens", "courier_requests", "idempotency_records", "outbox_events"];
    console.log("\n## Newly created tables status:");
    for (const t of tables) {
      const res = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = $1
        ) AS ok
      `, [t]);
      console.log(`- Table '${t}': ${res.rows[0].ok ? "CREATED" : "MISSING"}`);
    }

    // Check users modifications
    const usersCols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('employee_code', 'technician_code', 'department', 'permissions')
    `);
    console.log("\n## users new columns added:");
    for (const c of usersCols.rows) {
      console.log(`- ${c.column_name}`);
    }
  }

  await client.end();
  if (migrateError) process.exit(1);
}

run().catch((e) => {
  console.error("Fatal validation error:", e);
  process.exit(1);
});
