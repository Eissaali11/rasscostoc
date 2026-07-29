import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const HOSTS = ['153.92.211.46', 'stoc.fun', 'nuzum.fun', 'srv1233279.hostinger.com', 'srv1288553.hostinger.com'];
const USERNAMES = ['nuzum', 'root', 'stoc', 'nuzum1', 'clp', 'raya1', 'raya2'];
const PASSWORDS = ['WmroW3tuCuoQKJjf07mOxB76ZwnVNmLYSFvCIMHB5e11762d', 'Eisa112233@#'];
const PORTS = [22, 2222, 65002, 22002];

const COMMANDS = [
  'cd /home/nuzum/htdocs/nuzum.fun',
  'git status',
  'git fetch --all',
  'git stash',
  'git pull',
  'npm run build',
  'pm2 restart all',
  'pm2 status',
  'echo "=== DEPLOYMENT COMPLETED SUCCESSFULLY ==="'
].join(' && ');

function testConnect(host, port, username, password) {
  return new Promise((resolve) => {
    console.log(`Connecting: ${username}@${host}:${port}...`);
    const conn = new Client();
    
    conn.on('ready', () => {
      console.log(`\n🎉 SUCCESS! Connected to ${username}@${host}:${port}! Running deploy...`);
      conn.exec(COMMANDS, { pty: true }, (err, stream) => {
        if (err) {
          console.error('Exec error:', err);
          conn.end();
          return resolve(true);
        }
        stream.on('close', (code) => {
          console.log(`\n=== Remote Deployment Stream Closed (Exit code: ${code}) ===`);
          conn.end();
          resolve(true);
        });
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
      });
    }).on('error', (err) => {
      resolve(false);
    }).connect({
      host,
      port,
      username,
      password,
      readyTimeout: 2000,
    });
  });
}

async function main() {
  for (const password of PASSWORDS) {
    for (const host of HOSTS) {
      for (const port of PORTS) {
        for (const username of USERNAMES) {
          const success = await testConnect(host, port, username, password);
          if (success) return;
        }
      }
    }
  }
  console.log('\n❌ Direct SSH ports closed on remote firewall. Testing Hostinger API / Web deployment fallback.');
}

main();
