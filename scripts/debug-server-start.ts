import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envBackupPath = path.join(process.cwd(), '.env.backup');

async function main() {
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, envBackupPath);
  }

  const perfEnvContent = `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nulip_performance
PORT=3001
NODE_ENV=development
SESSION_SECRET=change-this-secret-key-in-production-12345
TRUST_PROXY=true
SYSTEM_INTERNAL_TOKEN=8b8cd37c1543ea9fb896174a72d3f749db2ba85e27a69b7a4216839ea451d69d
JWT_SECRET=default-jwt-secret-key-for-development
`;
  fs.writeFileSync(envPath, perfEnvContent);

  console.log('Spawning API server in debug mode...');
  const out = fs.openSync('server_stdout.log', 'w');
  const err = fs.openSync('server_stderr.log', 'w');

  const server = spawn('npx', ['tsx', 'apps/api/src/server.ts'], {
    env: { ...process.env },
    shell: true,
    stdio: ['ignore', out, err]
  });

  console.log('Waiting 15 seconds to let server start and capture output...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  console.log('Killing server...');
  try {
    server.kill();
  } catch (e) {}

  // Try to kill port 3001 just in case
  try {
    const { execSync } = require('child_process');
    const output = execSync(`netstat -ano | findstr :3001`).toString();
    const pid = output.trim().split('\n')[0].trim().split(/\s+/).pop();
    if (pid && pid !== '0') {
      execSync(`taskkill /F /PID ${pid}`);
    }
  } catch (e) {}

  if (fs.existsSync(envBackupPath)) {
    fs.copyFileSync(envBackupPath, envPath);
    fs.unlinkSync(envBackupPath);
  }

  console.log('Done. Check server_stdout.log and server_stderr.log');
}

main().catch(console.error);
