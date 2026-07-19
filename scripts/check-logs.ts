import 'dotenv/config';
import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection ready!');
  conn.exec('tail -n 100 /home/stoc/htdocs/stoc.fun/logs/error-1.log', (err, stream) => {
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
  password: process.env.SSH_PASSWORD
});
