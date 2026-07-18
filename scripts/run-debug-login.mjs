import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const scriptContent = fs.readFileSync('./scripts/debug-login.cjs', 'utf8');
const REMOTE_PATH = '/home/stoc/htdocs/stoc.fun/scripts/debug-login.cjs';

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const w = sftp.createWriteStream(REMOTE_PATH);
    w.on('close', () => {
      conn.exec(
        `cd /home/stoc/htdocs/stoc.fun && node ${REMOTE_PATH} 2>&1`,
        { pty: false },
        (err, stream) => {
          if (err) { console.end(); }
          stream.on('close', () => { conn.end(); });
          stream.on('data', (d) => process.stdout.write(d.toString()));
        }
      );
    });
    w.on('error', e => { console.error(e); conn.end(); });
    w.end(scriptContent);
  });
}).connect({
  host: process.env.OPS_SSH_HOST, port: 22, username: process.env.OPS_SSH_USER, password: process.env.OPS_SSH_PASSWORD,
  readyTimeout: 20000, keepaliveInterval: 15000,
});
conn.on('error', e => { console.error('SSH error:', e.message); process.exit(1); });
