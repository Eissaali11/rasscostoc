/**
 * Independent API Verification with JWT Signing
 * Signs a JWT using the local JWT_SECRET to act as the technician,
 * and calls the local API server directly on localhost:5000.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const TECHNICIAN_ID = '3a3a93f7-cf9a-4f90-8124-424a117e1957';

async function main() {
  console.log('=== JWT API Verification — Start ===');

  // 1. Get JWT_SECRET from .env
  const dotenvContent = fs.readFileSync('.env', 'utf8');
  const jwtSecretMatch = dotenvContent.match(/^JWT_SECRET=(.*)$/m);
  if (!jwtSecretMatch) {
    throw new Error('JWT_SECRET not found in .env');
  }
  const JWT_SECRET = jwtSecretMatch[1].trim();
  console.log('Successfully retrieved JWT_SECRET from .env');

  // 2. Sign JWT token for the technician
  const payload = {
    userId: TECHNICIAN_ID,
    role: 'technician',
    username: 'eissa1',
    permissions: []
  };
  
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  console.log('Generated local JWT token for technician:', token.substring(0, 30) + '...');

  // 3. Perform local request to GET /api/technicians/:id/serialized-items
  console.log(`\nCalling GET http://localhost:5000/api/technicians/${TECHNICIAN_ID}/serialized-items`);
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/technicians/${TECHNICIAN_ID}/serialized-items`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`HTTP Status Code: ${res.statusCode}`);
      try {
        const json = JSON.parse(body);
        console.log(`Successfully parsed JSON response. Array size: ${Array.isArray(json) ? json.length : 'Not an Array'}`);
        console.log('\nResponse Data:');
        console.log(JSON.stringify(json, null, 2));

        if (Array.isArray(json)) {
          // Check for Zain and Lebara SIMs in response
          const zainSim = json.find(item => item.serialNumber === '8996606099020521804');
          const lebaraSim = json.find(item => item.serialNumber === '8996606099020522836');

          console.log('\n--- TARGET ITEM CHECKS ---');
          if (zainSim) {
            console.log('✅ Zain SIM (8996606099020521804) IS present in API output.');
            console.log(`   Status: ${zainSim.status}, Carrier: ${zainSim.carrierName}, Category: ${zainSim.itemTypeCategory}`);
          } else {
            console.log('❌ Zain SIM (8996606099020521804) IS NOT present in API output.');
          }

          if (lebaraSim) {
            console.log('✅ Lebara SIM (8996606099020522836) IS present in API output.');
            console.log(`   Status: ${lebaraSim.status}, Carrier: ${lebaraSim.carrierName}, Category: ${lebaraSim.itemTypeCategory}`);
          } else {
            console.log('❌ Lebara SIM (8996606099020522836) IS NOT present in API output.');
          }
        }
      } catch (err) {
        console.log('Raw body (failed to parse JSON):', body);
      }
    });
  });

  req.on('error', (err) => {
    console.error('Request error:', err);
  });
  req.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
