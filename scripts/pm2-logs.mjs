import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('=== Connected to SSH ===');
  conn.exec('pm2 logs nulip-inventory --lines 50 --no-daemon', { pty: true }, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('close', (code) => { console.log(`\n=== Done (exit: ${code}) ===`); conn.end(); });
    stream.on('data', (d) => {
      process.stdout.write(d.toString());
      // End connection after receiving some logs
      if (d.toString().includes('PM2')) {
        setTimeout(() => conn.end(), 2000);
      }
    });
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
  });
}).connect({
  host: process.env.OPS_SSH_HOST, port: 22, username: process.env.OPS_SSH_USER, password: process.env.OPS_SSH_PASSWORD,
});
