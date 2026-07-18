import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection ready!');
  conn.exec('curl -i http://localhost:5000/api/health', (err, stream) => {
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
  host: process.env.OPS_SSH_HOST,
  port: 22,
  username: process.env.OPS_SSH_USER,
  password: process.env.OPS_SSH_PASSWORD
});
