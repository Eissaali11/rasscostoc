/**
 * Production RCA Script — Inventory Synchronization Investigation
 * Runs diagnostic queries on the production database via SSH.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const PROJECT_PATH = '/home/stoc/htdocs/stoc.fun';
const TECHNICIAN_ID = '3a3a93f7-cf9a-4f90-8124-424a117e1957';

// Multi-step investigation SQL commands
const SQL_CHECKS = [
  // 1. Check recent items in DB
  `psql $DATABASE_URL -c "SELECT id, serial_number, status, item_type_id, current_owner_id, carrier_name, created_at FROM items ORDER BY created_at DESC LIMIT 20;" 2>&1`,
  
  // 2. Check items belonging to technician
  `psql $DATABASE_URL -c "SELECT id, serial_number, status, item_type_id, current_owner_id, carrier_name, created_at FROM items WHERE current_owner_id = '${TECHNICIAN_ID}' ORDER BY created_at DESC;" 2>&1`,
  
  // 3. Check ALL items for this technician regardless of status
  `psql $DATABASE_URL -c "SELECT i.serial_number, i.status, i.item_type_id, i.current_owner_id, it.category, it.requires_serial FROM items i LEFT JOIN item_types it ON i.item_type_id = it.id WHERE i.current_owner_id = '${TECHNICIAN_ID}';" 2>&1`,
  
  // 4. Check item_types to see category values
  `psql $DATABASE_URL -c "SELECT id, name_ar, name_en, category, requires_serial FROM item_types ORDER BY category;" 2>&1`,
  
  // 5. Check warehouse_transfers for this technician
  `psql $DATABASE_URL -c "SELECT id, technician_id, item_type, status, quantity, packaging_type, created_at, responded_at FROM warehouse_transfers WHERE technician_id = '${TECHNICIAN_ID}' ORDER BY created_at DESC LIMIT 10;" 2>&1`,

  // 6. Check recent inventory_transactions
  `psql $DATABASE_URL -c "SELECT it.*, i.serial_number FROM inventory_transactions it JOIN items i ON it.item_id = i.id ORDER BY it.created_at DESC LIMIT 20;" 2>&1`,

  // 7. Check technician_moving_inventory_entries
  `psql $DATABASE_URL -c "SELECT * FROM technician_moving_inventory_entries WHERE technician_id = '${TECHNICIAN_ID}';" 2>&1`,
  
  // 8. Check if isVisible/isActive columns affect queries
  `psql $DATABASE_URL -c "SELECT id, name_ar, is_active, is_visible, requires_serial, category FROM item_types WHERE requires_serial = true;" 2>&1`,
  
  // 9. Check last PM2 logs
  `pm2 logs nulip-inventory --lines 50 --nostream 2>&1`,
];

const COMMANDS = [
  `cd ${PROJECT_PATH}`,
  `export DATABASE_URL=$(grep DATABASE_URL .env | cut -d= -f2-)`,
  ...SQL_CHECKS
].join(' && ');

conn.on('ready', () => {
  console.log('=== SSH Connected — Starting RCA ===\n');
  conn.exec(COMMANDS, { pty: true }, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('close', (code) => {
      console.log(`\n=== RCA Complete (exit: ${code}) ===`);
      conn.end();
    });
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
  });
}).connect({
  host: '72.62.149.127', port: 22, username: 'root', password: 'Eisa11223344@#', readyTimeout: 20000,
});
conn.on('error', (e) => { console.error('Connection error:', e.message); process.exit(1); });
