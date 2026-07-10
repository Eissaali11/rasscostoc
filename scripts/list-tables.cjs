const { Client } = require('pg');
(async () => {
  const cs = 'postgresql://postgres:postgres@localhost:5432/nulip_inventory';
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
})();
