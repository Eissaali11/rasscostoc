/**
 * API Verification — uses server-side direct HTTP to avoid CORS/cookie issues
 * Runs on the production server itself, calling localhost:5000
 */
const http = require('http');
const https = require('https');

const TECHNICIAN_ID = '3a3a93f7-cf9a-4f90-8124-424a117e1957';

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const mod = opts.protocol === 'https:' ? https : http;
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('API VERIFICATION — Localhost direct call — ' + new Date().toISOString());
  console.log('='.repeat(70));

  // Step 1: Login to get JWT Token
  console.log('\n[A] LOGIN AS ADMIN');
  const loginPayload = JSON.stringify({ username: 'admin', password: 'admin123' });
  const loginRes = await request({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginPayload.length },
  }, loginPayload);

  console.log(`Login status: ${loginRes.status}`);
  
  let adminToken = '';
  if (loginRes.body && loginRes.body.token) {
    adminToken = loginRes.body.token;
    console.log('Admin Token obtained ✓');
  } else {
    console.log('⚠ No token found in login response body:', JSON.stringify(loginRes.body));
  }

  // Step 2: Call serialized-items endpoint as admin
  console.log('\n[B] GET /api/technicians/:id/serialized-items');
  const serRes = await request({
    hostname: 'localhost', port: 5000,
    path: `/api/technicians/${TECHNICIAN_ID}/serialized-items`,
    method: 'GET',
    headers: { 
      'Authorization': `Bearer ${adminToken}`, 
      'Accept': 'application/json' 
    },
  });

  console.log(`HTTP Status: ${serRes.status}`);
  if (Array.isArray(serRes.body)) {
    console.log(`Total items returned: ${serRes.body.length}`);
    const devices = serRes.body.filter(i => i.itemTypeCategory === 'devices');
    const sims = serRes.body.filter(i => i.itemTypeCategory === 'sim');
    console.log(`  → Devices (category=devices): ${devices.length}`);
    console.log(`  → SIM cards (category=sim): ${sims.length}`);
    console.log('\nFull response:');
    console.log(JSON.stringify(serRes.body, null, 2));
  } else {
    console.log('Response:', JSON.stringify(serRes.body));
  }

  // Step 3: Call my-serialized-custody (the public endpoint)
  console.log('\n[C] GET /api/serialized-custody/:id');
  const custRes = await request({
    hostname: 'localhost', port: 5000,
    path: `/api/serialized-custody/${TECHNICIAN_ID}`,
    method: 'GET',
    headers: { 
      'Authorization': `Bearer ${adminToken}`, 
      'Accept': 'application/json' 
    },
  });
  console.log(`HTTP Status: ${custRes.status}`);
  if (Array.isArray(custRes.body)) {
    console.log(`Items: ${custRes.body.length}`);
    console.log(JSON.stringify(custRes.body, null, 2));
  } else {
    console.log('Response:', JSON.stringify(custRes.body));
  }

  // Step 4: Try as technician login
  console.log('\n[D] LOGIN AS TECHNICIAN (to test /api/my-serialized-custody)');
  
  // First get the technician's username from DB
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const techUser = await pool.query(`
    SELECT u.username, u.id FROM users u WHERE u.id = $1 LIMIT 1
  `, [TECHNICIAN_ID]);
  await pool.end();
  
  if (techUser.rows.length > 0) {
    const techUsername = techUser.rows[0].username;
    console.log(`Technician username: ${techUsername}`);
    
    const techLoginPayload = JSON.stringify({ username: techUsername, password: 'admin123' });
    const techLoginRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': techLoginPayload.length },
    }, techLoginPayload);
    
    console.log(`Tech login status: ${techLoginRes.status}`);
    
    let techToken = '';
    if (techLoginRes.body && techLoginRes.body.token) {
      techToken = techLoginRes.body.token;
      console.log('Technician Token obtained ✓');
      
      // Call my-serialized-custody as the technician
      const myCustRes = await request({
        hostname: 'localhost', port: 5000,
        path: '/api/my-serialized-custody',
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${techToken}`, 
          'Accept': 'application/json' 
        },
      });
      console.log(`GET /api/my-serialized-custody → ${myCustRes.status}`);
      if (Array.isArray(myCustRes.body)) {
        console.log(`My custody items: ${myCustRes.body.length}`);
        console.log(JSON.stringify(myCustRes.body, null, 2));
      } else {
        console.log(JSON.stringify(myCustRes.body));
      }
    } else {
      console.log('Could not obtain tech token:', JSON.stringify(techLoginRes.body));
    }
  } else {
    console.log('Technician user not found in users table');
  }

  // Step 5: Check health
  console.log('\n[E] PRODUCTION HEALTH');
  const buildRes = await request({
    hostname: 'localhost', port: 5000, path: '/api/health', method: 'GET',
  });
  console.log(`Health: ${JSON.stringify(buildRes.body)}`);

  console.log('\n' + '='.repeat(70));
  console.log('API VERIFICATION COMPLETE');
  console.log('='.repeat(70));
}

main().catch(e => { console.error('ERROR:', e.message, e.stack); process.exit(1); });
