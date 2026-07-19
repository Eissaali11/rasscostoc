import 'dotenv/config';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const PROJECT_PATH = '/home/stoc/htdocs/stoc.fun';
const TECHNICIAN_ID = '3a3a93f7-cf9a-4f90-8124-424a117e1957';

const COMMANDS = `
cd ${PROJECT_PATH}
export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)
echo "=== TECHNICIAN SERIALIZED ITEMS ==="
psql "$DATABASE_URL" -c "
  SELECT 
    i.id,
    i.serial_number,
    i.status,
    i.item_type_id,
    it.name_ar,
    it.category
  FROM items i
  LEFT JOIN item_types it ON i.item_type_id = it.id
  WHERE i.current_owner_id = '${TECHNICIAN_ID}'
    AND i.status IN ('RECEIVED_BY_TECHNICIAN', 'IN_TRANSIT_CUSTODY');
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
  host: (process.env.SSH_HOST || ''), port: 22, username: process.env.SSH_USER || 'root', password: process.env.SSH_PASSWORD, readyTimeout: 20000,
});
