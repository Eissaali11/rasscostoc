import net from 'net';

const HOSTS = ['153.92.211.46', 'stoc.fun', 'nuzum.fun', 'srv1233279.hostinger.com'];
const PORTS = [22, 2222, 65002, 22002, 2200, 222, 65022, 1022, 22222];

async function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2500);

    socket.on('connect', () => {
      console.log(`✅ PORT OPEN: ${host}:${port}`);
      socket.destroy();
      resolve(port);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(null);
    });

    socket.connect(port, host);
  });
}

async function main() {
  console.log('Scanning hosts and SSH ports...');
  for (const host of HOSTS) {
    console.log(`\nTesting ${host}...`);
    for (const port of PORTS) {
      await checkPort(host, port);
    }
  }
  console.log('\nScan finished.');
}

main();
