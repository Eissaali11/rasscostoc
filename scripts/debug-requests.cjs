const { Client } = require('pg');
(async () => {
  const cs = 'postgresql://postgres:postgres@localhost:5432/nulip_inventory';
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    
    console.log('--- COURIER REQUESTS ---');
    const requestsRes = await client.query(`
      SELECT r.id, r.customer_name, r.retailer_name, e.installation_status
      FROM courier_requests r
      LEFT JOIN courier_executions e ON e.request_id = r.id
      ORDER BY r.id DESC
      LIMIT 10
    `);
    console.table(requestsRes.rows);

    console.log('--- COURIER REQUEST ITEMS FOR RECENT REQUESTS ---');
    const itemsRes = await client.query(`
      SELECT id, request_id, item_type, serial_number, sim_serial, quantity, status
      FROM courier_request_items
      ORDER BY request_id DESC, id DESC
      LIMIT 20
    `);
    console.table(itemsRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
})();
