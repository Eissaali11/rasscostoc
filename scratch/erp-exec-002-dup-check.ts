import "dotenv/config";
import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const ns = await pool.query(`
    SELECT scope, year, COUNT(*) c FROM number_sequences
    GROUP BY scope, year HAVING COUNT(*) > 1
  `);
  console.log("number_sequences duplicate (scope,year) groups:", ns.rows.length);
  console.log(ns.rows);

  const tsm = await pool.query(`
    SELECT sales_date, technician_id, item_type_id, region_id, COUNT(*) c
    FROM technician_sales_metrics_daily
    GROUP BY sales_date, technician_id, item_type_id, region_id HAVING COUNT(*) > 1
  `);
  console.log("technician_sales_metrics_daily duplicate groups:", tsm.rows.length);
  console.log(tsm.rows);

  const nsCount = await pool.query("SELECT COUNT(*) c FROM number_sequences");
  const tsmCount = await pool.query("SELECT COUNT(*) c FROM technician_sales_metrics_daily");
  console.log("number_sequences total rows:", nsCount.rows[0].c);
  console.log("technician_sales_metrics_daily total rows:", tsmCount.rows[0].c);

  await pool.end();
}
main();
