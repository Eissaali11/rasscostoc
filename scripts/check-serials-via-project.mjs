import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2");
const PROJECT = "/home/stoc/htdocs/stoc.fun";
const COMMANDS = [
  `cd ${PROJECT}`,
  `export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)`,
  `node --input-type=module -e "
import pg from 'pg';
const c=new pg.Client({connectionString:process.env.DATABASE_URL});
await c.connect();
const items=await c.query(\\"SELECT serial_number,status,current_owner_id FROM items WHERE serial_number IN ('303021982','8996606099020521896','SN-950-7612','8996601200003482910')\\");
console.log('ITEMS', JSON.stringify(items.rows));
const cm=await c.query(\\"SELECT i.serial_number, cm.reason, cm.reference_id FROM custody_movements cm JOIN items i ON i.id=cm.item_id WHERE cm.from_owner_id='c36b9f71-822b-488e-980f-a3c9cf9ac313' AND cm.reason IN ('DELIVERED','DELIVERY') ORDER BY cm.performed_at DESC LIMIT 10\\");
console.log('DELIVERED', JSON.stringify(cm.rows));
await c.end();
"`,
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
}).connect({ host: "72.62.149.127", port: 22, username: "root", password: "Eisa11223344@#", readyTimeout: 30000 });
