const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('pg');

const journal = JSON.parse(fs.readFileSync('migrations/meta/_journal.json', 'utf8'));
const dbUrl = 'postgresql://nulip_user:Nulip2026R8mQwX9@localhost:5432/nulip_inventory';

async function run() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  console.log('Connected to database');

  // Create schema and table if they do not exist
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle;');
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  for (const entry of journal.entries) {
    const filename = `migrations/${entry.tag}.sql`;
    const sqlContent = fs.readFileSync(filename, 'utf8');
    const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');
    const when = entry.when;

    // Check if it already exists
    const res = await client.query('SELECT id FROM drizzle.__drizzle_migrations WHERE hash = $1', [hash]);
    if (res.rows.length === 0) {
      await client.query(
        'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [hash, when]
      );
      console.log(`Inserted migration: ${entry.tag} (hash: ${hash})`);
    } else {
      console.log(`Migration already recorded: ${entry.tag}`);
    }
  }

  await client.end();
  console.log('Done syncing migrations!');
}

run().catch(console.error);
