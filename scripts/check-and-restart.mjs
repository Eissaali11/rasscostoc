import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2");

const COMMANDS = [
  "tail -n 100 /home/stoc/htdocs/stoc.fun/logs/output-1.log",
  "echo ====ERR====",
  "tail -n 100 /home/stoc/htdocs/stoc.fun/logs/error-1.log | grep -iE 'Error|Cannot|Syntax|Reference|EADDRINUSE|listen|throw' || true",
  "echo ====PORT====",
  "ss -lptn 'sport = :5000' || netstat -tlnp | grep 5000 || true",
  "echo ====RESTART====",
  "fuser -k 5000/tcp || true",
  "sleep 1",
  "cd /home/stoc/htdocs/stoc.fun && pm2 restart nulip-inventory --update-env",
  "sleep 3",
  "pm2 status nulip-inventory",
  "tail -n 30 /home/stoc/htdocs/stoc.fun/logs/output-1.log",
].join("\n");

const conn = new Client();
conn.on("ready", () => {
  conn.exec(COMMANDS, { pty: true }, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    let out = "";
    stream.on("close", () => {
      console.log(out);
      conn.end();
    });
    stream.on("data", (d) => {
      out += d.toString();
    });
    stream.stderr.on("data", (d) => {
      out += d.toString();
    });
  });
}).connect({
  host: process.env.OPS_SSH_HOST,
  port: 22,
  username: process.env.OPS_SSH_USER,
  password: process.env.OPS_SSH_PASSWORD,
  readyTimeout: 30000,
});
