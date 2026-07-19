import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const backupFilePath = resolve(root, "nulip_inventory_backup_20260719.sql");

if (!existsSync(backupFilePath)) {
  console.error(`Backup file not found at: ${backupFilePath}`);
  process.exit(1);
}

const appliedMigrations = [
  { id: 1, hash: "fe5a7ef38917fbd744a0a98921dcfdbbd815a16349999cdddd70afc351056e00", created_at: 1782159739107 },
  { id: 2, hash: "9ace02ea7ae666e768c41a8a6cc5f3088d836f0ce9a251cb041fe281b66c52a5", created_at: 1782160689493 },
  { id: 3, hash: "9b20446facb8a75ec3635560803abb33f5a798d6be411e068b49d490d1399dbf", created_at: 1782163987379 },
  { id: 4, hash: "015a3df75341b6623554ec152cc0fec4b67b7ad7b62811c3dfbf570491f93643", created_at: 1782167002041 },
  { id: 5, hash: "1f1995a7d34d7b52622914ceb04a0280d15b6a766fc10ddeb9a9699341b0d9fe", created_at: 1782167114378 },
  { id: 7, hash: "241de7303d75ac6358fb4eb2f704133808f863518b4fe195c0b70ad55d4853c7", created_at: 1782180396856 },
  { id: 8, hash: "02761e5b18c2ed7045b33441e762694e8a157cdaae523bfb2f308b08bd285c6c", created_at: 1782335912798 }
];

async function run() {
  console.log("⏳ Connecting to local default Postgres...");
  const adminClient = new pg.Client({
    connectionString: "postgresql://postgres:postgres@localhost:5432/postgres",
  });
  await adminClient.connect();

  console.log("⏳ Terminating active connections to nulip_staging...");
  try {
    await adminClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'nulip_staging' AND pid <> pg_backend_pid()
    `);
  } catch (err) {
    console.warn("Warning terminating connections:", err.message);
  }

  console.log("⏳ Dropping database nulip_staging if exists...");
  await adminClient.query("DROP DATABASE IF EXISTS nulip_staging");

  console.log("⏳ Creating database nulip_staging...");
  await adminClient.query("CREATE DATABASE nulip_staging");
  await adminClient.end();

  console.log("⏳ Connecting to nulip_staging...");
  const stagingClient = new pg.Client({
    connectionString: "postgresql://postgres:postgres@localhost:5432/nulip_staging",
  });
  await stagingClient.connect();

  console.log("⏳ Loading and parsing SQL dump content (Schema only)...");
  const rawSql = readFileSync(backupFilePath, "utf8");
  const lines = rawSql.split(/\r?\n/);
  const cleanStatements = [];
  let inCopyBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("\\")) {
      if (trimmed === "\\.") {
        inCopyBlock = false;
      }
      continue;
    }

    if (trimmed.startsWith("COPY ")) {
      inCopyBlock = true;
      continue;
    }

    if (inCopyBlock) {
      continue;
    }

    cleanStatements.push(line);
  }

  const sql = cleanStatements.join("\n");

  console.log("⏳ Restoring schema-only SQL dump to staging...");
  try {
    await stagingClient.query(sql);
    console.log("✅ Staging database schema restored successfully!");
  } catch (err) {
    console.error("❌ Staging database schema restore failed:", err);
    await stagingClient.end();
    process.exit(1);
  }

  console.log("⏳ Seeding exact production ledger rows...");
  try {
    // Clear any default empty table states
    await stagingClient.query("TRUNCATE drizzle.__drizzle_migrations");
    for (const m of appliedMigrations) {
      await stagingClient.query(
        "INSERT INTO drizzle.__drizzle_migrations (id, hash, created_at) VALUES ($1, $2, $3)",
        [m.id, m.hash, m.created_at]
      );
    }
    console.log("✅ Production ledger rows seeded to staging!");
  } catch (err) {
    console.error("❌ Ledger seeding failed:", err);
    await stagingClient.end();
    process.exit(1);
  }

  await stagingClient.end();
  console.log("🎉 Staging restore cycle finished successfully!");
}

run().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
