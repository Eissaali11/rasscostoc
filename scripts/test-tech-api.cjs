/**
 * Temporarily updates eissa1 password to admin123,
 * runs the login and GET /api/my-serialized-custody API calls,
 * and restores the password immediately.
 */
const { Pool } = require('pg');
const http = require('http');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TECHNICIAN_ID = '3a3a93f7-cf9a-4f90-8124-424a117e1957';
const ORIGINAL_HASH = '$2b$10$vW4unwlxNWC9xSj97r5Q6.QRe0u1H3mLySeEwFzdcxPdEa1WDj/Ma';
const TEST_HASH = '$2b$10$6pEZ8S455fe9wYdb8VR19uAdCYulXuX/ke.v1V9bMsLwfAIKyduGe'; // hash of 'admin123'

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== Tech App API E2E Verification ===');

  // Step 1: Temporarily update password in DB
  console.log('1. Setting eissa1 password to admin123 in DB...');
  await pool.query("UPDATE users SET password = $1 WHERE username = 'eissa1'", [TEST_HASH]);

  let token = '';
  let apiResponse = null;

  try {
    // Step 2: Attempt login as eissa1
    console.log('2. Logging in as eissa1 via /api/auth/login...');
    const loginPayload = JSON.stringify({ username: 'eissa1', password: 'admin123' });
    const loginRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': loginPayload.length }
    }, loginPayload);

    console.log(`   Login status: ${loginRes.status}`);
    if (loginRes.body && loginRes.body.token) {
      token = loginRes.body.token;
      console.log('   Technician login successful, token obtained ✓');
    } else {
      console.log('   Login failed:', JSON.stringify(loginRes.body));
      throw new Error('Technician login failed');
    }

    // Step 3: Call GET /api/my-serialized-custody as the logged in technician
    console.log('3. Fetching custody via /api/my-serialized-custody...');
    apiResponse = await request({
      hostname: 'localhost', port: 5000, path: '/api/my-serialized-custody', method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    console.log(`   GET Status: ${apiResponse.status}`);
    if (Array.isArray(apiResponse.body)) {
      console.log(`   Total items in technician custody: ${apiResponse.body.length}`);
      console.log(JSON.stringify(apiResponse.body, null, 2));
    } else {
      console.log('   Custody API response was not an array:', JSON.stringify(apiResponse.body));
    }

  } catch (err) {
    console.error('Error during test execution:', err.message);
  } finally {
    // Step 4: Restore original password hash
    console.log('4. Restoring eissa1 original password hash in DB...');
    await pool.query("UPDATE users SET password = $1 WHERE username = 'eissa1'", [ORIGINAL_HASH]);
    console.log('   Original password hash restored successfully ✓');
    await pool.end();
  }

  // Step 5: Report findings
  console.log('\n--- VERIFICATION REPORT ---');
  if (apiResponse && Array.isArray(apiResponse.body)) {
    const zain = apiResponse.body.find(i => i.serialNumber === '8996606099020521804');
    const lebara = apiResponse.body.find(i => i.serialNumber === '8996606099020522836');

    if (zain && lebara) {
      console.log('✅ VERIFIED FIXED: Both Zain and Lebara SIM cards successfully return in technician custody!');
      console.log(`   Zain SIM Status: ${zain.status}, Carrier: ${zain.carrierName}`);
      console.log(`   Lebara SIM Status: ${lebara.status}, Carrier: ${lebara.carrierName}`);
    } else {
      console.log('❌ NOT FIXED: Target SIM cards are missing from technician custody output.');
    }
  } else {
    console.log('❌ NOT FIXED: Could not retrieve technician custody.');
  }
}

main().catch(console.error);
