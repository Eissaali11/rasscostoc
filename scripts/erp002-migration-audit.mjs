/**
 * ERP-002 Phase 1 — Migration Drift Audit (read-only by default)
 *
 * Usage:
 *   node scripts/erp002-migration-audit.mjs
 *   node scripts/erp002-migration-audit.mjs --catch-up-dry-run
 *   node scripts/erp002-migration-audit.mjs --catch-up   # writes ledger only; never runs DDL
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(resolve(root, "package.json"));
const pg = require("pg");

const args = new Set(process.argv.slice(2));
const doCatchUp = args.has("--catch-up");
const dryRunCatchUp = args.has("--catch-up-dry-run");

function loadDatabaseUrl() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) throw new Error("Missing .env");
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not set");
  return line
    .replace(/^DATABASE_URL=/, "")
    .replace(/^"|"$/g, "")
    .replace(/^'|'$/g, "");
}

function sha256File(absPath) {
  return createHash("sha256").update(readFileSync(absPath)).digest("hex");
}

/** Lightweight probes: evidence that a migration's objects likely exist. */
const SCHEMA_PROBES = {
  "0000_fixed_daimon_hellstrom": {
    sql: `SELECT to_regclass('public.users') IS NOT NULL AS ok`,
    expect: true,
  },
  "0010_greedy_wither": {
    sql: `SELECT to_regclass('public.bearer_sessions') IS NOT NULL AS ok`,
    expect: true,
  },
  "0011_first_echo": {
    sql: `SELECT to_regclass('public.idempotency_records') IS NOT NULL AS ok`,
    expect: true,
  },
  "0012_hard_nextwave": {
    sql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='courier_requests' AND column_name='version'
    ) AS ok`,
    expect: true,
  },
  "0013_polite_calypso": {
    sql: `SELECT to_regclass('public.courier_execution_attempts') IS NOT NULL AS ok`,
    expect: true,
  },
  "0014_chemical_peter_quill": {
    sql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='warehouse_transfers' AND column_name='transfer_type'
    ) AS ok`,
    expect: true,
  },
  "0015_jittery_true_believers": {
    sql: `SELECT to_regclass('public.custody_movements') IS NOT NULL AS ok`,
    expect: true,
  },
  "0016_windy_wiccan": {
    sql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='item_types' AND column_name='serial_prefix'
    ) AS ok`,
    expect: true,
  },
  "0017_courier_consumable_qtys": {
    sql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='courier_executions' AND column_name='paper_roll_qty'
    ) AS ok`,
    expect: true,
  },
  "0018_erp001_courier_perf_indexes": {
    sql: `SELECT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname='courier_requests_tid_idx'
    ) AS ok`,
    expect: true,
  },
  "0019_erp001_courier_pattern_ops_indexes": {
    sql: `SELECT EXISTS (
      SELECT 1 FROM pg_indexes WHERE indexname='courier_requests_tid_pattern_idx'
    ) AS ok`,
    expect: true,
  },
};

const journal = JSON.parse(
  readFileSync(resolve(root, "migrations/meta/_journal.json"), "utf8")
);

const journalRows = journal.entries.map((e) => {
  const file = resolve(root, `migrations/${e.tag}.sql`);
  const exists = existsSync(file);
  return {
    idx: e.idx,
    tag: e.tag,
    when: String(e.when),
    fileExists: exists,
    hash: exists ? sha256File(file) : null,
  };
});

const url = loadDatabaseUrl();
const client = new pg.Client({ connectionString: url });
await client.connect();

const report = [];
const log = (line = "") => {
  report.push(line);
  console.log(line);
};

