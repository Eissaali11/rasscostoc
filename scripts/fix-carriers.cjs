/**
 * Carrier name fix — uploaded directly to server
 */
const { Pool } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://nulipuser:Simple123@localhost:5432/stokpro_db';
const pool = new Pool({ connectionString: DB_URL });

async function fix() {
  const client = await pool.connect();
  try {
    console.log('=== Starting carrier name fix ===');
    
    const r1 = await client.query(
      "UPDATE items SET carrier_name = 'Zain', updated_at = NOW() WHERE item_type_id = 'zainSim' AND (carrier_name IS NULL OR carrier_name != 'Zain') RETURNING serial_number, item_type_id, carrier_name"
    );
    console.log('Fixed zainSim:', JSON.stringify(r1.rows));
    
    const r2 = await client.query(
      "UPDATE items SET carrier_name = 'Lebara', updated_at = NOW() WHERE item_type_id IN ('lebara','lebaraSim') AND (carrier_name IS NULL OR carrier_name != 'Lebara') RETURNING serial_number, item_type_id, carrier_name"
    );
    console.log('Fixed lebaraSim:', JSON.stringify(r2.rows));
    
    const r3 = await client.query(
      "UPDATE items SET carrier_name = 'Mobily', updated_at = NOW() WHERE item_type_id = 'mobilySim' AND (carrier_name IS NULL OR carrier_name != 'Mobily') RETURNING serial_number, item_type_id, carrier_name"
    );
    console.log('Fixed mobilySim:', JSON.stringify(r3.rows));
    
    const r4 = await client.query(
      "UPDATE items SET carrier_name = 'STC', updated_at = NOW() WHERE item_type_id = 'stcSim' AND (carrier_name IS NULL OR carrier_name != 'STC') RETURNING serial_number, item_type_id, carrier_name"
    );
    console.log('Fixed stcSim:', JSON.stringify(r4.rows));
    
    const verify = await client.query(
      "SELECT serial_number, status, item_type_id, carrier_name, current_owner_id FROM items WHERE current_owner_id IS NOT NULL ORDER BY created_at DESC"
    );
    console.log('FINAL STATE:', JSON.stringify(verify.rows, null, 2));
    console.log('=== COMPLETE ===');
  } finally {
    client.release();
    pool.end();
  }
}

fix().catch(e => { console.error('Error:', e.message); process.exit(1); });
