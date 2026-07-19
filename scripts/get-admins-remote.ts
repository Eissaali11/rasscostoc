import 'dotenv/config';
import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection ready!');
  conn.exec('cd /home/stoc/htdocs/stoc.fun && git status && git diff HEAD~1..HEAD --name-only', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream closed with code ' + code);
      conn.end();
    }).on('data', (data) => {
      console.log(data.toString());
    }).stderr.on('data', (data) => {
      console.error(data.toString());
    });
  });
}).connect({
  host: (process.env.SSH_HOST || ''),
  port: 22,
  username: process.env.SSH_USER || 'root',
  password: process.env.SSH_PASSWORD,
  readyTimeout: 60000
});
