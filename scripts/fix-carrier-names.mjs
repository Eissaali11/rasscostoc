/**
 * Production DB Direct Fix — Fix carrier names + verify
 * Uses pg client directly to avoid interactive terminal issues
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const PROJECT_PATH = '/home/stoc/htdocs/stoc.fun';

// Write a Node.js script to the server, run it there
const SERVER_SCRIPT = `
const { Pool } = require('pg');
const DB_URL = process.env.DATABASE_URL || process.env.OPS_DB_URL_STOKPRO_DB_NULIPUSER;
const pool = new Pool({ connectionString: DB_URL });

async function fix() {
  const client = await pool.connect();
  try {
    console.log('=== Starting carrier name fix ===');
    
    // Fix zainSim
    const r1 = await client.query(
      "UPDATE items SET carrier_name = 'Zain', updated_at = NOW() WHERE item_type_id = 'zainSim' AND (carrier_name IS NULL OR carrier_name != 'Zain') RETURNING serial_number, item_type_id, carrier_name"
    );
    console.log('Fixed zainSim carrier:', r1.rows);
    
    // Fix lebaraSim
    const r2 = await client.query(
      "UPDATE items SET carrier_name = 'Lebara', updated_at = NOW() WHERE item_type_id IN ('lebara','lebaraSim') AND (carrier_name IS NULL OR carrier_name != 'Lebara') RETURNING serial_number, item_type_id, carrier_name"
    );
    console.log('Fixed lebaraSim carrier:', r2.rows);
    
    // Fix mobilySim
    const r3 = await client.query(
      "UPDATE items SET carrier_name = 'Mobily', updated_at = NOW() WHERE item_type_id = 'mobilySim' AND (carrier_name IS NULL OR carrier_name != 'Mobily') RETURNING serial_number, item_type_id, carrier_name"
    );
    console.log('Fixed mobilySim carrier:', r3.rows);
    
    // Fix stcSim
    const r4 = await client.query(
      "UPDATE items SET carrier_name = 'STC', updated_at = NOW() WHERE item_type_id = 'stcSim' AND (carrier_name IS NULL OR carrier_name != 'STC') RETURNING serial_number, item_type_id, carrier_name"
    );
    console.log('Fixed stcSim carrier:', r4.rows);
    
    // Verify final state
    const verify = await client.query(
      "SELECT serial_number, status, item_type_id, carrier_name, current_owner_id FROM items WHERE current_owner_id IS NOT NULL ORDER BY created_at DESC"
    );
    console.log('\\n=== FINAL STATE ===');
    console.log(JSON.stringify(verify.rows, null, 2));
    
    console.log('\\n=== FIX COMPLETE ===');
  } finally {
    client.release();
    pool.end();
  }
}

fix().catch(e => { console.error('Error:', e.message); process.exit(1); });
`;

conn.on('ready', () => {
  console.log('=== SSH Carrier Fix Connected ===\n');
  conn.exec(`
    cd /home/stoc/htdocs/stoc.fun &&
    export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-) &&
    node -e ${JSON.stringify(SERVER_SCRIPT.replace(/\n/g, ' '))} 2>&1
  `, { pty: false }, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('close', (code) => {
      console.log(`\n=== Done (exit: ${code}) ===`);
      conn.end();
    });
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
  });
}).connect({
  host: process.env.OPS_SSH_HOST, port: 22, username: process.env.OPS_SSH_USER, password: process.env.OPS_SSH_PASSWORD, readyTimeout: 20000,
});
conn.on('error', (e) => { console.error('Connection error:', e.message); process.exit(1); });
