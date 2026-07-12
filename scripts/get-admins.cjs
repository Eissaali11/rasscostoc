/**
 * Gets all admin and supervisor usernames
 */
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const res = await pool.query("SELECT id, username, role FROM users WHERE role IN ('admin', 'supervisor')");
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

main().catch(console.error);
