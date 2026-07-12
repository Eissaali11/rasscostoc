import pkg from 'pg';
const { Client } = pkg;

(async () => {
  const cs = 'postgresql://postgres:postgres@localhost:5432/nulip_inventory';
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    
    console.log('--- LOCAL TECHNICIAN MOVING INVENTORY ENTRIES ---');
    const res = await client.query('SELECT * FROM public.technician_moving_inventory_entries');
    console.log(res.rows);

    console.log('\n--- LOCAL ITEM TYPES ---');
    const itemTypesRes = await client.query('SELECT id, name_ar, category, requires_serial FROM public.item_types');
    console.log(itemTypesRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
})();
