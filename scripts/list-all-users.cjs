const { Client } = require('pg');
(async ()=>{
  const cs = 'postgresql://nulip_user:Nulip!2026$R8mQw@localhost:5432/nulip_inventory';
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    const res = await client.query("SELECT id, username, full_name, role, is_active FROM users ORDER BY role, username");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Connection failed with nulip_user, trying postgres...", err.message);
    const client2 = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/nulip_inventory' });
    await client2.connect();
    const res2 = await client2.query("SELECT id, username, full_name, role, is_active FROM users ORDER BY role, username");
    console.log(JSON.stringify(res2.rows, null, 2));
    await client2.end();
  } finally {
    await client.end();
  }
})().catch(e=>{ console.error(e); process.exit(1); });
