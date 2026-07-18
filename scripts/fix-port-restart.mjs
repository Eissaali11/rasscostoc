import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2");

const COMMANDS = [
  "pm2 stop nulip-inventory || true",
  "fuser -k 5000/tcp 2>/dev/null || true",
  "sleep 2",
  "cd /home/stoc/htdocs/stoc.fun && pm2 restart nulip-inventory",
  "sleep 4",
  "pm2 status",
  "git -C /home/stoc/htdocs/stoc.fun log -1 --oneline",
  "curl -s http://127.0.0.1:5000/api/health; echo",
  "grep -n 'resolveTechnician\\|Authoritative technician' apps/api/src/modules/courier/application/inventory/inventory.engine.ts apps/api/src/modules/courier/application/courier.service.ts | head -10",
].join(" ; ");

const conn = new Client();
conn.on("ready", () => {
  conn.exec(COMMANDS, { pty: true }, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("close", () => conn.end());
    stream.on("data", (d) => process.stdout.write(d.toString()));
    stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
  });
}).connect({
  host: process.env.OPS_SSH_HOST, port: 22, username: process.env.OPS_SSH_USER, password: process.env.OPS_SSH_PASSWORD, readyTimeout: 30000,
});
