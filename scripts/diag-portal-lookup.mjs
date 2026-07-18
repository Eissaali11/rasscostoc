import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2");

const PROJECT = "/home/stoc/htdocs/stoc.fun";

const NODE_SCRIPT = `
import pg from 'pg';

async function main() {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // Simulate what serialLookup does for device
  const sn = '303021982';
  const item = await c.query(\`
    SELECT i.id, i.serial_number, i.status, i.current_owner_id, i.item_type_id,
           u.full_name, u.username, u.technician_code
    FROM items i
    LEFT JOIN users u ON u.id = i.current_owner_id
    WHERE i.serial_number = $1 OR i.barcode = $1
    LIMIT 1
  \`, [sn]);
  console.log('DEVICE', JSON.stringify(item.rows));

  const simTypo = '9996606099020521896';
  const simFixed = '8996606099020521896';
  const sim = await c.query(\`
    SELECT i.serial_number, i.status, i.current_owner_id, u.full_name, u.username
    FROM items i LEFT JOIN users u ON u.id = i.current_owner_id
    WHERE i.serial_number = ANY($1)
  \`, [[simTypo, simFixed]]);
  console.log('SIM', JSON.stringify(sim.rows));

  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
`;

const COMMANDS = [
  `cd ${PROJECT}`,
  `echo === GIT ===`,
  `git log -1 --oneline`,
  `echo === PORTAL SRC LABELS ===`,
  `grep -n "من التعيين\\|من عهدة\\|امسح رقم الجهاز\\|doSerialLookup\\|serial-lookup" apps/portal/src/pages/courier/courier-request-detail.tsx | head -40`,
  `echo === DIST ASSETS ===`,
  `ls -la dist/public/assets/index-*.js | tail -3`,
  `echo === DIST STRINGS ===`,
  `grep -o "من عهدة الجهاز\\|من التعيين\\|امسح رقم الجهاز لتحديد الفني" dist/public/assets/index-*.js | sort | uniq -c`,
  `echo === INDEX HTML ASSET ===`,
  `grep -o 'assets/index-[^"]*\\.js' dist/public/index.html`,
  `echo === NGINX CACHE HEADERS ===`,
  `curl -sI https://stc1.fun/courier/requests | head -20`,
  `ASSET=$(grep -o 'assets/index-[^"]*\\.js' dist/public/index.html | head -1)`,
  `echo ASSET=$ASSET`,
  `curl -sI "https://stc1.fun/$ASSET" | head -15`,
  `echo === LOOKUP ROUTE ===`,
  `grep -n "serial-lookup\\|serialLookup" apps/api/src/modules/courier/presentation/routes/courier.routes.ts`,
  `echo === DB ===`,
  `export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)`,
  `cat > ${PROJECT}/diag-lookup.mjs << 'EOF'`,
  NODE_SCRIPT.trim(),
  `EOF`,
  `node diag-lookup.mjs`,
  `rm -f diag-lookup.mjs`,
  `echo === SERVE PUBLIC ===`,
  `ls -la dist/public/assets/index-*.js | wc -l`,
  `test -f dist/public/index.html && head -30 dist/public/index.html`,
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
  host: process.env.OPS_SSH_HOST, port: 22, username: process.env.OPS_SSH_USER, password: process.env.OPS_SSH_PASSWORD, readyTimeout: 30000,
});
