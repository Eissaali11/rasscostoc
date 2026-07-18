import pkg from 'pg';
const { Client } = pkg;

(async () => {
  const cs = process.env.OPS_DB_URL_NULIP_INVENTORY;
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    
    console.log('--- USERS ---');
    const usersRes = await client.query('SELECT id, username, role, full_name FROM public.users');
    console.log(usersRes.rows);

    console.log('\n--- WAREHOUSE TRANSFERS ---');
    const transfersRes = await client.query('SELECT id, status, technician_id, item_type, quantity, created_at FROM public.warehouse_transfers ORDER BY created_at DESC LIMIT 10');
    console.log(transfersRes.rows);

    console.log('\n--- ITEMS ---');
    const itemsRes = await client.query('SELECT id, status, current_owner_id, item_type_id, serial_number, created_at FROM public.items ORDER BY created_at DESC LIMIT 10');
    console.log(itemsRes.rows);

    console.log('\n--- CUSTODY MOVEMENTS ---');
    const movementsRes = await client.query('SELECT id, item_id, from_owner_id, to_owner_id, reason, reference_type, reference_id, performed_by_id FROM public.custody_movements ORDER BY performed_at DESC LIMIT 10');
    console.log(movementsRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
})();
