import "dotenv/config";
import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const r1 = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE conrelid = 'number_sequences'::regclass
  `);
  console.log("number_sequences constraints:", r1.rows);
  const r2 = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE conrelid = 'technician_sales_metrics_daily'::regclass
  `);
  console.log("technician_sales_metrics_daily constraints:", r2.rows);
  const dbInfo = await pool.query("SELECT current_database(), current_user, inet_server_port()");
  console.log(dbInfo.rows);
  await pool.end();
}
main();
