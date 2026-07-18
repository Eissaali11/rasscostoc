import pkg from 'pg';
const { Client } = pkg;

(async () => {
  const cs = process.env.OPS_DB_URL_NULIP_INVENTORY;
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    
    console.log('--- ITEM HISTORY FOR c06db9a5-68f5-4b5e-a29f-2924660ee501 ---');
    const historyRes = await client.query('SELECT * FROM public.item_history_logs WHERE item_id = $1 ORDER BY changed_at ASC', ['c06db9a5-68f5-4b5e-a29f-2924660ee501']);
    console.log(historyRes.rows);

    console.log('\n--- CUSTODY MOVEMENTS FOR c06db9a5-68f5-4b5e-a29f-2924660ee501 ---');
    const custodyRes = await client.query('SELECT * FROM public.custody_movements WHERE item_id = $1 ORDER BY performed_at ASC', ['c06db9a5-68f5-4b5e-a29f-2924660ee501']);
    console.log(custodyRes.rows);

    console.log('\n--- TRANSACTIONS FOR c06db9a5-68f5-4b5e-a29f-2924660ee501 ---');
    const transRes = await client.query('SELECT * FROM public.inventory_transactions WHERE item_id = $1 ORDER BY performed_at ASC', ['c06db9a5-68f5-4b5e-a29f-2924660ee501']);
    console.log(transRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
})();
