import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log("Applying custody_movements migration directly...");
  const sqlPath = path.join(process.cwd(), 'migrations', '0015_jittery_true_believers.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  // Split by drizzle statement separator
  const statements = sqlContent.split('--> statement-breakpoint');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const stmt of statements) {
      const cleanStmt = stmt.trim();
      if (cleanStmt) {
        console.log("Running statement:\n", cleanStmt);
        await client.query(cleanStmt);
      }
    }
    await client.query('COMMIT');
    console.log("✅ Custody movements table and constraints created successfully!");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Failed to apply statement:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
