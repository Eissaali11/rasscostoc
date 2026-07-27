import net from 'net';

const HOSTS = ['153.92.211.46', 'stoc.fun', 'owner.nuzum.fun', 'srv1288553.hostinger.com', 'srv1233279.hostinger.com'];
const PORTS = [22, 2222, 65002, 22002, 8443, 443, 80, 5000, 3000];

async function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2500);
    socket.on('connect', () => {
      console.log(`[OPEN] ${host}:${port}`);
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function main() {
  console.log('Testing open ports on server...');
  for (const host of HOSTS) {
    for (const port of PORTS) {
      await checkPort(host, port);
    }
  }
  console.log('Port scan complete.');
}

main();
