import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2");

const remote = `
cd /home/stoc/htdocs/stoc.fun && node --input-type=module <<'EOF'
import 'dotenv/config';
import pg from 'pg';
const p = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const sn = '303021879';
const sim = '8996606099020515137';
const items = await p.query(
  'select serial_number, status, current_owner_id from items where serial_number = any($1)',
  [[sn, sim]]
);
console.log('ITEMS', JSON.stringify(items.rows));
const ex = await p.query(
  'select request_id, installation_status, sn, sim_serial, sales_technician, technician_code from courier_executions where request_id = 241'
);
console.log('EXEC', JSON.stringify(ex.rows));
const mov = await p.query(
  \`select serial_number, reason, to_user_id, from_user_id, reference_id::text, created_at
   from custody_movements
   where serial_number = any($1)
   order by created_at desc limit 8\`,
  [[sn, sim]]
);
console.log('MOV', JSON.stringify(mov.rows));
await p.end();
EOF
`;

const c = new Client();
c.on("ready", () => {
  c.exec(remote, (err, stream) => {
    if (err) {
      console.error(err);
      c.end();
      return;
    }
    stream.on("data", (d) => process.stdout.write(d.toString()));
    stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
    stream.on("close", () => c.end());
  });
});
c.on("error", (e) => console.error(e.message));
c.connect({
  host: (process.env.SSH_HOST || ''),
  port: 22,
  username: process.env.SSH_USER || 'root',
  password: process.env.SSH_PASSWORD,
  readyTimeout: 60000,
});
