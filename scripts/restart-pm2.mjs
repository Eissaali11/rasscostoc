import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const PROJECT_PATH = '/home/stoc/htdocs/stoc.fun';

const COMMANDS = [
  'PGPASSWORD=Simple123 psql -h 127.0.0.1 -U nulipuser -d stokpro_db -A -F "," -c "SELECT id, name_ar, category, requires_serial, is_active, is_visible FROM item_types WHERE is_active = true AND is_visible = true;"',
].join(' && ');

conn.on('ready', () => {
  console.log('=== SSH Connected ===');
  conn.exec(COMMANDS, { pty: true }, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('close', (code) => { console.log(`\n=== Done (exit: ${code}) ===`); conn.end(); });
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
  });
}).connect({
  host: process.env.OPS_SSH_HOST, port: 22, username: process.env.OPS_SSH_USER, password: process.env.OPS_SSH_PASSWORD,
  readyTimeout: 60000,
  keepaliveInterval: 20000,
  keepaliveCountMax: 50,
});
conn.on('error', (e) => { console.error('Connection error:', e.message); });
