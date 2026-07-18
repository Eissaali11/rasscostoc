import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2");
const PROJECT = "/home/stoc/htdocs/stoc.fun";
const TECH = "c36b9f71-822b-488e-980f-a3c9cf9ac313";
const TYPE = "ec4bf5c0-06de-47dc-88af-2b6b465b8a52";

const NODE = `
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(\`
  SELECT i.serial_number, i.status, i.item_type_id, cm.reason, cm.reference_id, cm.performed_at
  FROM custody_movements cm
  JOIN items i ON i.id = cm.item_id
  WHERE cm.from_owner_id = $1 AND cm.reason IN ('DELIVERED','DELIVERY')
  ORDER BY cm.performed_at DESC
\`, ['${TECH}']);
console.log('DELIVERED_ROWS', JSON.stringify(r.rows));
const leb = r.rows.filter(x => x.item_type_id === '${TYPE}');
console.log('LEBARA_COUNT', leb.length);
await c.end();
`;

const cmds = [
  `cd ${PROJECT}`,
  `export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)`,
  `pm2 status nulip-inventory`,
  `node -e ${JSON.stringify(NODE)}`,
].join("\n");

const conn = new Client();
conn.on("ready", () => {
  conn.exec(cmds, { pty: true }, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let out = "";
    stream.on("close", () => { console.log(out); conn.end(); });
    stream.on("data", (d) => { out += d.toString(); });
    stream.stderr.on("data", (d) => { out += d.toString(); });
  });
}).connect({ host: process.env.OPS_SSH_HOST, port: 22, username: process.env.OPS_SSH_USER, password: process.env.OPS_SSH_PASSWORD, readyTimeout: 30000 });
