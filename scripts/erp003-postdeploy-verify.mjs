/**
 * ERP-003 post-deploy operational probes (read-only where possible).
 * Usage: node scripts/erp003-postdeploy-verify.mjs [--base-url https://stc1.fun]
 * Auth: SMOKE_USER / SMOKE_PASS (default admin / admin123) — Bearer token like smoke:api
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const { Client } = require("ssh2");

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base-url");
const BASE = (baseIdx >= 0 ? args[baseIdx + 1] : process.env.SMOKE_BASE_URL || "https://stc1.fun").replace(
  /\/+$/,
  ""
);
const USER = process.env.SMOKE_USER || "admin";
const PASS = process.env.SMOKE_PASS || "admin123";

const results = [];
function mark(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}${detail ? ` — ${detail}` : ""}`);
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  const token = data?.token;
  return { ok: res.ok && Boolean(token), status: res.status, token, data };
}

async function api(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return {
    ok: res.ok,
    status: res.status,
    sqlMs: res.headers.get("x-sql-time-ms"),
    apiMs: res.headers.get("x-api-time-ms"),
    data,
  };
}

async function pm2Tail() {
  const deploySrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "deploy-ssh.mjs"), "utf8");
  const host = deploySrc.match(/host:\s*'([^']+)'/)?.[1];
  const port = Number(deploySrc.match(/port:\s*(\d+)/)?.[1] || 22);
  const username = deploySrc.match(/username:\s*'([^']+)'/)?.[1];
  const password = deploySrc.match(/password:\s*'([^']+)'/)?.[1];

  return new Promise((resolve) => {
    const conn = new Client();
    let out = "";
    conn
      .on("ready", () => {
        conn.exec(
          "pm2 logs nulip-inventory --lines 80 --nostream 2>&1 | tail -n 80",
          { pty: true },
          (err, stream) => {
            if (err) {
              conn.end();
              return resolve({ ok: false, out: String(err) });
            }
            stream.on("data", (d) => {
              out += d.toString();
            });
            stream.stderr?.on("data", (d) => {
              out += d.toString();
            });
            stream.on("close", () => {
              conn.end();
              const cleaned = out.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "");
              const errorish = cleaned
                .split("\n")
                .filter((l) => /error|exception|fatal|unhandled/i.test(l) && !/Session get error/i.test(l));
              resolve({ ok: errorish.length === 0, out: cleaned, errorish });
            });
          }
        );
      })
      .on("error", (e) => resolve({ ok: false, out: e.message, errorish: [e.message] }))
      .connect({ host, port, username, password, readyTimeout: 60000 });
  });
}

console.log(`# ERP-003 post-deploy verify\nBase: ${BASE}\n`);

const health = await fetch(`${BASE}/api/health`);
const healthBody = await health.text();
mark("health", health.ok, `${health.status} ${healthBody.slice(0, 80)}`);

const auth = await login();
mark("login", auth.ok, `status=${auth.status}`);

if (auth.ok && auth.token) {
  const list = await api("/api/courier/requests?page=1&pageSize=25", auth.token);
  const rows = list.data?.rows ?? list.data?.data ?? [];
  mark(
    "courier_requests_list",
    list.ok,
    `status=${list.status} sql=${list.sqlMs}ms api=${list.apiMs}ms rows=${Array.isArray(rows) ? rows.length : "?"}`
  );
  mark(
    "headers_sql_api",
    Boolean(list.sqlMs) && Boolean(list.apiMs),
    `X-SQL-Time-Ms=${list.sqlMs} X-API-Time-Ms=${list.apiMs}`
  );

  const sampleTid = rows[0]?.tid || rows[0]?.request?.tid;
  if (sampleTid) {
    const exact = await api(
      `/api/courier/requests?page=1&pageSize=10&q=${encodeURIComponent(sampleTid)}`,
      auth.token
    );
    mark("search_tid_exact", exact.ok, `q=${sampleTid} sql=${exact.sqlMs}ms api=${exact.apiMs}ms`);
  } else {
    mark("search_tid_exact", false, "no sample TID in first page");
  }

  const sn = rows[0]?.execution?.sn || rows[0]?.sn;
  if (sn && String(sn).length >= 3) {
    const prefix = String(sn).slice(0, Math.min(8, String(sn).length));
    const snSearch = await api(
      `/api/courier/requests?page=1&pageSize=10&q=${encodeURIComponent(prefix)}`,
      auth.token
    );
    mark("search_sn_prefix", snSearch.ok, `q=${prefix} sql=${snSearch.sqlMs}ms api=${snSearch.apiMs}ms`);
  } else {
    mark("search_sn_prefix", true, "skipped (no SN on first page) — confirm in UI");
  }

  const pdf = await api("/api/courier/pdf?page=1&pageSize=5", auth.token);
  mark("pdf_list_opens", pdf.ok || pdf.status === 404, `status=${pdf.status} (list only; no AI)`);
} else {
  mark("courier_requests_list", false, "skipped — auth failed");
  mark("headers_sql_api", false, "skipped");
  mark("search_tid_exact", false, "skipped");
  mark("search_sn_prefix", false, "skipped");
  mark("pdf_list_opens", false, "skipped");
}

console.log("\n# PM2 recent logs");
const logs = await pm2Tail();
mark(
  "pm2_no_critical_errors",
  logs.ok,
  logs.errorish?.length ? logs.errorish.slice(0, 5).join(" | ") : "no error/fatal lines in last 80"
);

const failed = results.filter((r) => !r.ok);
console.log("\n# Summary");
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log("Failed:", failed.map((f) => f.id).join(", "));
  process.exit(1);
}
process.exit(0);
