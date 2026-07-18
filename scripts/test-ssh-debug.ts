import { Client } from 'ssh2';

const conn = new Client();

conn.on('banner', (message) => {
  console.log('SSH Banner:', message);
});

conn.on('greeting', (message) => {
  console.log('SSH Greeting:', message);
});

conn.on('handshake', (negotiized) => {
  console.log('SSH Handshake completed with:', negotiized);
});

conn.on('ready', () => {
  console.log('SSH Connection Ready!');
  conn.end();
});

conn.on('error', (err) => {
  console.error('SSH Connection Error:', err);
});

conn.on('end', () => {
  console.log('SSH Connection Ended');
});

conn.on('close', () => {
  console.log('SSH Connection Closed');
});

console.log('Starting SSH connection to [OPS_SSH_HOST]...');
conn.connect({
  host: process.env.OPS_SSH_HOST,
  port: 22,
  username: process.env.OPS_SSH_USER,
  password: process.env.OPS_SSH_PASSWORD,
  readyTimeout: 60000,
  debug: (msg) => console.log('DEBUG:', msg)
});
