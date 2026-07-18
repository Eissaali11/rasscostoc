const { Client } = require('pg');
(async ()=>{
  const cs = process.env.OPS_DB_URL_NULIP_INVENTORY_NULIP_USER;
  const client = new Client({ connectionString: cs });
  await client.connect();
  const warehouseId = '1b75e6c2-9f51-4151-a687-a4ea1dd22015';
  const q = `SELECT DISTINCT u.id, u.full_name, u.username, u.region_id
FROM users u
LEFT JOIN supervisor_technicians st ON u.id = st.technician_id
LEFT JOIN supervisor_warehouses sw ON st.supervisor_id = sw.supervisor_id
WHERE u.role='technician' AND (u.region_id = (SELECT region_id FROM warehouses WHERE id = '${warehouseId}') OR sw.warehouse_id = '${warehouseId}')
ORDER BY u.full_name;`;
  const res = await client.query(q);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
})().catch(e=>{ console.error(e); process.exit(1); });
