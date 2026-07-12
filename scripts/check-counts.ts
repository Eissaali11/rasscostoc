import pkg from 'pg';
const { Client } = pkg;

(async () => {
  const cs = 'postgresql://postgres:postgres@localhost:5432/nulip_inventory';
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    console.log('--- Selected Table Counts ---');
    const tables = [
      'items',
      'item_types',
      'warehouse_transfers',
      'custody_movements',
      'technician_moving_inventory_entries',
      'received_devices',
      'technicians_inventory'
    ];
    for (const table of tables) {
      const countRes = await client.query(`SELECT COUNT(*) FROM public."${table}"`);
      console.log(`  Table: ${table.padEnd(40)} | Rows: ${countRes.rows[0].count}`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
})();
