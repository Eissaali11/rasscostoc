/**
 * FINAL PRODUCTION VERIFICATION SCRIPT
 * Runs directly against the production database and API.
 * No assumptions. Evidence only.
 */
const { Pool } = require('pg');
const http = require('https');

const DB_URL = process.env.DATABASE_URL;
const TECHNICIAN_ID = '3a3a93f7-cf9a-4f90-8124-424a117e1957';
const API_BASE = 'https://stc1.fun';

const pool = new Pool({ connectionString: DB_URL, ssl: false });

function apiGet(path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      timeout: 10000,
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body), raw: body }); }
        catch { resolve({ status: res.statusCode, body: null, raw: body }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function apiPost(path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const payload = JSON.stringify(data);
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      timeout: 10000,
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body), raw: body }); }
        catch { resolve({ status: res.statusCode, body: null, raw: body }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  const client = await pool.connect();
  const results = {};

  try {
    console.log('\n' + '='.repeat(70));
    console.log('FINAL PRODUCTION VERIFICATION — ' + new Date().toISOString());
    console.log('='.repeat(70));

    // ───────────────────────────────────────────────────────────────────────
    // STEP 1: DATABASE VERIFICATION
    // ───────────────────────────────────────────────────────────────────────
    console.log('\n[1/6] DATABASE VERIFICATION');
    console.log('-'.repeat(50));

    // 1a. Check ALL items for this technician
    const techItems = await client.query(`
      SELECT 
        i.serial_number, i.status, i.item_type_id, i.carrier_name, 
        i.current_owner_id, i.created_at,
        it.category, it.name_ar, it.requires_serial
      FROM items i
      LEFT JOIN item_types it ON i.item_type_id = it.id
      WHERE i.current_owner_id = $1
      ORDER BY i.created_at DESC
    `, [TECHNICIAN_ID]);

    results.db_tech_items = techItems.rows;
    console.log(`Items owned by technician: ${techItems.rows.length}`);
    console.log(JSON.stringify(techItems.rows, null, 2));

    // 1b. Check for any remaining IN_TRANSIT_CUSTODY with an owner (the bug)
    const bugCheck = await client.query(`
      SELECT serial_number, status, item_type_id, carrier_name
      FROM items
      WHERE current_owner_id IS NOT NULL AND status = 'IN_TRANSIT_CUSTODY'
    `);
    results.db_bug_check = bugCheck.rows;
    console.log(`\n⚠ Remaining IN_TRANSIT_CUSTODY items (should be 0): ${bugCheck.rows.length}`);
    if (bugCheck.rows.length > 0) console.log(JSON.stringify(bugCheck.rows, null, 2));

    // 1c. Status distribution
    const statusDist = await client.query(`
      SELECT status, COUNT(*) as count FROM items GROUP BY status ORDER BY count DESC
    `);
    console.log('\nItems table status distribution:');
    console.table(statusDist.rows);

    // 1d. Recent inventory_transactions
    const recentTx = await client.query(`
      SELECT it.transaction_type, it.created_at, i.serial_number, i.item_type_id
      FROM inventory_transactions it
      JOIN items i ON it.item_id = i.id
      WHERE i.current_owner_id = $1
      ORDER BY it.created_at DESC
      LIMIT 10
    `, [TECHNICIAN_ID]);
    console.log('\nRecent inventory transactions for technician:');
    console.log(JSON.stringify(recentTx.rows, null, 2));

    // 1e. Item history logs
    const histLogs = await client.query(`
      SELECT ihl.from_status, ihl.to_status, ihl.changed_at, i.serial_number
      FROM item_history_logs ihl
      JOIN items i ON ihl.item_id = i.id
      WHERE i.current_owner_id = $1
      ORDER BY ihl.changed_at DESC
    `, [TECHNICIAN_ID]);
    console.log('\nItem history logs for technician:');
    console.log(JSON.stringify(histLogs.rows, null, 2));

    // ───────────────────────────────────────────────────────────────────────
    // STEP 2: API LOGIN (to get session cookie)
    // ───────────────────────────────────────────────────────────────────────
    console.log('\n[2/6] API LOGIN');
    console.log('-'.repeat(50));
    // Try logging in as admin to get session
    const loginRes = await apiPost('/api/auth/login', { username: 'admin', password: 'admin123' });
    console.log(`Login status: ${loginRes.status}`);
    let sessionCookie = null;
    if (loginRes.status === 200) {
      console.log('Login: SUCCESS');
      sessionCookie = loginRes.body && loginRes.body.token;
    } else {
      console.log('Login response:', loginRes.raw.substring(0, 200));
    }

    // ───────────────────────────────────────────────────────────────────────
    // STEP 3: TECHNICIAN SERIALIZED ITEMS API
    // ───────────────────────────────────────────────────────────────────────
    console.log('\n[3/6] TECHNICIAN SERIALIZED ITEMS API');
    console.log('-'.repeat(50));

    const apiRes = await apiGet(`/api/technicians/${TECHNICIAN_ID}/serialized-items`, sessionCookie);
    results.api_serialized = apiRes;
    console.log(`GET /api/technicians/${TECHNICIAN_ID}/serialized-items`);
    console.log(`HTTP Status: ${apiRes.status}`);
    
    if (apiRes.body !== null) {
      if (Array.isArray(apiRes.body)) {
        console.log(`Items returned: ${apiRes.body.length}`);
        const devices = apiRes.body.filter(i => i.itemTypeCategory === 'devices');
        const sims = apiRes.body.filter(i => i.itemTypeCategory === 'sim');
        console.log(`  → Devices: ${devices.length}`);
        console.log(`  → SIM cards: ${sims.length}`);
        console.log('Full response:');
        console.log(JSON.stringify(apiRes.body, null, 2));
      } else {
        console.log('Response (non-array):', JSON.stringify(apiRes.body, null, 2));
      }
    } else {
      console.log('Raw response:', apiRes.raw.substring(0, 500));
    }

    // ───────────────────────────────────────────────────────────────────────
    // STEP 4: MY-SERIALIZED-CUSTODY API  
    // ───────────────────────────────────────────────────────────────────────
    console.log('\n[4/6] CUSTODY API CHECK');
    console.log('-'.repeat(50));
    
    const custodyRes = await apiGet(`/api/serialized-custody/${TECHNICIAN_ID}`, sessionCookie);
    console.log(`GET /api/serialized-custody/${TECHNICIAN_ID} → ${custodyRes.status}`);
    if (Array.isArray(custodyRes.body)) {
      console.log(`Items: ${custodyRes.body.length}`);
      console.log(JSON.stringify(custodyRes.body, null, 2));
    }

    // ───────────────────────────────────────────────────────────────────────
    // STEP 5: PM2/APP LOGS CHECK (via DB timestamp probe)
    // ───────────────────────────────────────────────────────────────────────
    console.log('\n[5/6] PRODUCTION DB INTEGRITY CHECK');
    console.log('-'.repeat(50));

    // Check migration state  
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('Tables in production DB:');
    console.log(tables.rows.map(r => r.table_name).join(', '));

    // Check custody movements
    const custodyMvmt = await client.query(`
      SELECT cm.reason, cm.performed_at, i.serial_number, cm.to_owner_id
      FROM custody_movements cm
      JOIN items i ON cm.item_id = i.id
      WHERE cm.to_owner_id = $1
      ORDER BY cm.performed_at DESC
    `, [TECHNICIAN_ID]);
    console.log('\nCustody movements for technician:');
    console.log(JSON.stringify(custodyMvmt.rows, null, 2));

    // ───────────────────────────────────────────────────────────────────────
    // STEP 6: HEALTH CHECK
    // ───────────────────────────────────────────────────────────────────────
    console.log('\n[6/6] PRODUCTION API HEALTH');
    console.log('-'.repeat(50));
    const health = await apiGet('/api/health');
    console.log(`GET /api/health → ${health.status}`);
    console.log(JSON.stringify(health.body || health.raw, null, 2));

    // ───────────────────────────────────────────────────────────────────────
    // FINAL VERDICT
    // ───────────────────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(70));
    console.log('FINAL VERDICT');
    console.log('='.repeat(70));

    const techItemCount = results.db_tech_items.length;
    const receivedCount = results.db_tech_items.filter(i => i.status === 'RECEIVED_BY_TECHNICIAN').length;
    const transitCount = results.db_bug_check.length;
    const apiCount = Array.isArray(results.api_serialized.body) ? results.api_serialized.body.length : 'N/A (auth required)';

    console.log(`DB items owned by technician: ${techItemCount}`);
    console.log(`DB items with RECEIVED_BY_TECHNICIAN: ${receivedCount}`);
    console.log(`DB items still with IN_TRANSIT_CUSTODY (bug): ${transitCount}`);
    console.log(`API items returned: ${apiCount}`);

    let verdict;
    if (transitCount === 0 && techItemCount > 0 && receivedCount === techItemCount) {
      verdict = '✅ DB: VERIFIED FIXED';
    } else if (transitCount === 0 && techItemCount === 0) {
      verdict = '⚠ DB: NO ITEMS IN TECHNICIAN CUSTODY (may be expected)';
    } else {
      verdict = '❌ DB: ISSUE STILL EXISTS';
    }

    if (results.api_serialized.status === 401) {
      verdict += '\n⚠ API: 401 Unauthorized — needs valid session to verify';
    } else if (Array.isArray(results.api_serialized.body) && results.api_serialized.body.length === techItemCount) {
      verdict += '\n✅ API: Returns correct count matching DB';
    } else if (Array.isArray(results.api_serialized.body)) {
      verdict += `\n⚠ API: Returns ${results.api_serialized.body.length} but DB has ${techItemCount}`;
    }

    console.log('\n' + verdict);
    console.log('='.repeat(70));

  } finally {
    client.release();
    pool.end();
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
