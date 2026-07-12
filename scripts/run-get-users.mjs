import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const scriptContent = fs.readFileSync('./scripts/get-users.cjs', 'utf8');
const REMOTE_PATH = '/home/stoc/htdocs/stoc.fun/scripts/get-users.cjs';

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const w = sftp.createWriteStream(REMOTE_PATH);
    w.on('close', () => {
      conn.exec(
        `cd /home/stoc/htdocs/stoc.fun && export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-) && node ${REMOTE_PATH} 2>&1`,
        { pty: false },
        (err, stream) => {
          if (err) { console.error(err); conn.end(); return; }
          stream.on('close', (code) => { conn.end(); });
          stream.on('data', (d) => process.stdout.write(d.toString()));
          stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
        }
      );
    });
    w.on('error', e => { console.error(e); conn.end(); });
    w.end(scriptContent);
  });
}).connect({
  host: '72.62.149.127', port: 22, username: 'root', password: 'Eisa11223344@#',
  readyTimeout: 20000, keepaliveInterval: 15000,
});
conn.on('error', e => { console.error('SSH error:', e.message); process.exit(1); });
