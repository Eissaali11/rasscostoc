import fs from 'fs';
import path from 'path';

const PAGES_DIR = './apps/portal/src/pages';
const COMPONENTS_DIR = './apps/portal/src/components';

const arabicRegex = /[\u0600-\u06FF]+/g;
const tRegex = /\bt\s*\(\s*['"`]([^'"`]+)['"`]/g;

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let hardcodedLines = 0;
  let tCalls = 0;

  lines.forEach((line) => {
    // Exclude comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

    const hasArabic = arabicRegex.test(line);
    const hasT = line.includes('t(');

    if (hasArabic && !hasT) {
      hardcodedLines++;
    }
    
    // Count t() calls
    let match;
    tRegex.lastIndex = 0;
    while ((match = tRegex.exec(line)) !== null) {
      tCalls++;
    }
  });

  const total = hardcodedLines + tCalls;
  const percentage = total === 0 ? 100 : Math.round((tCalls / total) * 100);

  return {
    hardcoded: hardcodedLines,
    translated: tCalls,
    total,
    percentage
  };
}

const targetCategories = {
  'Dashboard': ['dashboard.tsx', 'courier/courier-dashboard.tsx', 'accounting-dashboard.tsx', 'fixed-inventory-dashboard.tsx'],
  'Inventory': ['my-fixed-inventory.tsx', 'my-moving-inventory.tsx', 'admin-inventory-overview.tsx', 'products-management.tsx', 'product-details.tsx', 'product-smart-add.tsx', 'technician-item-details.tsx'],
  'Warehouse': ['warehouses.tsx', 'warehouse-details.tsx', 'operation-details.tsx', 'transfer-details.tsx'],
  'Courier': [
    'courier/courier-ai-monitor.tsx', 'courier/courier-audit-log.tsx', 'courier/courier-export.tsx',
    'courier/courier-observability.tsx', 'courier/courier-pdf-review.tsx', 'courier/courier-pdf-upload.tsx',
    'courier/courier-raw-data.tsx', 'courier/courier-reports.tsx', 'courier/courier-request-detail.tsx',
    'courier/courier-requests.tsx', 'courier/courier-settings.tsx'
  ],
  'Users': ['users.tsx', 'admin.tsx', 'profile.tsx', 'employee-detailed-profile-template.tsx', 'employee-edit-profile-template.tsx'],
  'Reports': ['withdrawn-devices-all.tsx', 'withdrawn-devices-management.tsx', 'withdrawn-devices.tsx', 'system-logs.tsx', 'transaction-history.tsx'],
  'Settings': ['profile.tsx', 'courier/courier-settings.tsx'],
  'Verification': ['verification.tsx', 'ReceivedDevicesReview.tsx', 'ReceivedDevicesSubmit.tsx', 'ReceivedDeviceDetails.tsx', 'WithdrawnDeviceDetails.tsx'],
  'Notifications': ['notifications.tsx'],
  'Accounting': ['accounting-dashboard.tsx']
};

console.log('Category | Hardcoded Texts | Translated Texts | Completion %');
console.log('---|---|---|---');

Object.entries(targetCategories).forEach(([category, files]) => {
  let hardcoded = 0;
  let translated = 0;

  files.forEach((file) => {
    const fullPath = path.join(PAGES_DIR, file);
    if (fs.existsSync(fullPath)) {
      const stats = analyzeFile(fullPath);
      hardcoded += stats.hardcoded;
      translated += stats.translated;
    }
  });

  const total = hardcoded + translated;
  const percentage = total === 0 ? 100 : Math.round((translated / total) * 100);
  console.log(`${category} | ${hardcoded} | ${translated} | ${percentage}%`);
});
