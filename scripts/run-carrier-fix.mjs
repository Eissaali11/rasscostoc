import 'dotenv/config';
/**
 * Uploads and runs fix-carriers.cjs from project node_modules directory
 */
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
const scriptContent = fs.readFileSync('./scripts/fix-carriers.cjs', 'utf8');
const REMOTE_PATH = '/home/stoc/htdocs/stoc.fun/scripts/fix-carriers-run.cjs';

conn.on('ready', () => {
  console.log('=== SSH Connected ===');
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }
    
    const writeStream = sftp.createWriteStream(REMOTE_PATH);
    writeStream.on('close', () => {
      console.log('Script uploaded. Running from project dir...');
      conn.exec(
        // Run from project dir so node_modules/pg is available
        `cd /home/stoc/htdocs/stoc.fun && export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-) && node ${REMOTE_PATH} 2>&1`,
        { pty: false },
        (err, stream) => {
          if (err) { console.error(err); conn.end(); return; }
          stream.on('close', (code) => {
            console.log(`\n=== Done (exit: ${code}) ===`);
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
  host: (process.env.SSH_HOST || ''), port: 22, username: process.env.SSH_USER || 'root', password: process.env.SSH_PASSWORD, readyTimeout: 20000,
});
conn.on('error', (e) => { console.error('Connection error:', e.message); process.exit(1); });
