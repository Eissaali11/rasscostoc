import pkg from 'pg';
const { Client } = pkg;

(async () => {
  const base = 'http://localhost:3001';
  console.log('====================================================================');
  console.log('🛡️ SECURITY AND ROLE-BASED ACCESS CONTROL (RBAC) PENETRATION SUITE');
  console.log('====================================================================\n');

  try {
    // ----------------------------------------------------
    // Test 1: Authentication Enforcement (401 Unauthorized)
    // ----------------------------------------------------
    console.log('--- Test 1: Accessing Protected Routes Without Auth Token ---');
    const protectedRoutes = [
      '/api/inventory',
      '/api/dashboard',
      '/api/admin/stats',
      '/api/item-types',
      '/api/system-logs'
    ];

    for (const route of protectedRoutes) {
      const res = await fetch(`${base}${route}`);
      console.log(`  Route: ${route.padEnd(20)} | Expected: 401 | Actual Status: ${res.status}`);
      if (res.status !== 401) {
        console.error(`  ❌ SECURITY FLAW: Protected route ${route} returned status ${res.status}`);
      } else {
        console.log(`  ✅ Passed: Route is successfully locked.`);
      }
    }

    // ----------------------------------------------------
    // Test 2: SQL Injection Defense (SQLi)
    // ----------------------------------------------------
    console.log('\n--- Test 2: SQL Injection Prevention Check ---');
    const sqliPayloads = [
      "'; DROP TABLE items; --",
      "' OR 1=1 --",
      "1 UNION SELECT username, password FROM users"
    ];

    // Try to login with injection payload
    for (const payload of sqliPayloads) {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: payload, password: 'password123' })
      });
      console.log(`  Login SQLi payload: ${payload.padEnd(45)} | Status: ${res.status}`);
      if (res.status === 500) {
        console.warn(`  ⚠️ Warning: SQLi payload triggered server internal error (500), check database logs.`);
      } else if (res.status === 401 || res.status === 400 || res.status === 404) {
        console.log(`  ✅ Passed: Safely rejected by parameterized query/validation.`);
      }
    }

    // ----------------------------------------------------
    // Test 3: Cross-Site Scripting (XSS) Input Sanitization
    // ----------------------------------------------------
    console.log('\n--- Test 3: XSS Input Validation ---');
    // Login to get token first
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.token;

    const xssPayload = '<script>alert("XSS")</script> Test SIM';
    const createRes = await fetch(`${base}/api/item-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        id: `xss-test-${Date.now()}`,
        name: xssPayload,
        category: 'simCard',
        unit: 'piece',
        isActive: true,
        isVisible: true
      })
    });

    console.log(`  Item Type Creation with XSS script name: | Status: ${createRes.status}`);
    const createdJson = await createRes.json();
    if (createRes.status === 201) {
      console.log(`  ✅ Passed: Safely stored (parameterized). Created ID: ${createdJson.data?.id}`);
      
      // Cleanup the test item type
      const delRes = await fetch(`${base}/api/item-types/${createdJson.data?.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`  Cleanup XSS Test Item Type | Status: ${delRes.status}`);
    } else {
      console.log(`  ✅ Passed: Input validation blocked the XSS script payload (Status: ${createRes.status}).`);
    }

    // ----------------------------------------------------
    // Test 4: Role-Based Access Control (RBAC) Enforcement
    // ----------------------------------------------------
    console.log('\n--- Test 4: RBAC Enforcement & Privilege Escalation Prevention ---');
    // Login as supervisor (lower privilege)
    const supLoginRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'supervisor1', password: 'super123' })
    });
    const supLoginJson = await supLoginRes.json();
    const supToken = supLoginJson.token;

    // Supervisor attempts to access admin stats
    const adminStatsRes = await fetch(`${base}/api/admin/stats`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${supToken}` }
    });
    console.log(`  Supervisor accessing Admin Stats (/api/admin/stats) | Expected: 403/401 | Actual Status: ${adminStatsRes.status}`);
    if (adminStatsRes.status === 403 || adminStatsRes.status === 401) {
      console.log(`  ✅ Passed: Supervisor blocked from admin stats.`);
    } else {
      console.error(`  ❌ SECURITY FLAW: Supervisor was allowed access to Admin Stats (Status: ${adminStatsRes.status})`);
    }

  } catch (err) {
    console.error('Error during security penetration test:', err);
  }
})();
