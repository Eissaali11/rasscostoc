import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection ready!');
  
  const commands = [
    'cd /home/stoc/htdocs/stoc.fun && git status',
    'cd /home/stoc/htdocs/stoc.fun && git fetch origin',
    'cd /home/stoc/htdocs/stoc.fun && git reset --hard origin/courier-custody-tech-fix',
    'cd /home/stoc/htdocs/stoc.fun && rm -rf packages/ai-extraction/dist packages/ai-extraction/tsconfig.tsbuildinfo',
    'cd /home/stoc/htdocs/stoc.fun && npx tsc -p packages/ai-extraction/tsconfig.json',
    'cd /home/stoc/htdocs/stoc.fun && npm run build',
    'cd /home/stoc/htdocs/stoc.fun && pm2 restart all'
  ];
  
  const executeNext = (index: number) => {
    if (index >= commands.length) {
      console.log('All commands completed successfully!');
      conn.end();
      return;
    }
    
    const cmd = commands[index];
    console.log(`Executing: ${cmd}`);
    
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error(`Error executing ${cmd}:`, err);
        conn.end();
        return;
      }
      
      stream.on('close', (code, signal) => {
        console.log(`Command finished with code ${code}`);
        if (code !== 0) {
          console.error(`Command failed, stopping execution.`);
          conn.end();
        } else {
          executeNext(index + 1);
        }
      }).on('data', (data) => {
        process.stdout.write(data.toString());
      }).stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });
    });
  };
  
  executeNext(0);
}).connect({
  host: '72.62.149.127',
  port: 22,
  username: 'root',
  password: 'Eisa11223344@#',
  readyTimeout: 60000
});
