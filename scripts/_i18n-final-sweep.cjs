const fs = require('fs');
const path = require('path');

// --- Fix corrupted PDF bilingual maps ---
function fixPdf(file) {
  let s = fs.readFileSync(file, 'utf8');
  // Remove illegal hook
  s = s.replace(/import \{ useTranslation \} from ["']@\/lib\/language["'];\r?\n/, '');
  s = s.replace(/^\s*const \{ t \} = useTranslation\(\);\r?\n/gm, '');

  // Fix ar: t('...') → pull Arabic from locale if possible, else leave key
  // Better: read verification/reports locales and reverse-map
  const arVer = JSON.parse(fs.readFileSync('apps/portal/src/i18n/locales/ar/verification.json', 'utf8'));
  const arRep = JSON.parse(fs.readFileSync('apps/portal/src/i18n/locales/ar/reports.json', 'utf8'));
  const arWh = JSON.parse(fs.readFileSync('apps/portal/src/i18n/locales/ar/warehouse.json', 'utf8'));
  const arCommon = JSON.parse(fs.readFileSync('apps/portal/src/i18n/locales/ar/common.json', 'utf8'));

  function lookup(keyPath) {
    const [ns, ...rest] = keyPath.split('.');
    const key = rest.join('.');
    const maps = { verification: arVer, reports: arRep, warehouse: arWh, common: arCommon };
    return maps[ns]?.[key];
  }

  s = s.replace(/ar:\s*t\('([^']+)'\)/g, (m, key) => {
    const ar = lookup(key);
    if (ar) return 'ar: ' + JSON.stringify(ar);
    return m;
  });
  s = s.replace(/en:\s*t\('([^']+)'\)/g, (m, key) => {
    // keep as English lookup failure — use key as last resort label
    const ar = lookup(key);
    return 'en: ' + JSON.stringify(ar || key);
  });

  // Ensure pdfT helper exists
  if (!s.includes('function pdfT(')) {
    const helper = `
type PdfLang = 'ar' | 'en';
function resolvePdfLang(): PdfLang {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('language') === 'en') return 'en';
  return 'ar';
}
function pdfT(map: Record<PdfLang, string>, vars?: Record<string, string | number>): string {
  const lang = resolvePdfLang();
  let text = map[lang] || map.ar;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp('\\\\{\\\\{' + k + '\\\\}\\\\}', 'g'), String(v))
        .replace(new RegExp('\\\\{' + k + '\\\\}', 'g'), String(v));
    }
  }
  return text;
}
`;
    const idx = s.indexOf('\n');
    s = s.slice(0, idx + 1) + helper + s.slice(idx + 1);
  }

  fs.writeFileSync(file, s);
  const remainingT = (s.match(/ar:\s*t\(/g) || []).length;
  const hook = s.includes('useTranslation');
  console.log(file, { remainingT, hook });
}

[
  'apps/portal/src/features/received-devices/export-received-device-details-pdf.ts',
  'apps/portal/src/features/withdrawn-devices/export-withdrawn-device-details-pdf.ts',
  'apps/portal/src/features/warehouse-details/export-transfer-pdf.ts',
].forEach(fixPdf);

// --- Fix remaining page strings ---
const patches = [
  {
    file: 'apps/portal/src/pages/product-smart-add.tsx',
    from: "description: `تم حفظ ${t('common.item_10652', { count: successCount })}${failedCount ? `، وفشل ${failedCount}` : \"\"}`,",
    to: "description: t('common.save_serials_result', { success: successCount, failedSuffix: failedCount ? t('common.save_failed_suffix', { failed: failedCount }) : \"\" }),",
  },
  {
    file: 'apps/portal/src/pages/accounting-dashboard.tsx',
    from: 'تاريخ التصدير: ${escapeHtml(dateLabel)}',
    to: "${t('accounting.export_date_label', { date: escapeHtml(dateLabel) })}",
    all: true,
  },
];

const localeAdds = {
  accounting: {
    top_distributors: { ar: 'أفضل الموزعين', en: 'Top distributors' },
    distributor: { ar: 'الموزع', en: 'Distributor' },
    top_items: { ar: 'أفضل الأصناف', en: 'Top items' },
    invoice_count: { ar: 'عدد الفواتير', en: 'Invoice count' },
    invoice_number: { ar: 'رقم الفاتورة', en: 'Invoice number' },
    item_details: { ar: 'تفاصيل الأصناف', en: 'Item details' },
    taxable_amount: { ar: 'القيمة الخاضعة', en: 'Taxable amount' },
    ops_subtitle: {
      ar: 'لوحة تشغيلية شاملة للمبيعات والمشتريات والقيود والمدفوعات والضريبة والفاتورة الإلكترونية.',
      en: 'Operational dashboard for sales, purchases, journals, payments, tax, and e-invoicing.',
    },
    no_einvoice_docs: { ar: 'لا توجد مستندات e-invoice حالياً.', en: 'No e-invoice documents currently.' },
    export_date_label: { ar: 'تاريخ التصدير: {{date}}', en: 'Export date: {{date}}' },
  },
  inventory: {
    documented_devices_list: { ar: 'قائمة الأجهزة الموثقة (المسح الحالي)', en: 'Documented devices list (current scan)' },
    no_session_records: {
      ar: 'لم يتم العثور على سجلات في الجلسة الحالية. قم بمسح المزيد من الأجهزة للبدء.',
      en: 'No records found in the current session. Scan more devices to get started.',
    },
    download_formatted_excel: { ar: 'تحميل ملف Excel منسق', en: 'Download formatted Excel file' },
    no_preview_data: { ar: 'لا توجد بيانات مدخلة لعرضها في المعاينة.', en: 'No entered data to show in the preview.' },
  },
  reports: {
    returned_ops_history: { ar: 'سجل العمليات المرتجعة', en: 'Returned operations history' },
    export_excel_label: { ar: 'تصدير إكسل Excel', en: 'Export Excel' },
    sim_type_label: { ar: 'نوع الشريحة: {{type}}', en: 'SIM type: {{type}}' },
    loading_device_details: { ar: 'جاري تحميل تفاصيل الجهاز...', en: 'Loading device details...' },
    accessories_available_of: { ar: '{{count}} من 4 متوفرة', en: '{{count}} of 4 available' },
  },
  common: {
    no_data: { ar: 'لا توجد بيانات', en: 'No data' },
    quantity: { ar: 'الكمية', en: 'Quantity' },
    sales: { ar: 'المبيعات', en: 'Sales' },
    item: { ar: 'الصنف', en: 'Item' },
    total: { ar: 'الإجمالي', en: 'Total' },
    status: { ar: 'الحالة', en: 'Status' },
    date: { ar: 'التاريخ', en: 'Date' },
    tax: { ar: 'الضريبة', en: 'Tax' },
  },
};

