function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (token.startsWith('--')) {
      const [key, inlineValue] = token.slice(2).split('=');
      if (inlineValue !== undefined) {
        args[key] = inlineValue;
      } else {
        const next = argv[index + 1];
        if (next && !next.startsWith('-')) {
          args[key] = next;
          index += 1;
        } else {
          args[key] = true;
        }
      }
      continue;
    }

    if (token.startsWith('-')) {
      const key = token.slice(1);
      const next = argv[index + 1];
      if (next && !next.startsWith('-')) {
        args[key] = next;
        index += 1;
      } else {
        args[key] = true;
      }
    }
  }

  return args;
}

function printHelp() {
  console.log(`\nUsage:\n  npm run smoke:api -- [options]\n\nOptions:\n  --base-url, -b   API base URL (default: http://localhost:5000)\n  --user, -u       Username for login (default: admin)\n  --pass, -p       Password for login (default: admin123)\n  --skip-write, -r Read-only mode (skip create/update/delete checks)\n  --help, -h       Show this help\n\nEnv fallback:\n  SMOKE_BASE_URL, BASE_URL, SMOKE_USER, SMOKE_PASS, SMOKE_SKIP_WRITE\n`);
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

const cli = parseArgs(process.argv.slice(2));

if (cli.help) {
  printHelp();
  process.exit(0);
}

const BASE_URL = String(cli['base-url'] || cli.b || process.env.SMOKE_BASE_URL || process.env.BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const USERNAME = String(cli.user || cli.u || process.env.SMOKE_USER || 'admin');
const PASSWORD = String(cli.pass || cli.p || process.env.SMOKE_PASS || 'admin123');
const SKIP_WRITE = toBoolean(cli['skip-write'] || cli.r || process.env.SMOKE_SKIP_WRITE);

function log(title, value) {
  console.log(`[smoke] ${title}:`, value);
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data, text };
}

function expectStatus(result, allowed, label, failures) {
  const allowedList = Array.isArray(allowed) ? allowed : [allowed];
  if (!allowedList.includes(result.status)) {
    failures.push(`${label} expected [${allowedList.join(', ')}], got ${result.status}`);
  }
  log(label, result.status);
}

async function run() {
  const failures = [];

  try {
    log('Base URL', BASE_URL);
    log('User', USERNAME);
    log('Read-only mode', SKIP_WRITE ? 'enabled' : 'disabled');

    const health = await request('/api/health');
    expectStatus(health, 200, 'GET /api/health', failures);

    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    expectStatus(login, 200, 'POST /api/auth/login', failures);

    const token = login.data?.token;
    if (!token) {
      failures.push('Login response did not include token');
    }

    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    const me = await request('/api/auth/me', { headers: authHeaders });
    expectStatus(me, 200, 'GET /api/auth/me', failures);

    const inventory = await request('/api/inventory');
    expectStatus(inventory, 200, 'GET /api/inventory', failures);

    const dashboard = await request('/api/dashboard');
    expectStatus(dashboard, 200, 'GET /api/dashboard', failures);

    const adminStats = await request('/api/admin/stats', { headers: authHeaders });
    expectStatus(adminStats, 200, 'GET /api/admin/stats', failures);

    const itemTypes = await request('/api/item-types', { headers: authHeaders });
    expectStatus(itemTypes, 200, 'GET /api/item-types', failures);

    const systemLogs = await request('/api/system-logs', { headers: authHeaders });
    expectStatus(systemLogs, 200, 'GET /api/system-logs', failures);

    const transfers = await request('/api/warehouse-transfers', { headers: authHeaders });
    expectStatus(transfers, 200, 'GET /api/warehouse-transfers', failures);

    if (!SKIP_WRITE) {
      const smokeId = `smoke-${Date.now()}`;
      const createItemType = await request('/api/item-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          id: smokeId,
          nameAr: `نوع اختبار ${smokeId}`,
          nameEn: `Smoke Type ${smokeId}`,
          category: 'devices',
          unitsPerBox: 10,
          isActive: true,
          isVisible: true,
          sortOrder: 999,
        }),
      });
      expectStatus(createItemType, 201, 'POST /api/item-types (write)', failures);

      const updateItemType = await request(`/api/item-types/${smokeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ nameAr: `نوع اختبار معدل ${smokeId}`, unitsPerBox: 12 }),
      });
      expectStatus(updateItemType, 200, 'PATCH /api/item-types/:id', failures);

      const toggleActive = await request(`/api/item-types/${smokeId}/toggle-active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ isActive: false }),
      });
      expectStatus(toggleActive, 200, 'PATCH /api/item-types/:id/toggle-active', failures);

      const toggleVisibility = await request(`/api/item-types/${smokeId}/toggle-visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ isVisible: false }),
      });
      expectStatus(toggleVisibility, 200, 'PATCH /api/item-types/:id/toggle-visibility', failures);

      const deleteItemType = await request(`/api/item-types/${smokeId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      expectStatus(deleteItemType, 200, 'DELETE /api/item-types/:id (rollback)', failures);

      const invalidTransfer = await request('/api/warehouse-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({}),
      });
      expectStatus(invalidTransfer, [400, 403], 'POST /api/warehouse-transfers invalid payload', failures);

      const fakeTransferUpdate = await request('/api/warehouse-transfers/non-existent-id/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status: 'approved' }),
      });
      expectStatus(fakeTransferUpdate, [400, 404], 'PATCH /api/warehouse-transfers/:id/status fake id', failures);
    }

    if (failures.length > 0) {
      console.error('\n[smoke] FAILED checks:');
      failures.forEach((f) => console.error(`- ${f}`));
      return false;
    }

    console.log('\n[smoke] All checks passed ✅');
    return true;
  } catch (error) {
    console.error('[smoke] Fatal error:', error);
    return false;
  }
}

run()
  .then((ok) => {
    if (!ok) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error('[smoke] Unhandled fatal error:', error);
    process.exitCode = 1;
  });
