import 'dotenv/config';
import pg from 'pg';

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  const { Client } = pg;
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(
      `INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2);`,
      ['35079cf12824eb55bae32833bbc14c2735b261c492ae2a34a5568293b29a8aa6', 1784067464092]
    );
    console.log("✅ Successfully registered migration 0020 in drizzle.__drizzle_migrations!");
  } catch (error) {
    console.error("❌ Failed to register migration 0020:", error);
  } finally {
    await client.end();
  }
}

run();
