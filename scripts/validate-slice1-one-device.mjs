/**
 * LOCAL ONLY — Slice 1 single-device operational validation.
 * No commit / push / deploy.
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "_slice1-validation-report.json");

function pdfWithText(lines) {
  // Minimal single-page PDF with a text content stream (pdf-parse readable).
  const textOps = lines
    .map((line, i) => `BT /F1 12 Tf 50 ${750 - i * 18} Td (${line.replace(/[()\\]/g, "")}) Tj ET`)
    .join("\n");
  const stream = textOps + "\n";
  const objects = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n",
  );
  objects.push(
    `4 0 obj<< /Length ${Buffer.byteLength(stream)} >>stream\n${stream}endstream\nendobj\n`,
  );
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");

  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body));
    body += obj;
  }
  const xrefStart = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body, "utf8");
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`login failed ${res.status}: ${JSON.stringify(data)}`);
  const token = data.token || data.accessToken || data.access_token;
  if (!token) throw new Error(`no token in login response: ${JSON.stringify(data)}`);
  return { token, user: data.user };
}

async function main() {
  const report = {
    scope: "LOCAL SLICE 1 — single device only",
    startedAt: new Date().toISOString(),
    finalResult: "FAIL",
    steps: {},
    browserErrors: "N/A (API-driven validation)",
    serverErrors: [],
  };

  // 1) health
  const health = await fetch(`${BASE}/ai-review`).then((r) => r.status).catch((e) => e.message);
  report.steps.server = { ok: health === 200 || health === 304 || Number(health) < 500, health };

  // 2) login
  const { token, user } = await login();
  report.steps.login = { ok: true, role: user?.role, username: user?.username };

  const dbUrl =
    process.env.DATABASE_URL || process.env.OPS_DB_URL_NULIP_INVENTORY;
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();

  // Prefer open/in-progress request + custody serials sharing same technician
  const { rows: custody } = await c.query(`
    SELECT i.serial_number, i.status, i.current_owner_id, u.full_name, u.username,
           u.technician_code, it.category, it.name_ar
    FROM items i
    JOIN users u ON u.id = i.current_owner_id
    JOIN item_types it ON it.id = i.item_type_id
    WHERE i.status IN ('RECEIVED_BY_TECHNICIAN','IN_TRANSIT_CUSTODY','IN_TRANSIT')
      AND i.current_owner_id IS NOT NULL
    ORDER BY i.updated_at DESC NULLS LAST
    LIMIT 50
  `);

  const sims = custody.filter(
    (r) => String(r.serial_number).startsWith("89") || String(r.category || "").toUpperCase().includes("SIM"),
  );
  const devicesOnly = custody.filter(
    (r) =>
      !String(r.serial_number).startsWith("89") &&
      !String(r.category || "").toUpperCase().includes("SIM"),
  );
  let device = devicesOnly[0] || custody[0];
  let sim =
    sims.find((r) => r.current_owner_id === device?.current_owner_id) ||
    null;
  // Prefer a tech that owns both a device and a SIM
  for (const d of devicesOnly) {
    const pair = sims.find((s) => s.current_owner_id === d.current_owner_id);
    if (pair) {
      device = d;
      sim = pair;
      break;
    }
  }

  // Always create a fresh request so InventorySubscriber idempotency (per request) is clean
  const createRes = await fetch(`${BASE}/api/courier/requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tid: `TV${Date.now().toString().slice(-8)}`,
      terminalId: `TERM${Date.now().toString().slice(-6)}`,
      customerName: "Slice1 Local Validation",
      city: "RIYADH",
      tecName: device.full_name,
    }),
  });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !(created.id || created.request?.id)) {
    report.steps.fixtureData = {
      ok: false,
      reason: "Could not create fresh open request",
      createStatus: createRes.status,
      created,
    };
    report.finalResult = "FAIL";
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await c.end();
    process.exit(1);
  }
  const request = {
    id: created.id || created.request?.id,
    tid: created.tid || created.request?.tid,
    terminal_id: created.terminalId || created.request?.terminalId,
    installation_status: null,
  };
  report.steps.createdRequest = request;

  if (!device || !request) {
    report.steps.fixtureData = {
      ok: false,
      reason: "No local custody serial and/or open request found",
      custodyCount: custody.length,
      requestCount: reqs.length,
    };
    report.finalResult = "FAIL";
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await c.end();
    process.exit(1);
  }

  const sn = device.serial_number;
  const simSerial = sim?.serial_number || null;
  const tid = request.tid || request.terminal_id || `TV${String(request.id)}`;

  // Before counts
  const beforeCount = await c.query(
    `SELECT count(*)::int AS n FROM items WHERE current_owner_id = $1 AND status IN ('RECEIVED_BY_TECHNICIAN','IN_TRANSIT_CUSTODY','IN_TRANSIT')`,
    [device.current_owner_id],
  );
  const beforeDevice = await c.query(
    `SELECT status, current_owner_id FROM items WHERE serial_number = $1 LIMIT 1`,
    [sn],
  );
  const beforeSim = simSerial
    ? await c.query(`SELECT status, current_owner_id FROM items WHERE serial_number = $1 LIMIT 1`, [
        simSerial,
      ])
    : { rows: [] };

  report.steps.before = {
    requestId: request.id,
    requestStatus: request.installation_status ?? null,
    technicianName: device.full_name,
    technicianUsername: device.username,
    technicianCode: device.technician_code,
    techOwnerId: device.current_owner_id,
    inventoryCount: beforeCount.rows[0]?.n,
    sn,
    sim: simSerial,
    tid,
    deviceCustody: beforeDevice.rows[0],
    simCustody: beforeSim.rows[0] || null,
  };

  // 3) create + upload PDF — only include real SIM so CustodyGuard can pass
  const pdfLines = [
    "Installation Report",
    `TID: ${tid}`,
    `S/N: ${sn}`,
    `Serial Number: ${sn}`,
    "Date: 07/14/2026",
    "Time: 01:00 PM",
    "Retailer Name: Local Validation Merchant",
  ];
  if (simSerial) {
    pdfLines.splice(3, 0, `ICCID: ${simSerial}`);
  }
  const pdfBuf = pdfWithText(pdfLines);
  const pdfPath = path.join(__dirname, "_slice1-one-device.pdf");
  fs.writeFileSync(pdfPath, pdfBuf);

  const form = new FormData();
  form.append("file", new Blob([pdfBuf], { type: "application/pdf" }), "slice1-one-device.pdf");

  const uploadRes = await fetch(`${BASE}/api/courier/pdf/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const uploadBody = await uploadRes.json().catch(() => ({}));
  report.steps.upload = {
    status: uploadRes.status,
    ok: uploadRes.ok,
    pdfId: uploadBody.id,
    extraction_source: uploadBody.extraction_source,
    devices: uploadBody.devices || uploadBody.fields?.devices,
    overallConfidence: uploadBody.overallConfidence,
    bodyPreview: uploadBody,
  };

  if (!uploadRes.ok || !uploadBody.id) {
    report.finalResult = "FAIL";
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await c.end();
    process.exit(1);
  }

  const pdfId = uploadBody.id;
  const uploadedDevices = uploadBody.devices || uploadBody.fields?.devices || [];
  if (!Array.isArray(uploadedDevices) || uploadedDevices.length === 0) {
    report.finalResult = "FAIL";
    report.steps.extractionGate = {
      ok: false,
      reason: "Upload returned zero device cards — cannot continue operational path",
    };
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await c.end();
    process.exit(1);
  }

  // Prefer extracted values for the rest of the path
  const extractedSn = uploadedDevices[0]?.sn || sn;
  const extractedSim = uploadedDevices[0]?.sim_serial || simSerial;
  const extractedTid = uploadedDevices[0]?.tid || tid;

  // 4) GET report
  const getRes = await fetch(`${BASE}/api/courier/pdf/${pdfId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const getBody = await getRes.json();
  const devices = getBody.extractedJson?.devices || [];
  report.steps.reviewGet = {
    status: getRes.status,
    deviceCardCount: devices.length,
    devices,
    extractedSn: devices[0]?.sn,
    extractedSim: devices[0]?.sim_serial,
    extractedTid: devices[0]?.tid,
    duplicateCards: devices.length > 1,
    fieldsEditableAssumption: true,
  };

  // 5) serial lookup
  const lookupRes = await fetch(`${BASE}/api/courier/serial-lookup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sn: extractedSn }),
  });
  const lookupBody = await lookupRes.json();
  report.steps.serialLookup = {
    status: lookupRes.status,
    found: lookupBody.found,
    technician: lookupBody.technician,
    message: lookupBody.message,
    custodyStatus: lookupBody.custodyStatus || lookupBody.item?.status,
    matchResult:
      lookupBody.found && lookupBody.technician
        ? "matched"
        : "needs_review",
  };

  // 6) complete ONCE using extracted card values
  const completePayload = {
    request_id: request.id,
    devices: [
      {
        sn: extractedSn,
        sim_serial: extractedSim,
        tid: extractedTid,
        technician_code:
          lookupBody.technician?.technicianCode ||
          lookupBody.technician?.username ||
          device.technician_code ||
          device.username,
        sales_technician: lookupBody.technician?.fullName || device.full_name,
      },
    ],
    deliveryDate: "2026-07-14",
    time: "13:00",
    paperRoll: "Yes",
  };

  const completeRes = await fetch(`${BASE}/api/courier/pdf/${pdfId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(completePayload),
  });
  const completeBody = await completeRes.json().catch(() => ({}));
  report.steps.complete = {
    status: completeRes.status,
    ok: completeRes.ok,
    body: completeBody,
  };

  // 7) second complete must fail / not double-deduct
  const complete2Res = await fetch(`${BASE}/api/courier/pdf/${pdfId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(completePayload),
  });
  const complete2Body = await complete2Res.json().catch(() => ({}));
  report.steps.completeIdempotency = {
    status: complete2Res.status,
    ok: complete2Res.ok,
    body: complete2Body,
    stoppedIfDuplicate: !complete2Res.ok,
  };

  // Wait for outbox inventory deduction (async)
  let afterDevice = { rows: [] };
  let afterSim = { rows: [] };
  let afterCount = { rows: [{ n: beforeCount.rows[0]?.n ?? 0 }] };
  let deducted = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    afterDevice = await c.query(
      `SELECT status, current_owner_id FROM items WHERE serial_number = $1 LIMIT 1`,
      [extractedSn],
    );
    afterSim = extractedSim
      ? await c.query(`SELECT status, current_owner_id FROM items WHERE serial_number = $1 LIMIT 1`, [
          extractedSim,
        ])
      : { rows: [] };
    afterCount = await c.query(
      `SELECT count(*)::int AS n FROM items WHERE current_owner_id = $1 AND status IN ('RECEIVED_BY_TECHNICIAN','IN_TRANSIT_CUSTODY','IN_TRANSIT')`,
      [device.current_owner_id],
    );
    deducted =
      afterDevice.rows[0]?.status === "DELIVERED" ||
      afterDevice.rows[0]?.current_owner_id == null;
    if (deducted) break;
  }
  const exec = await c.query(
    `SELECT request_id, sn, sim_serial, installation_status, sales_technician, technician_code, version
     FROM courier_executions WHERE request_id = $1 LIMIT 1`,
    [request.id],
  );
  const pdfRow = await c.query(`SELECT id, status, request_id FROM courier_pdf_reports WHERE id = $1`, [
    pdfId,
  ]);

  report.steps.after = {
    inventoryCount: afterCount.rows[0]?.n,
    deviceCustody: afterDevice.rows[0],
    simCustody: afterSim.rows[0] || null,
    execution: exec.rows[0] || null,
    pdfReport: pdfRow.rows[0] || null,
    inventoryDelta: (beforeCount.rows[0]?.n ?? 0) - (afterCount.rows[0]?.n ?? 0),
    waitedForDeductionMs: deducted ? undefined : 5000,
  };

  // Verdict
  const cardOk =
    devices.length === 1 &&
    String(devices[0]?.sn || "") === String(extractedSn) &&
    (!extractedSim || String(devices[0]?.sim_serial || "") === String(extractedSim));
  const lookupOk = lookupBody.found === true && !!lookupBody.technician;
  const completeOk = completeRes.ok === true;
  const noDouble = complete2Res.ok === false;
  const execOk = !!exec.rows[0];
  const deductOk = deducted;

  // Hard stop condition: if inventory somehow went negative/odd we still report.
  if (cardOk && lookupOk && completeOk && noDouble && execOk && deductOk) {
    report.finalResult = "PASS";
  } else if (completeOk && cardOk && noDouble && execOk) {
    report.finalResult = "CONDITIONAL";
  } else {
    report.finalResult = "FAIL";
  }

  report.endedAt = new Date().toISOString();
  report.summary = {
    pdfId,
    extracted: {
      sn: devices[0]?.sn,
      sim: devices[0]?.sim_serial,
      tid: devices[0]?.tid,
    },
    technicianMatched: lookupBody.technician?.fullName || null,
    matchResult: report.steps.serialLookup.matchResult,
    completionApiStatus: completeRes.status,
    executionCreated: execOk,
    custodyBefore: report.steps.before.inventoryCount,
    custodyAfter: report.steps.after.inventoryCount,
    deviceStatusAfter: afterDevice.rows[0]?.status || null,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await c.end();
  if (report.finalResult === "FAIL") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
