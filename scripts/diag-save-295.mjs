import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2");

const PROJECT = "/home/stoc/htdocs/stoc.fun";
const NODE_SCRIPT = `
import pg from 'pg';
async function main() {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const e = await c.query(\`
    SELECT e.request_id, e.sn, e.sim_serial, e.sim_type, e.installation_status,
           e.sales_technician, e.technician_code, e.version, e.updated_at, e.response_reason_code
    FROM courier_executions e WHERE e.request_id = 295
  \`);
  console.log('EXEC', JSON.stringify(e.rows));
  const items = await c.query(\`
    SELECT serial_number, status, current_owner_id FROM items
    WHERE serial_number IN ('303021982','8996606099020521896')
  \`);
  console.log('ITEMS', JSON.stringify(items.rows));
  const ri = await c.query(\`
    SELECT id, item_type, serial_number, sim_serial, status FROM courier_request_items WHERE request_id = 295
  \`);
  console.log('REQ_ITEMS', JSON.stringify(ri.rows));
  const audit = await c.query(\`
    SELECT id, action, field_name, new_value, changed_at FROM courier_audit_logs
    WHERE record_id = 295 OR record_id::text = '295'
    ORDER BY id DESC LIMIT 15
  \`);
  console.log('AUDIT', JSON.stringify(audit.rows));
  const moving = await c.query(\`
    SELECT item_type_id, units FROM technician_moving_inventory_entries
    WHERE technician_id = 'c36b9f71-822b-488e-980f-a3c9cf9ac313'
  \`);
  console.log('MOVING', JSON.stringify(moving.rows));
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
`;

const COMMANDS = [
  `cd ${PROJECT}`,
  `export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)`,
  `cat > ${PROJECT}/diag295.mjs << 'EOF'`,
  NODE_SCRIPT.trim(),
  `EOF`,
  `node diag295.mjs`,
  `rm -f diag295.mjs`,
  `echo === LOGS ===`,
  `pm2 logs nulip-inventory --lines 120 --nostream --no-color 2>/dev/null | grep -iE "295|executions|Guard|InventorySubscriber|deduct|خطأ|error|SALAH|تجريبي|ScanOut" | tail -50`,
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
