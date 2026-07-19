import 'dotenv/config';
import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection ready!');
  
  const commands = [
    'cd /home/stoc/htdocs/stoc.fun',
    'git fetch origin',
    'git reset --hard origin/courier-custody-tech-fix',
    'npx tsc -p packages/ai-extraction/tsconfig.json',
    'npm run build',
    'pm2 restart all'
  ];
  
  const fullCommand = commands.join(' && ');
  console.log(`Executing commands on server:\n${commands.map(c => `  $ ${c}`).join('\n')}\n`);
  
  conn.exec(fullCommand, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('\nStream closed with code ' + code);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect({
  host: (process.env.SSH_HOST || ''),
  port: 22,
  username: process.env.SSH_USER || 'root',
  password: process.env.SSH_PASSWORD,
  readyTimeout: 60000
});
