import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2");
const conn = new Client();
const cmd = [
  "grep -n serial-lookup /home/stoc/htdocs/stoc.fun/apps/api/src/modules/courier/presentation/routes/courier.routes.ts",
  "grep -o 'من عهدة الجهاز' /home/stoc/htdocs/stoc.fun/dist/public/assets/index-*.js | head -c 50; echo",
  "curl -s -o /tmp/lk.json -w 'HTTP %{http_code}' -X POST http://127.0.0.1:5000/api/courier/serial-lookup -H 'Content-Type: application/json' -d '{\"sn\":\"303021982\"}'",
  "echo",
  "head -c 200 /tmp/lk.json; echo",
].join(" ; ");
conn.on("ready", () => {
  conn.exec(cmd, { pty: true }, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("close", () => conn.end());
    stream.on("data", (d) => process.stdout.write(d.toString()));
    stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
  });
}).connect({
  host: "72.62.149.127", port: 22, username: "root", password: "Eisa11223344@#", readyTimeout: 20000,
});
