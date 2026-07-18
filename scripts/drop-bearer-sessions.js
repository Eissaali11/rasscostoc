const { Client } = require('pg');
(async () => {
  const cs = process.env.OPS_DB_URL_NULIP_INVENTORY;
  const client = new Client({ connectionString: cs });
  try {
    await client.connect();
    console.log('Dropping bearer_sessions table if it exists...');
    await client.query('DROP TABLE IF EXISTS bearer_sessions CASCADE');
    console.log('Dropped successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
})();
