/**
 * One-shot: complete courier request #295 and deduct v3 custody (items + moving).
 * Mirrors SerializedItemsService.scanOut + marks execution Installation Completed.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2");

const PROJECT = "/home/stoc/htdocs/stoc.fun";
const TECH_ID = "c36b9f71-822b-488e-980f-a3c9cf9ac313";
const REQUEST_ID = 295;
const SERIALS = ["303021982", "8996606099020521896"];

const NODE_SCRIPT = `
import pg from 'pg';

const TECH_ID = ${JSON.stringify(TECH_ID)};
const REQUEST_ID = ${REQUEST_ID};
const SERIALS = ${JSON.stringify(SERIALS)};

async function scanOut(c, serial) {
  const { rows: found } = await c.query(
    \`SELECT id, serial_number, status, item_type_id, current_owner_id
     FROM items
     WHERE serial_number = $1
       AND current_owner_id = $2
       AND status IN ('RECEIVED_BY_TECHNICIAN', 'IN_TRANSIT_CUSTODY')
     LIMIT 1\`,
    [serial, TECH_ID]
  );
  if (!found[0]) {
    console.log('SKIP_OR_MISSING', serial);
    return null;
  }
  const item = found[0];
  await c.query('BEGIN');
  try {
    await c.query(
      \`UPDATE items
       SET status = 'DELIVERED', current_owner_id = NULL, updated_at = NOW()
       WHERE id = $1\`,
      [item.id]
    );
    await c.query(
      \`INSERT INTO inventory_transactions
        (item_id, transaction_type, source_owner_id, receiver_name, order_number, notes)
       VALUES ($1, 'DELIVERY', $2, 'عميل طلب 295', $3, 'خصم يدوي بعد إكمال الطلب 295')\`,
      [item.id, TECH_ID, String(REQUEST_ID)]
    );
    await c.query(
      \`INSERT INTO item_history_logs
        (item_id, from_status, to_status, changed_by_id, notes)
       VALUES ($1, $2, 'DELIVERED', $3, $4)\`,
      [item.id, item.status, TECH_ID, 'تسليم وإكمال طلب 295']
    );
    await c.query(
      \`INSERT INTO custody_movements
        (item_id, from_owner_id, to_owner_id, reason, reference_type, reference_id, performed_by_id, notes)
       VALUES ($1, $2, NULL, 'DELIVERED', 'COURIER_REQUEST', $3, $2, 'إكمال طلب 295')\`,
      [item.id, TECH_ID, String(REQUEST_ID)]
    );
    await c.query(
      \`UPDATE technician_moving_inventory_entries
       SET units = GREATEST(0, units - 1), updated_at = NOW()
       WHERE technician_id = $1 AND item_type_id = $2\`,
      [TECH_ID, item.item_type_id]
    );
    await c.query('COMMIT');
    console.log('DEDUCTED', serial, item.item_type_id);
    return item;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
}

async function main() {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  for (const sn of SERIALS) {
    await scanOut(c, sn);
  }

  await c.query(
    \`UPDATE courier_executions
     SET installation_status = 'Installation Completed',
         sales_technician = 'تجريبي',
         technician_code = 'eissa11',
         updated_at = NOW(),
         version = version + 1
     WHERE request_id = $1\`,
    [REQUEST_ID]
  );

  await c.query(
    \`UPDATE courier_request_items
     SET status = 'INSTALLED', updated_at = NOW()
     WHERE request_id = $1\`,
    [REQUEST_ID]
  );

  const e = await c.query(
    \`SELECT request_id, installation_status, sn, sim_serial, technician_code, version
     FROM courier_executions WHERE request_id = $1\`,
    [REQUEST_ID]
  );
  const items = await c.query(
    \`SELECT serial_number, status, current_owner_id FROM items
     WHERE serial_number = ANY($1::text[])\`,
    [SERIALS]
  );
  const moving = await c.query(
    \`SELECT item_type_id, units FROM technician_moving_inventory_entries
     WHERE technician_id = $1 AND units > 0\`,
    [TECH_ID]
  );
  const active = await c.query(
    \`SELECT serial_number, status FROM items
     WHERE current_owner_id = $1
       AND status IN ('RECEIVED_BY_TECHNICIAN', 'IN_TRANSIT_CUSTODY')\`,
    [TECH_ID]
  );

  console.log('EXEC', JSON.stringify(e.rows));
  console.log('ITEMS', JSON.stringify(items.rows));
  console.log('MOVING_GT0', JSON.stringify(moving.rows));
  console.log('ACTIVE_CUSTODY', JSON.stringify(active.rows));
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
`;

const COMMANDS = [
  `cd ${PROJECT}`,
  `export DATABASE_URL=$(grep "^DATABASE_URL" .env | head -1 | cut -d= -f2-)`,
  `cat > ${PROJECT}/complete295.mjs << 'EOF'`,
  NODE_SCRIPT.trim(),
  `EOF`,
  `node complete295.mjs`,
  `rm -f complete295.mjs`,
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
    stream.on("close", (code) => {
      console.log(out);
      console.log("exit", code);
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
