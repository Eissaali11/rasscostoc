const { Client } = require('pg');
const fetch = global.fetch;
(async ()=>{
  const cs = process.env.OPS_DB_URL_NULIP_INVENTORY_NULIP_USER;
  const client = new Client({ connectionString: cs });
  await client.connect();

  // Choose a supervisor from DB (HUSAM id found earlier)
  const supervisorId = 'bb0ddcac-1a34-48d5-8c61-b620e7efbe15';
  const usernameRes = await client.query('SELECT username, region_id FROM users WHERE id = $1', [supervisorId]);
  if (!usernameRes.rows.length) {
    console.error('Supervisor not found');
    await client.end();
    process.exit(1);
  }
  const username = usernameRes.rows[0].username;
  const regionId = usernameRes.rows[0].region_id;

  const token = 'dev-token-warehouse-debug';
  const expiry = Date.now() + (24*60*60*1000);

  await client.query(`
    CREATE TABLE IF NOT EXISTS bearer_sessions (
      token VARCHAR(255) PRIMARY KEY,
      "userId" VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      username VARCHAR(255) NOT NULL,
      "regionId" VARCHAR(255),
      expiry BIGINT NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(
    `INSERT INTO bearer_sessions (token, "userId", role, username, "regionId", expiry)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (token) DO UPDATE SET "userId" = EXCLUDED."userId", role = EXCLUDED.role, username = EXCLUDED.username, "regionId" = EXCLUDED."regionId", expiry = EXCLUDED.expiry;`,
    [token, supervisorId, 'supervisor', username, regionId, expiry]
  );

  await client.end();

  // Fetch warehouse using token
  const base = 'http://localhost:3001';
  const warehouseId = '1b75e6c2-9f51-4151-a687-a4ea1dd22015';
  const res = await fetch(`${base}/api/warehouses/${warehouseId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const json = await res.json();
  console.log('status', res.status);
  console.log(JSON.stringify(json, null, 2));
})();
