import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const PROJECT_PATH = '/home/stoc/htdocs/stoc.fun';

const COMMANDS = `
cd ${PROJECT_PATH}
export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)
echo "=== ALL ITEMS ==="
psql "$DATABASE_URL" -c "SELECT id, serial_number, item_type_id, status, current_owner_id, carrier_name FROM items LIMIT 50;"
`;

conn.on('ready', () => {
  conn.exec(COMMANDS, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('close', () => conn.end());
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
  });
}).connect({
  host: process.env.OPS_SSH_HOST, port: 22, username: process.env.OPS_SSH_USER, password: process.env.OPS_SSH_PASSWORD, readyTimeout: 20000,
});
