import "dotenv/config";
import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const r = await pool.query(`
    SELECT conname, conrelid::regclass AS table_name, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conname IN ('number_sequences_scope_year_unique', 'technician_sales_metrics_daily_date_tech_item_region_unique')
  `);
  console.log(r.rows);
  await pool.end();
}
main();
