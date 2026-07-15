const fs = require('fs');

// --- sidebar report ---
let s = fs.readFileSync('apps/portal/src/components/sidebar.tsx', 'utf8');
s = s.replaceAll('setLanguage', 'changeLanguage');

const oldReport = `    const reportContent = \`
تقرير المخزون - \${new Date().toLocaleDateString('ar-SA')}

إجمالي الأصناف: \${totalItems}
إجمالي الكميات: \${totalQuantity}
أصناف منخفضة المخزون: \${lowStockCount}
أصناف نافدة: \${outOfStockCount}

تفاصيل الأصناف:
\${inventory.map(item => 
  t('common.item_4190', { var_0: item.name, var_1: item.quantity, var_2: item.unit, var_3: item.status === 'available' ? t('common.item_7977_1') : item.status === 'low' ? t('common.item_7984') : t('common.item_6365') })
).join('\\n')}
    \`.trim();`;

const newReport = `    const reportContent = \`
\${t('inventory.inventory_report_dated', { date: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') })}

\${t('common.total_items_count', { count: totalItems })}
\${t('common.total_qty_count', { count: totalQuantity })}
\${t('common.low_stock_count', { count: lowStockCount })}
\${t('common.out_stock_count', { count: outOfStockCount })}

\${t('common.item_details_header')}
\${inventory.map(item => 
  t('common.item_4190', { var_0: item.name, var_1: item.quantity, var_2: item.unit, var_3: item.status === 'available' ? t('common.item_7977_1') : item.status === 'low' ? t('common.item_7984') : t('common.item_6365') })
).join('\\n')}
    \`.trim();`;

if (s.includes(oldReport)) {
  s = s.replace(oldReport, newReport);
  console.log('sidebar report replaced');
} else {
  console.log('sidebar report block not exact match, trying line patches');
  s = s.replace(/تقرير المخزون - \$\{new Date\(\)\.toLocaleDateString\('ar-SA'\)\}/,
    "${t('inventory.inventory_report_dated', { date: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') })}");
  s = s.replace(/إجمالي الأصناف: \$\{totalItems\}/, "${t('common.total_items_count', { count: totalItems })}");
  s = s.replace(/إجمالي الكميات: \$\{totalQuantity\}/, "${t('common.total_qty_count', { count: totalQuantity })}");
  s = s.replace(/أصناف منخفضة المخزون: \$\{lowStockCount\}/, "${t('common.low_stock_count', { count: lowStockCount })}");
  s = s.replace(/أصناف نافدة: \$\{outOfStockCount\}/, "${t('common.out_stock_count', { count: outOfStockCount })}");
  s = s.replace(/تفاصيل الأصناف:/, "${t('common.item_details_header')}");
}

s = s.replace(
  /link\.download = `تقرير_المخزون_\$\{new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]\}\.txt`/,
  "link.download = `${t('dashboard.report_filename')}${new Date().toISOString().split('T')[0]}.txt`"
);

fs.writeFileSync('apps/portal/src/components/sidebar.tsx', s);
console.log('sidebar arabic chars', (s.match(/[\u0600-\u06FF]/g) || []).length);

// locale keys
const path = require('path');
const root = 'apps/portal/src/i18n/locales';
function load(ns, lang) {
  return JSON.parse(fs.readFileSync(path.join(root, lang, ns + '.json'), 'utf8'));
}
function save(ns, lang, obj) {
  fs.writeFileSync(path.join(root, lang, ns + '.json'), JSON.stringify(obj, null, 2) + '\n');
}

const commonKeys = {
  total_items_count: { ar: 'إجمالي الأصناف: {{count}}', en: 'Total items: {{count}}' },
  total_qty_count: { ar: 'إجمالي الكميات: {{count}}', en: 'Total quantities: {{count}}' },
  low_stock_count: { ar: 'أصناف منخفضة المخزون: {{count}}', en: 'Low stock items: {{count}}' },
  out_stock_count: { ar: 'أصناف نافدة: {{count}}', en: 'Out of stock items: {{count}}' },
  item_details_header: { ar: 'تفاصيل الأصناف:', en: 'Item details:' },
};
const arC = load('common', 'ar');
const enC = load('common', 'en');
for (const [k, v] of Object.entries(commonKeys)) {
  arC[k] = v.ar;
  enC[k] = v.en;
}
save('common', 'ar', arC);
save('common', 'en', enC);

// --- queryClient ---
let q = fs.readFileSync('apps/portal/src/lib/queryClient.ts', 'utf8');
const helper = `
function getClientError(key: 'server_connection_failed' | 'html_instead_of_json'): string {
  const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('language') === 'en') ? 'en' : 'ar';
  const messages = {
    server_connection_failed: {
      ar: 'فشل الاتصال بالسيرفر. يرجى التحقق من الاتصال بالإنترنت أو الاتصال بالدعم الفني.',
      en: 'Failed to connect to the server. Please check your internet connection or contact support.',
    },
    html_instead_of_json: {
      ar: 'تم استلام HTML بدل JSON من السيرفر. تحقق من مسارات API أو إعادة تشغيل الخادم.',
      en: 'Received HTML instead of JSON from the server. Check API routes or restart the server.',
    },
  } as const;
  return messages[key][lang];
}
`;

if (!q.includes('getClientError')) {
  // insert after imports
  const importEnd = q.lastIndexOf('import ');
  const lineEnd = q.indexOf('\n', importEnd);
  q = q.slice(0, lineEnd + 1) + helper + q.slice(lineEnd + 1);
}

q = q.replace(
  /throw new Error\('فشل الاتصال بالسيرفر[^']*'\);/g,
  "throw new Error(getClientError('server_connection_failed'));"
);
q = q.replace(
  /throw new Error\("تم استلام HTML بدل JSON[^"]*"\);/g,
  'throw new Error(getClientError("html_instead_of_json"));'
);
fs.writeFileSync('apps/portal/src/lib/queryClient.ts', q);
console.log('queryClient done, arabic in messages only:', (q.match(/[\u0600-\u06FF]/g) || []).length);
