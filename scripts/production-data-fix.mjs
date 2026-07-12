/**
 * Production Data Fix Script
 * 
 * Fixes:
 * 1. Items with IN_TRANSIT_CUSTODY that belong to a technician → change to RECEIVED_BY_TECHNICIAN
 * 2. Items with wrong carrier_name (STC assigned to zainSim/lebaraSim) → fix to correct carrier
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const PROJECT_PATH = '/home/stoc/htdocs/stoc.fun';

const COMMANDS_RAW = `
cd ${PROJECT_PATH}
export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)

echo "=== [BEFORE] Affected rows ==="
psql "$DATABASE_URL" -c "SELECT serial_number, status, item_type_id, carrier_name FROM items WHERE current_owner_id IS NOT NULL AND status = 'IN_TRANSIT_CUSTODY';"

echo "=== [FIX 1] Change IN_TRANSIT_CUSTODY → RECEIVED_BY_TECHNICIAN for technician-owned items ==="
psql "$DATABASE_URL" -c "UPDATE items SET status = 'RECEIVED_BY_TECHNICIAN', updated_at = NOW() WHERE current_owner_id IS NOT NULL AND status = 'IN_TRANSIT_CUSTODY' RETURNING serial_number, status, item_type_id, current_owner_id;"

echo "=== [FIX 2] Fix incorrect carrier_name for zainSim (STC → Zain) ==="
psql "$DATABASE_URL" -c "UPDATE items SET carrier_name = 'Zain', updated_at = NOW() WHERE item_type_id = 'zainSim' AND carrier_name != 'Zain' RETURNING serial_number, item_type_id, carrier_name;"

echo "=== [FIX 3] Fix incorrect carrier_name for lebaraSim (STC → Lebara) ==="
psql "$DATABASE_URL" -c "UPDATE items SET carrier_name = 'Lebara', updated_at = NOW() WHERE item_type_id IN ('lebara', 'lebaraSim') AND carrier_name != 'Lebara' RETURNING serial_number, item_type_id, carrier_name;"

echo "=== [FIX 4] Fix incorrect carrier_name for mobilySim (STC → Mobily) ==="
psql "$DATABASE_URL" -c "UPDATE items SET carrier_name = 'Mobily', updated_at = NOW() WHERE item_type_id = 'mobilySim' AND carrier_name != 'Mobily' RETURNING serial_number, item_type_id, carrier_name;"

echo "=== [AFTER] Verify technician items ==="
psql "$DATABASE_URL" -c "SELECT serial_number, status, item_type_id, carrier_name, current_owner_id FROM items WHERE current_owner_id IS NOT NULL ORDER BY created_at DESC;"

echo "=== DATA FIX COMPLETE ==="
`;

conn.on('ready', () => {
  console.log('=== SSH Data Fix Connected ===\n');
  conn.shell((err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('close', () => { conn.end(); });
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    
    const lines = COMMANDS_RAW.trim().split('\n');
    for (const line of lines) {
      stream.write(line.trim() + '\n');
    }
    stream.write('exit\n');
  });
}).connect({
  host: '72.62.149.127', port: 22, username: 'root', password: 'Eisa11223344@#', readyTimeout: 20000,
});
conn.on('error', (e) => { console.error('Connection error:', e.message); process.exit(1); });
