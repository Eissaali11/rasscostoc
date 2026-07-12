import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const PROJECT_PATH = '/home/stoc/htdocs/stoc.fun';
const TECHNICIAN_ID = '3a3a93f7-cf9a-4f90-8124-424a117e1957';

const COMMANDS = `
cd ${PROJECT_PATH}
export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)
echo "=== TECHNICIAN MOVING INVENTORY ENTRIES ==="
psql "$DATABASE_URL" -c "
  SELECT * FROM technician_moving_inventory_entries WHERE technician_id = '${TECHNICIAN_ID}';
"
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
