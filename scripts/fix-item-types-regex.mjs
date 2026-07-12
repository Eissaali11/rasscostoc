import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const PROJECT_PATH = '/home/stoc/htdocs/stoc.fun';

const COMMANDS = `
cd ${PROJECT_PATH}
export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)
echo "=== UPDATING ITEM TYPES REGEX ==="
psql "$DATABASE_URL" -c "
UPDATE item_types SET serial_regex = '^(NCC|NCD)[0-9]{9}$', serial_length = 9 WHERE id = 'n950';
UPDATE item_types SET serial_regex = '^SAW[A-Z0-9]{11}$', serial_length = 11 WHERE id = 'i9100';
UPDATE item_types SET serial_regex = '^SAS[A-Z0-9]{11}$', serial_length = 11 WHERE id = 'i9000s';
"
echo "=== VERIFYING UPDATE ==="
psql "$DATABASE_URL" -c "SELECT id, serial_prefix, serial_length, serial_regex FROM item_types WHERE id IN ('n950', 'i9100', 'i9000s');"
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
