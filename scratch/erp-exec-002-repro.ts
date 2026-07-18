import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function reproNumberSequences() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const year = new Date().getFullYear();
    await client.query(
      `INSERT INTO number_sequences (scope, year, prefix, next_number)
       VALUES ($1, $2, $3, 2)
       ON CONFLICT (scope, year)
       DO UPDATE SET next_number = number_sequences.next_number + 1, updated_at = NOW()
       RETURNING prefix, next_number - 1 AS current_number`,
      ["ERP-EXEC-002-REPRO", year, "SI-"]
    );
    await client.query("ROLLBACK");
    console.log("number_sequences: NO ERROR (unexpected)");
  } catch (err) {
    await client.query("ROLLBACK");
    console.log("=== number_sequences real error ===");
    console.log((err as Error).message);
    console.log("code:", (err as { code?: string }).code);
  } finally {
    client.release();
  }
}

async function reproTechnicianMetrics() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Use a real technician id if one exists, else a random uuid (FK will fail first if none - that's fine, still real behavior)
    const userRes = await client.query("SELECT id FROM users LIMIT 1");
    const techId = userRes.rows[0]?.id;
    if (!techId) {
      console.log("technician_sales_metrics_daily: no users row to test with, skipping FK-dependent repro");
      await client.query("ROLLBACK");
      return;
    }
    await client.query(
      `INSERT INTO technician_sales_metrics_daily (
         sales_date, technician_id, item_type_id, region_id,
         sold_qty, sold_amount, remaining_qty_end_of_day, invoices_count,
         returns_qty, avg_selling_price, last_sale_at
       )
       VALUES (CURRENT_DATE, $1, NULL, NULL, 1, 100, 0, 1, 0, 100, NOW())
       ON CONFLICT (sales_date, technician_id, item_type_id, region_id)
       DO UPDATE SET
         sold_qty = technician_sales_metrics_daily.sold_qty + EXCLUDED.sold_qty,
         sold_amount = technician_sales_metrics_daily.sold_amount + EXCLUDED.sold_amount,
         remaining_qty_end_of_day = EXCLUDED.remaining_qty_end_of_day,
         invoices_count = technician_sales_metrics_daily.invoices_count + EXCLUDED.invoices_count,
         avg_selling_price = 100,
         last_sale_at = NOW()`,
      [techId]
    );
    await client.query("ROLLBACK");
    console.log("technician_sales_metrics_daily: NO ERROR (unexpected)");
  } catch (err) {
    await client.query("ROLLBACK");
    console.log("=== technician_sales_metrics_daily real error ===");
    console.log((err as Error).message);
    console.log("code:", (err as { code?: string }).code);
  } finally {
    client.release();
  }
}

async function main() {
  await reproNumberSequences();
  await reproTechnicianMetrics();
  await pool.end();
}

main();
