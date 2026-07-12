import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const PROJECT_PATH = '/home/stoc/htdocs/stoc.fun';

const SQL_UPDATES = `
-- Fix incorrectly mapped SIM items from 1010 (Neoleap ATM) to mobilySim
UPDATE items SET item_type_id = 'mobilySim' WHERE item_type_id = '1010' AND serial_number = '8996606099020522836';

-- Update technician moving inventory entries for the technician who has the item
UPDATE technician_moving_inventory_entries SET item_type_id = 'mobilySim' WHERE item_type_id = '1010' AND technician_id = '3a3a93f7-cf9a-4f90-8124-424a117e1957';
`;

const COMMANDS = `
cd ${PROJECT_PATH}
export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)
echo "=== PRE-FIX VERIFICATION ==="
psql "$DATABASE_URL" -c "SELECT id, serial_number, item_type_id, status FROM items WHERE serial_number = '8996606099020522836';"
psql "$DATABASE_URL" -c "SELECT * FROM technician_moving_inventory_entries WHERE item_type_id = '1010' OR item_type_id = 'mobilySim';"

echo "=== FIXING DATABASE ==="
psql "$DATABASE_URL" -c "${SQL_UPDATES.replace(/"/g, '\\"')}"

echo "=== POST-FIX VERIFICATION ==="
psql "$DATABASE_URL" -c "SELECT id, serial_number, item_type_id, status FROM items WHERE serial_number = '8996606099020522836';"
psql "$DATABASE_URL" -c "SELECT * FROM technician_moving_inventory_entries WHERE item_type_id = '1010' OR item_type_id = 'mobilySim';"
`;

conn.on('ready', () => {
  conn.exec(COMMANDS, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('close', () => conn.end());
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
  });
}).connect({
  host: '72.62.149.127', port: 22, username: 'root', password: 'Eisa11223344@#', readyTimeout: 20000,
});
