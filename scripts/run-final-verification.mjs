/**
 * Uploads and runs final-verification.cjs on production server
 */
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const scriptContent = fs.readFileSync('./scripts/final-verification.cjs', 'utf8');
const REMOTE_PATH = '/home/stoc/htdocs/stoc.fun/scripts/final-verification.cjs';

conn.on('ready', () => {
  console.log('=== SSH Connected — Uploading verification script ===');
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }

    const writeStream = sftp.createWriteStream(REMOTE_PATH);
    writeStream.on('close', () => {
      console.log('Script uploaded. Running...\n');
      conn.exec(
        `cd /home/stoc/htdocs/stoc.fun && export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-) && node ${REMOTE_PATH} 2>&1`,
        { pty: false },
        (err, stream) => {
          if (err) { console.error(err); conn.end(); return; }
          stream.on('close', (code) => {
            console.log(`\n[Exit: ${code}]`);
            conn.end();
          });
          stream.on('data', (d) => process.stdout.write(d.toString()));
          stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
        }
      );
    });
    writeStream.on('error', (e) => { console.error('Write error:', e); conn.end(); });
    writeStream.end(scriptContent);
  });
}).connect({
  host: process.env.OPS_SSH_HOST, port: 22, username: process.env.OPS_SSH_USER, password: process.env.OPS_SSH_PASSWORD,
  readyTimeout: 20000, keepaliveInterval: 15000, keepaliveCountMax: 20,
});
conn.on('error', (e) => { console.error('Connection error:', e.message); process.exit(1); });
