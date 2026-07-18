const { Client } = require('pg');
(async ()=>{
  const cs = process.env.OPS_DB_URL_NULIP_INVENTORY_NULIP_USER;
  const client = new Client({ connectionString: cs });
  await client.connect();
  const res = await client.query("SELECT id, username, full_name, role, region_id FROM users WHERE role = 'supervisor' ORDER BY full_name");
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
})().catch(e=>{ console.error(e); process.exit(1); });
