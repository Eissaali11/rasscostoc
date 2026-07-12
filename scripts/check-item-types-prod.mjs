import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const PROJECT_PATH = '/home/stoc/htdocs/stoc.fun';

const COMMANDS = `
cd ${PROJECT_PATH}
export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)
echo "=== N950 ITEMS ==="
psql "$DATABASE_URL" -c "SELECT id, serial_number, barcode, item_type_id, status FROM items WHERE item_type_id = 'n950' LIMIT 50;"
echo "=== i9000s ITEMS ==="
psql "$DATABASE_URL" -c "SELECT id, serial_number, barcode, item_type_id, status FROM items WHERE item_type_id = 'i9000s' LIMIT 50;"
echo "=== i9100 ITEMS ==="
psql "$DATABASE_URL" -c "SELECT id, serial_number, barcode, item_type_id, status FROM items WHERE item_type_id = 'i9100' LIMIT 50;"

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
