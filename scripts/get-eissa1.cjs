/**
 * Gets the hash of user eissa1
 */
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const res = await pool.query("SELECT id, username, role, password FROM users WHERE username = 'eissa1' LIMIT 1");
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

main().catch(console.error);
