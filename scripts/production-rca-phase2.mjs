/**
 * Production RCA Script — Phase 2 Deep Investigation
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const PROJECT_PATH = '/home/stoc/htdocs/stoc.fun';
const TECHNICIAN_ID = '3a3a93f7-cf9a-4f90-8124-424a117e1957';

const COMMANDS_RAW = `
cd ${PROJECT_PATH}
export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)
echo "=== [1] ALL ITEMS FOR TECHNICIAN (any status) ==="
psql "$DATABASE_URL" -t -A -c "SELECT serial_number, status, item_type_id, carrier_name, created_at FROM items WHERE current_owner_id = '${TECHNICIAN_ID}' ORDER BY created_at DESC;"
echo ""
echo "=== [2] ALL ITEMS (last 30, any owner) ==="
psql "$DATABASE_URL" -t -A -c "SELECT serial_number, status, item_type_id, current_owner_id, carrier_name, created_at FROM items ORDER BY created_at DESC LIMIT 30;"
echo ""
echo "=== [3] ITEM TYPES — serial-requiring items with category ==="
psql "$DATABASE_URL" -t -A -c "SELECT id, name_ar, category, requires_serial, serial_prefix FROM item_types WHERE requires_serial = true ORDER BY category;"
echo ""
echo "=== [4] WAREHOUSE TRANSFERS for technician ==="
psql "$DATABASE_URL" -t -A -c "SELECT id, technician_id, item_type, status, quantity, packaging_type, created_at FROM warehouse_transfers WHERE technician_id = '${TECHNICIAN_ID}' ORDER BY created_at DESC LIMIT 10;"
echo ""
echo "=== [5] ITEM HISTORY LOGS for technician's items ==="
psql "$DATABASE_URL" -t -A -c "SELECT ihl.item_id, ihl.from_status, ihl.to_status, ihl.changed_at, i.serial_number FROM item_history_logs ihl JOIN items i ON ihl.item_id = i.id WHERE i.current_owner_id = '${TECHNICIAN_ID}' ORDER BY ihl.changed_at DESC;"
echo ""
echo "=== [6] CUSTODY MOVEMENTS for technician ==="
psql "$DATABASE_URL" -t -A -c "SELECT cm.reason, cm.performed_at, i.serial_number FROM custody_movements cm JOIN items i ON cm.item_id = i.id WHERE cm.to_owner_id = '${TECHNICIAN_ID}' ORDER BY cm.performed_at DESC;"
echo ""
echo "=== [7] CHECK CARRIER NAME MAPPING BUG ==="
psql "$DATABASE_URL" -t -A -c "SELECT serial_number, item_type_id, carrier_name FROM items WHERE current_owner_id = '${TECHNICIAN_ID}';"
echo ""
echo "=== [8] PM2 LOGS (last 30 lines) ==="
pm2 logs nulip-inventory --lines 30 --nostream 2>&1 | tail -50
echo "=== RCA PHASE 2 COMPLETE ==="
`;

conn.on('ready', () => {
  console.log('=== SSH Phase 2 RCA Connected ===\n');
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
  host: process.env.OPS_SSH_HOST, port: 22, username: process.env.OPS_SSH_USER, password: process.env.OPS_SSH_PASSWORD, readyTimeout: 20000,
});
conn.on('error', (e) => { console.error('Connection error:', e.message); process.exit(1); });
