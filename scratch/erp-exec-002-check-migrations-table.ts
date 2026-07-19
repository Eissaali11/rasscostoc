import "dotenv/config";
import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const r = await pool.query(`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 5`);
  console.log(r.rows);
  const count = await pool.query(`SELECT COUNT(*) c FROM drizzle.__drizzle_migrations`);
  console.log("total tracked:", count.rows[0].c);
  await pool.end();
}
main();
