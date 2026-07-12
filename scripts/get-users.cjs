/**
 * Queries users table to get list of users and their password hashes or details
 */
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const columns = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'technicians_inventory'
  `);
  console.log('=== TECHNICIANS INVENTORY COLUMNS ===');
  console.log(JSON.stringify(columns.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
