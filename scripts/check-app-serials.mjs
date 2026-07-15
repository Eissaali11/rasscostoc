import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2");

const NODE = `
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
for (const sn of ['303021982','SN-950-7612','8996601200003482910','8996606099020521896']) {
  const r = await c.query('SELECT serial_number,status,current_owner_id,item_type_id FROM items WHERE serial_number=$1 OR barcode=$1 LIMIT 3',[sn]);
  console.log('ITEM', sn, JSON.stringify(r.rows));
}
const e = await c.query("SELECT request_id,sn,sim_serial,installation_status FROM courier_executions WHERE sn IN ('303021982','SN-950-7612') OR sim_serial IN ('8996601200003482910','8996606099020521896') OR request_id IN (295,1042)");
console.log('EXEC', JSON.stringify(e.rows));
await c.end();
`;

const COMMANDS = [
  "cd /home/stoc/htdocs/stoc.fun",
  "export DATABASE_URL=$(grep '^DATABASE_URL' .env | head -1 | cut -d= -f2-)",
  "cat > /tmp/check_serials.mjs << 'EOF'",
  NODE.trim(),
  "EOF",
  "node /tmp/check_serials.mjs",
  "rm -f /tmp/check_serials.mjs",
].join("\n");

const conn = new Client();
conn.on("ready", () => {
  conn.exec(COMMANDS, { pty: true }, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let out = "";
    stream.on("close", () => { console.log(out); conn.end(); });
    stream.on("data", (d) => { out += d.toString(); });
    stream.stderr.on("data", (d) => { out += d.toString(); });
  });
}).connect({
  host: "72.62.149.127", port: 22, username: "root", password: "Eisa11223344@#", readyTimeout: 30000,
});