try {
  log("# ERP-002 Phase 1 — Migration Drift Audit");
  log(`Generated: ${new Date().toISOString()}`);
  log(`Database: (from DATABASE_URL host only)`);
  try {
    const u = new URL(url);
    log(`Host: ${u.hostname}:${u.port || "5432"} / DB: ${u.pathname.replace(/^\//, "")}`);
  } catch {
    log("Host: (unparsed)");
  }

  const ledger = await client.query(`
    SELECT id, hash, created_at::text AS created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY id
  `);

  log(`\n## Journal entries: ${journalRows.length}`);
  log(`## Ledger rows: ${ledger.rows.length}`);

  const byWhen = new Map(ledger.rows.map((r) => [String(r.created_at), r]));
  const byHash = new Map(ledger.rows.map((r) => [r.hash, r]));

  log("\n## Matrix (journal ↔ ledger ↔ schema probe)");
  log("| idx | tag | in_ledger | hash_match | schema_ok | notes |");
  log("|-----|-----|-----------|------------|-----------|-------|");

  const missingFromLedger = [];
  const hashMismatches = [];
  const schemaGaps = [];

  for (const j of journalRows) {
    const byW = byWhen.get(j.when);
    const byH = j.hash ? byHash.get(j.hash) : null;
    const inLedger = !!(byW || byH);
    let hashMatch = "n/a";
    let notes = [];

    if (!j.fileExists) {
      notes.push("SQL file missing");
    }
    if (byW && j.hash && byW.hash !== j.hash) {
      hashMatch = "MISMATCH";
      hashMismatches.push({ tag: j.tag, ledgerHash: byW.hash, fileHash: j.hash });
      notes.push("created_at match but hash differs");
    } else if (byH) {
      hashMatch = "yes";
    } else if (byW) {
      hashMatch = byW.hash === j.hash ? "yes" : "MISMATCH";
    } else {
      hashMatch = "missing";
      missingFromLedger.push(j);
      notes.push("not in ledger");
    }

    let schemaOk = "n/a";
    const probe = SCHEMA_PROBES[j.tag];
    if (probe) {
      const r = await client.query(probe.sql);
      const ok = !!r.rows[0]?.ok;
      schemaOk = ok ? "yes" : "NO";
      if (!ok) {
        schemaGaps.push(j.tag);
        notes.push("schema probe failed");
      }
    }

    log(
      `| ${j.idx} | ${j.tag} | ${inLedger ? "yes" : "NO"} | ${hashMatch} | ${schemaOk} | ${notes.join("; ") || "—"} |`
    );
  }

  log("\n## Drift summary");
  log(`- Missing from ledger: ${missingFromLedger.length}`);
  for (const m of missingFromLedger) log(`  - ${m.tag} (when=${m.when})`);
  log(`- Hash mismatches: ${hashMismatches.length}`);
  for (const m of hashMismatches) log(`  - ${m.tag}`);
  log(`- Schema probe failures: ${schemaGaps.length}`);
  for (const t of schemaGaps) log(`  - ${t}`);

  // Recommended strategy
  const canCatchUp =
    missingFromLedger.length > 0 &&
    schemaGaps.filter((t) => missingFromLedger.some((m) => m.tag === t)).length === 0;

  log("\n## Recommended strategy for THIS database");
  if (missingFromLedger.length === 0 && hashMismatches.length === 0) {
    log("**None — ledger aligned with journal.** Run `npm run db:migrate` to confirm no-op.");
  } else if (canCatchUp || (missingFromLedger.length > 0 && schemaGaps.length === 0)) {
    log("**Option A — Ledger Catch-up** (schema already has objects; insert hashes only).");
    log("Do not re-run DDL for these tags.");
  } else if (schemaGaps.length > 0) {
    log("**Option B — Repair / apply missing DDL** then record hashes (or migrate pending only after catch-up of applied-but-untracked).");
    log(`Schema gaps: ${schemaGaps.join(", ")}`);
  } else {
    log("**Manual review required.**");
  }

  if (dryRunCatchUp || doCatchUp) {
    log("\n## Catch-up plan");
    const toInsert = missingFromLedger.filter((m) => m.hash);
    for (const m of toInsert) {
      log(`INSERT hash=${m.hash.slice(0, 12)}… created_at=${m.when} tag=${m.tag}`);
    }

    if (doCatchUp) {
      if (schemaGaps.length > 0) {
        throw new Error(
          `Refusing --catch-up: schema probes failed for: ${schemaGaps.join(", ")}`
        );
      }
      await client.query("BEGIN");
      for (const m of toInsert) {
        const exists = await client.query(
          `SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1 OR created_at = $2 LIMIT 1`,
          [m.hash, m.when]
        );
        if (exists.rowCount > 0) {
          log(`SKIP (already present): ${m.tag}`);
          continue;
        }
        await client.query(
          `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
          [m.hash, m.when]
        );
        log(`INSERTED: ${m.tag}`);
      }
      await client.query("COMMIT");
      log("\nCatch-up committed.");
    } else {
      log("\n(Dry run only — no writes. Re-run with --catch-up to apply.)");
    }
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  log(`\nERROR: ${e.message}`);
  console.error(e);
  process.exitCode = 1;
} finally {
  await client.end();
  const out = resolve(root, "docs/adr/ERP-002-migration-drift-audit.md");
  writeFileSync(out, report.join("\n") + "\n", "utf8");
  console.log(`\nWrote ${out}`);
}