for (const [ns, keys] of Object.entries(localeAdds)) {
  for (const lang of ['ar', 'en']) {
    const p = path.join('apps/portal/src/i18n/locales', lang, ns + '.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const [k, v] of Object.entries(keys)) j[k] = v[lang];
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  }
}

// Apply string patches via replacements for accounting HTML and other pages
function replaceAllIn(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  let n = 0;
  for (const [from, to] of pairs) {
    if (s.includes(from)) {
      const c = s.split(from).length - 1;
      s = s.split(from).join(to);
      n += c;
    }
  }
  fs.writeFileSync(file, s);
  return n;
}

const accN = replaceAllIn('apps/portal/src/pages/accounting-dashboard.tsx', [
  ['تاريخ التصدير: ${escapeHtml(dateLabel)}', "${t('accounting.export_date_label', { date: escapeHtml(dateLabel) })}"],
  ['أفضل الموزعين', "${t('accounting.top_distributors')}"],
  ['>الموزع<', ">${t('accounting.distributor')}<"],
  ['>الكمية<', ">${t('common.quantity')}<"],
  ['>المبيعات<', ">${t('common.sales')}<"],
  ['>عدد الفواتير<', ">${t('accounting.invoice_count')}<"],
  ['>لا توجد بيانات<', ">${t('common.no_data')}<"],
  ['أفضل الأصناف', "${t('accounting.top_items')}"],
  ['>الصنف<', ">${t('common.item')}<"],
  ['>الإجمالي<', ">${t('common.total')}<"],
  ['>رقم الفاتورة<', ">${t('accounting.invoice_number')}<"],
  ['>الحالة<', ">${t('common.status')}<"],
  ['>تفاصيل الأصناف<', ">${t('accounting.item_details')}<"],
  ['>القيمة الخاضعة<', ">${t('accounting.taxable_amount')}<"],
  ['>الضريبة<', ">${t('common.tax')}<"],
  ['>التاريخ<', ">${t('common.date')}<"],
  ['لوحة تشغيلية شاملة للمبيعات والمشتريات والقيود والمدفوعات والضريبة والفاتورة الإلكترونية.', "${t('accounting.ops_subtitle')}"],
  ['لا توجد مستندات e-invoice حالياً.', "${t('accounting.no_einvoice_docs')}"],
  // also plain text nodes without >
  ['عدد الفواتير', "${t('accounting.invoice_count')}"],
]);

const smartN = replaceAllIn('apps/portal/src/pages/product-smart-add.tsx', [
  ["description: `تم حفظ ${t('common.item_10652', { count: successCount })}${failedCount ? `، وفشل ${failedCount}` : \"\"}`,",
    "description: t('common.save_serials_result', { success: successCount, failedSuffix: failedCount ? t('common.save_failed_suffix', { failed: failedCount }) : \"\" }),"],
  ['قائمة الأجهزة الموثقة (المسح الحالي)', "{t('inventory.documented_devices_list')}"],
  ['لم يتم العثور على سجلات في الجلسة الحالية. قم بمسح المزيد من الأجهزة للبدء.', "{t('inventory.no_session_records')}"],
  ['تحميل ملف Excel منسق', "{t('inventory.download_formatted_excel')}"],
  ['لا توجد بيانات مدخلة لعرضها في المعاينة.', "{t('inventory.no_preview_data')}"],
]);

const wAll = replaceAllIn('apps/portal/src/pages/withdrawn-devices-all.tsx', [
  ['سجل العمليات المرتجعة <span className="text-cyan-300">Operations History</span>',
    "{t('reports.returned_ops_history')} <span className=\"text-cyan-300\">Operations History</span>"],
  ['تصدير إكسل Excel', "{t('reports.export_excel_label')}"],
]);

const wMgmt = replaceAllIn('apps/portal/src/pages/withdrawn-devices-management.tsx', [
  ['نوع الشريحة: {device.simCardType}', "{t('reports.sim_type_label', { type: device.simCardType })}"],
]);

const wDet = replaceAllIn('apps/portal/src/pages/WithdrawnDeviceDetails.tsx', [
  ['جاري تحميل تفاصيل الجهاز...', "{t('reports.loading_device_details')}"],
  ['{[hasBattery, hasCable, hasHead, hasSim].filter(Boolean).length} من 4 متوفرة',
    "{t('reports.accessories_available_of', { count: [hasBattery, hasCable, hasHead, hasSim].filter(Boolean).length })}"],
]);

console.log({ accN, smartN, wAll, wMgmt, wDet });
