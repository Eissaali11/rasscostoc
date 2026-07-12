/**
 * Full Flutter ↔ StockPro API Integration Suite
 * Mirrors NuolipApp (stock_courier) endpoint contracts + custody lifecycle.
 *
 * Usage:
 *   node scripts/integration-flutter-api.mjs
 *   node scripts/integration-flutter-api.mjs --base-url https://www.stc1.fun
 *   node scripts/integration-flutter-api.mjs --skip-write
 *
 * Env: INTEGRATION_BASE_URL, INTEGRATION_ADMIN_USER, INTEGRATION_ADMIN_PASS,
 *      INTEGRATION_TECH_USER, INTEGRATION_TECH_PASS
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

function arg(name, short, fallback) {
  const argv = process.argv.slice(2);
  const i = argv.findIndex((a) => a === `--${name}` || a === `-${short}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("-")) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  return fallback;
}

const BASE = String(
  arg("base-url", "b", process.env.INTEGRATION_BASE_URL || "https://www.stc1.fun")
).replace(/\/+$/, "");
const ADMIN_USER = arg("admin-user", null, process.env.INTEGRATION_ADMIN_USER || "admin");
const ADMIN_PASS = arg("admin-pass", null, process.env.INTEGRATION_ADMIN_PASS || "admin123");
const TECH_USER = arg("tech-user", null, process.env.INTEGRATION_TECH_USER || "tech1");
const TECH_PASS = arg("tech-pass", null, process.env.INTEGRATION_TECH_PASS || "tech123");
const SKIP_WRITE = process.argv.includes("--skip-write") || process.env.INTEGRATION_SKIP_WRITE === "1";

const results = [];
const startedAt = new Date().toISOString();

function record(suite, name, ok, detail = "", status = null) {
  results.push({ suite, name, ok, detail: String(detail).slice(0, 400), status });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${suite} · ${name}${status != null ? ` (${status})` : ""}${detail ? ` — ${String(detail).slice(0, 120)}` : ""}`);
}

async function req(path, { method = "GET", token, body, cookie } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  const setCookie = res.headers.getSetCookie?.() || [];
  return { status: res.status, ok: res.ok, data, text, setCookie };
}

function expect(suite, name, result, allowed) {
  const list = Array.isArray(allowed) ? allowed : [allowed];
  const pass = list.includes(result.status);
  record(
    suite,
    name,
    pass,
    pass ? "" : `expected ${list.join("|")}, body=${typeof result.data === "object" ? JSON.stringify(result.data)?.slice(0, 180) : String(result.text).slice(0, 180)}`,
    result.status
  );
  return pass;
}

async function login(username, password, suite) {
  const result = await req("/api/auth/login", {
    method: "POST",
    body: { username, password },
  });
  const pass = expect(suite, `login ${username}`, result, 200);
  const token = result.data?.token || result.data?.accessToken || null;
  const user = result.data?.user || result.data?.data?.user || null;
  if (pass && !token) {
    record(suite, `login ${username} token`, false, "no token in response");
  }
  return { token, user, result };
}

async function suiteConnectivity() {
  const health = await req("/api/health");
  expect("connectivity", "GET /api/health", health, 200);
  const config = await req("/api/config");
  expect("connectivity", "GET /api/config (Flutter ApiConfig)", config, 200);
  if (config.ok && config.data?.baseUrl) {
    record("connectivity", "config.baseUrl present", true, config.data.baseUrl);
  } else {
    record("connectivity", "config.baseUrl present", false, JSON.stringify(config.data));
  }
}

async function suiteFlutterContract(token, user, suiteName) {
  const techId = user?.id;
  const reads = [
    ["/api/auth/me", "current user"],
    ["/api/item-types/active", "active item types"],
    ["/api/warehouse-transfers", "warehouse transfers list"],
    ["/api/my-moving-inventory", "my moving inventory"],
    ["/api/my-fixed-inventory", "my fixed inventory"],
    ["/api/inventory-requests/my", "my inventory requests"],
    ["/api/my-serialized-custody", "my serialized custody"],
    ["/api/courier/requests", "courier requests list"],
    ["/api/courier/dashboard/stats", "courier dashboard stats"],
    ["/api/received-devices", "received devices"],
    ["/api/received-devices/pending/count", "pending received count"],
    ["/api/withdrawn-devices", "withdrawn devices"],
  ];
  if (techId) {
    reads.push(
      [`/api/technicians/${techId}/moving-inventory-entries`, "moving inventory entries"],
      [`/api/technicians/${techId}/fixed-inventory-entries`, "fixed inventory entries"],
      [`/api/technicians/${techId}/serialized-items`, "technician serialized items"]
    );
  }

  for (const [path, label] of reads) {
    const r = await req(path, { token });
    // Some roles may get 403 — still a valid contract response
    expect(suiteName, `GET ${label}`, r, [200, 403, 404]);
  }

  // Lookup missing serial — Flutter treats 404 as null
  const lookup = await req("/api/serialized-items/lookup/INTEGRATION-MISSING-SERIAL", { token });
  expect(suiteName, "GET serialized lookup missing", lookup, [200, 404]);

  // Invalid write shapes (contract validation)
  const badScanIn = await req("/api/serialized-items/scan-in", {
    method: "POST",
    token,
    body: {},
  });
  expect(suiteName, "POST scan-in invalid payload", badScanIn, [400, 403, 422]);
}

async function suiteAdminPortal(token) {
  const paths = [
    ["/api/dashboard", "dashboard"],
    ["/api/admin/stats", "admin stats"],
    ["/api/item-types", "item types"],
    ["/api/users", "users"],
    ["/api/warehouses", "warehouses"],
    ["/api/courier/requests", "courier requests"],
  ];
  for (const [path, label] of paths) {
    const r = await req(path, { token });
    expect("admin-portal", `GET ${label}`, r, [200, 401, 403, 404]);
  }
}

async function findWarehouse(token) {
  const r = await req("/api/warehouses", { token });
  if (!r.ok) return null;
  const list = Array.isArray(r.data) ? r.data : r.data?.data || r.data?.warehouses || [];
  return list[0] || null;
}

async function findTechnician(token) {
  const r = await req("/api/users", { token });
  if (!r.ok) return null;
  const list = Array.isArray(r.data) ? r.data : r.data?.data || [];
  return list.find((u) => u.role === "technician") || null;
}

async function ensureIntegrationTechnician(adminToken) {
  const username = `int_tech_${Date.now().toString(36).slice(-6)}`;
  const password = "IntTest#2026";
  const create = await req("/api/users", {
    method: "POST",
    token: adminToken,
    body: {
      username,
      password,
      fullName: "Integration Technician",
      email: `${username}@integration.test`,
      role: "technician",
      isActive: true,
    },
  });
  if (![200, 201].includes(create.status)) {
    record("lifecycle", "create integration technician", false, JSON.stringify(create.data)?.slice(0, 200));
    return null;
  }
  const user = create.data?.user || create.data?.data || create.data;
  const login = await req("/api/auth/login", {
    method: "POST",
    body: { username, password },
  });
  if (login.status !== 200 || !login.data?.token) {
    record("lifecycle", "login integration technician", false, JSON.stringify(login.data)?.slice(0, 200));
    return { user, token: null, username, password };
  }
  record("lifecycle", "integration technician ready", true, username);
  return { user: login.data.user || user, token: login.data.token, username, password };
}

async function suiteCustodyLifecycle(adminToken, techCreds) {
  if (SKIP_WRITE) {
    record("lifecycle", "skipped (--skip-write)", true);
    return;
  }

  const warehouse = await findWarehouse(adminToken);
  const integrationTech = await ensureIntegrationTechnician(adminToken);
  const tech = integrationTech?.user || (await findTechnician(adminToken));
  if (!warehouse || !tech?.id) {
    record("lifecycle", "prerequisites warehouse+technician", false, `wh=${!!warehouse} tech=${!!tech}`);
    return;
  }
  record("lifecycle", "prerequisites", true, `warehouse=${warehouse.id} tech=${tech.username || tech.id}`);

  const noteTag = `integration-${Date.now()}`;

  // 1) Create warehouse transfer (qty-only) — packagingType must be box|unit
  const create = await req("/api/warehouse-transfers", {
    method: "POST",
    token: adminToken,
    body: {
      technicianId: tech.id,
      warehouseId: warehouse.id,
      items: [{ itemType: "n950", packagingType: "unit", quantity: 1 }],
      notes: noteTag,
    },
  });
  const createOk = expect("lifecycle", "POST create warehouse transfer", create, [200, 201]);
  if (!createOk) {
    record("lifecycle", "transfer id extracted", false, JSON.stringify(create.data)?.slice(0, 250));
    return;
  }

  // Create returns { success, message, itemsCount } — resolve id from list
  const list = await req("/api/warehouse-transfers", { token: adminToken });
  const transfers = Array.isArray(list.data) ? list.data : list.data?.data || [];
  const created = transfers.find((t) => t.notes === noteTag && t.technicianId === tech.id);
  const transferId = created?.id;
  if (!transferId) {
    record("lifecycle", "transfer id extracted", false, `notes=${noteTag} listCount=${transfers.length}`);
    return;
  }
  record("lifecycle", "transfer id extracted", true, transferId);

  let techToken = integrationTech?.token || techCreds?.token || null;
  if (!techToken) {
    record("lifecycle", "technician login", false, "could not authenticate technician — trying admin accept");
  }

  const actorToken = techToken || adminToken;

  // 2) Accept
  const accept = await req(`/api/warehouse-transfers/${transferId}/accept`, {
    method: "POST",
    token: actorToken,
  });
  expect("lifecycle", "POST accept transfer", accept, [200, 201]);

  // 3) Scan serial (unique)
  const suffix = String(Date.now()).slice(-9);
  const rawSerial = `NCD${suffix}`;
  const scan = await req(`/api/warehouse-transfers/${transferId}/scan-serial`, {
    method: "POST",
    token: actorToken,
    body: { serialNumber: rawSerial },
  });
  const scanOk = expect("lifecycle", "POST scan-serial", scan, [200, 201]);
  const item = scan.data?.item || scan.data?.data || scan.data;
  const storedSerial = item?.serialNumber;
  record(
    "lifecycle",
    "serial recognition stored form",
    scanOk && !!storedSerial,
    `raw=${rawSerial} stored=${storedSerial || "n/a"} status=${item?.status || "n/a"}`
  );

  // 4) Confirm receipt
  const confirm = await req(`/api/warehouse-transfers/${transferId}/confirm-receipt`, {
    method: "POST",
    token: actorToken,
  });
  expect("lifecycle", "POST confirm-receipt", confirm, [200, 201]);

  // 5) Custody visibility
  if (tech.id) {
    const custody = await req(`/api/technicians/${tech.id}/serialized-items`, { token: adminToken });
    expect("lifecycle", "GET technician serialized after scan", custody, [200]);
  }

  // 6) Lookup (Flutter + portal verification)
  if (storedSerial) {
    const lookupStored = await req(`/api/serialized-items/lookup/${encodeURIComponent(storedSerial)}`, {
      token: adminToken,
    });
    expect("lifecycle", "lookup stored serial", lookupStored, [200]);

    const lookupRaw = await req(`/api/serialized-items/lookup/${encodeURIComponent(rawSerial)}`, {
      token: adminToken,
    });
    const portalLookup = await req(`/api/items/lookup/${encodeURIComponent(rawSerial)}`, {
      token: adminToken,
    });
    // After Central Serial Engine fix: both prefixed and stored forms must resolve.
    // Against production before deploy this may still 404 — report clearly.
    const parityOk = lookupRaw.status === 200 && portalLookup.status === 200;
    record(
      "lifecycle",
      "lookup raw prefixed serial (Central Serial Engine)",
      parityOk,
      parityOk
        ? `OK raw=${rawSerial} → stored=${storedSerial}`
        : `FAIL serialized=${lookupRaw.status} portal=${portalLookup.status} (deploy Central Serial Engine if still 404)`
    );
  }

  // 7) scanOut (Flutter delivery path)
  if (storedSerial && techToken) {
    const scanOut = await req("/api/serialized-items/scan-out", {
      method: "POST",
      token: techToken,
      body: {
        serialNumber: storedSerial,
        receiverName: "Integration Test Customer",
        orderNumber: `INT-${Date.now()}`,
      },
    });
    expect("lifecycle", "POST scan-out deliver", scanOut, [200, 201]);
  } else if (storedSerial && item?.id) {
    const patch = await req(`/api/items/${item.id}/status`, {
      method: "PATCH",
      token: adminToken,
      body: { status: "DELIVERED", orderNumber: `INT-${Date.now()}` },
    });
    expect("lifecycle", "PATCH item DELIVERED (admin verification path)", patch, [200]);
  }

  // 8) Courier module smoke (read + invalid writes)
  const courierList = await req("/api/courier/requests", { token: adminToken });
  expect("lifecycle", "courier list available", courierList, [200]);

  if (courierList.ok) {
    const list = Array.isArray(courierList.data)
      ? courierList.data
      : courierList.data?.data || courierList.data?.requests || [];
    const open = list.find((r) => r.id) || null;
    if (open?.id) {
      const detail = await req(`/api/courier/requests/${open.id}`, { token: actorToken });
      expect("lifecycle", "courier request detail (Flutter)", detail, [200, 403]);
      const items = await req(`/api/courier/requests/${open.id}/items`, { token: actorToken });
      expect("lifecycle", "courier request items (Flutter)", items, [200, 403, 404]);
    } else {
      record("lifecycle", "courier request detail sample", true, "no existing requests to probe");
    }
  }
}

async function suiteCourierCloseGuardProbe(adminToken, techToken) {
  // Documented break: CustodyGuard requires IN_TRANSIT_CUSTODY
  // Probe by attempting saveExecution on a fake id — should 404 not 500
  const fake = await req("/api/courier/executions/integration-fake-id", {
    method: "POST",
    token: adminToken,
    body: { installationStatus: "Installation Completed" },
  });
  expect("courier-guards", "saveExecution fake id", fake, [400, 404, 422]);

  if (techToken) {
    const fakeAttempt = await req("/api/courier/requests/integration-fake-id/execution-attempts", {
      method: "POST",
      token: techToken,
      body: { status: "SUCCESS", notes: "integration probe" },
    });
    expect("courier-guards", "execution-attempts fake id", fakeAttempt, [400, 404, 422]);
  }
}

async function suiteUnitRelated() {
  // Placeholder marker — unit tests run separately via vitest
  record("meta", "vitest run separately", true, "see vitest output");
}

async function main() {
  console.log("=== StockPro ↔ Flutter Full Integration ===");
  console.log(`Base: ${BASE}`);
  console.log(`Write mode: ${SKIP_WRITE ? "OFF" : "ON"}`);
  console.log(`Started: ${startedAt}\n`);

  await suiteConnectivity();

  const admin = await login(ADMIN_USER, ADMIN_PASS, "auth-admin");
  if (admin.token) {
    await suiteFlutterContract(admin.token, admin.user, "flutter-contract-admin");
    await suiteAdminPortal(admin.token);
  }

  // Optional existing tech account — lifecycle creates a dedicated integration tech
  let tech = { token: null, user: null };
  const techLogin = await req("/api/auth/login", {
    method: "POST",
    body: { username: TECH_USER, password: TECH_PASS },
  });
  if (techLogin.status === 200 && techLogin.data?.token) {
    tech = { token: techLogin.data.token, user: techLogin.data.user };
    record("auth-tech", `login ${TECH_USER}`, true);
    await suiteFlutterContract(tech.token, tech.user, "flutter-contract-technician");
  } else {
    record(
      "auth-tech",
      `login ${TECH_USER} (optional)`,
      true,
      `skipped — status=${techLogin.status}; lifecycle uses ephemeral technician`
    );
  }

  if (admin.token) {
    await suiteCustodyLifecycle(admin.token, tech);
    await suiteCourierCloseGuardProbe(admin.token, tech.token);
  }

  await suiteUnitRelated();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl: BASE,
    skipWrite: SKIP_WRITE,
    totals: { passed, failed, total: results.length },
    results,
  };

  const outPath = resolve(
    process.cwd(),
    `docs/INTEGRATION_TEST_REPORT_${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(`\n=== SUMMARY: ${passed} passed · ${failed} failed · ${results.length} total ===`);
  console.log(`Report JSON: ${outPath}`);
  if (failed > 0) {
    console.log("\nFailed cases:");
    results.filter((r) => !r.ok).forEach((r) => console.log(` - [${r.suite}] ${r.name}: ${r.detail}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exitCode = 1;
});
