import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not set in environment.");
    process.exit(1);
  }

  const { Pool } = pg;
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    console.log("⏳ Initializing migrations table in database...");
    
    // Ensure the schema and table exist
    await pool.query("CREATE SCHEMA IF NOT EXISTS drizzle;");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `);

    // Clear any partial/broken records
    await pool.query("TRUNCATE TABLE drizzle.__drizzle_migrations;");

    // Read the migrations journal
    const migrationsFolder = "./migrations";
    const journalPath = path.join(migrationsFolder, "meta/_journal.json");
    if (!fs.existsSync(journalPath)) {
      throw new Error(`Can't find meta/_journal.json file at ${journalPath}`);
    }

    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    console.log(`⏳ Found ${journal.entries.length} migration entries in journal.`);

    // We want to fake-apply migrations from index 0 up to index 19 (0000 to 0019)
    const fakedCount = 20; // 0000 to 0019
    for (let i = 0; i < fakedCount; i++) {
      const entry = journal.entries[i];
      if (!entry) continue;

      const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
      const query = fs.readFileSync(sqlPath, 'utf8');
      const hash = crypto.createHash("sha256").update(query).digest("hex");
      
      console.log(`   [Fake Apply] Index ${i}: ${entry.tag} (when: ${entry.when})`);
      await pool.query(
        `INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2);`,
        [hash, entry.when]
      );
    }

    console.log("✅ Successfully faked migrations 0000-0019 in the database.");
    console.log("⏳ Now running actual Drizzle migrations for index 20 (0020_chubby_the_enforcers) and onwards...");
    
    await migrate(db, { migrationsFolder });
    
    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Process failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
