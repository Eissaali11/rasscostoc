/**
 * Deploy script with longer timeout
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const PROJECT_PATH = '/home/stoc/htdocs/stoc.fun';

const COMMANDS = [
  `cd ${PROJECT_PATH}`,
  'git reset --hard',
  'git clean -f -d',
  'git pull origin main',
  'npm install',
  'npm run build',
  'pm2 restart nulip-inventory',
  'pm2 status',
  'echo "=== DEPLOY COMPLETE ==="',
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
