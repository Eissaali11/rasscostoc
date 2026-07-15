/**
 * Converts exportToExcel.ts Arabic literals to bilingual maps keyed by language.
 * Adds optional `language?: 'ar' | 'en'` (default 'ar') and optional `t` translator.
 */
const fs = require('fs');

const EXCEL_MAP = {
  devices: { ar: 'أجهزة', en: 'Devices' },
  sims: { ar: 'شرائح', en: 'SIMs' },
  papers: { ar: 'أوراق', en: 'Papers' },
  available: { ar: 'متوفر', en: 'Available' },
  low: { ar: 'منخفض', en: 'Low' },
  out: { ar: 'نافد', en: 'Out of stock' },
  company_default: { ar: 'نظام إدارة المخزون', en: 'Inventory Management System' },
  company_ras: { ar: 'نظام إدارة المخزون - RAS Saudi', en: 'Inventory Management System - RAS Saudi' },
  inventory_report_title: { ar: 'تقرير المخزون الشامل', en: 'Comprehensive Inventory Report' },
  inventory_sheet: { ar: 'تقرير المخزون', en: 'Inventory Report' },
  report_date: { ar: 'تاريخ التقرير: {{date}}', en: 'Report date: {{date}}' },
  report_date_time: { ar: 'تاريخ التقرير: {{date}} - الساعة: {{time}}', en: 'Report date: {{date}} - Time: {{time}}' },
  item_name: { ar: 'اسم الصنف', en: 'Item name' },
  type: { ar: 'النوع', en: 'Type' },
  quantity: { ar: 'الكمية', en: 'Quantity' },
  unit: { ar: 'الوحدة', en: 'Unit' },
  min_threshold: { ar: 'الحد الأدنى', en: 'Minimum' },
  technician_name: { ar: 'اسم المندوب', en: 'Technician name' },
  city: { ar: 'المدينة', en: 'City' },
  status: { ar: 'الحالة', en: 'Status' },
  region: { ar: 'المنطقة', en: 'Region' },
  unspecified: { ar: 'غير محدد', en: 'Unspecified' },
  statistics: { ar: '📊 الإحصائيات', en: '📊 Statistics' },
  total_items: { ar: 'إجمالي الأصناف:', en: 'Total items:' },
  available_items: { ar: 'الأصناف المتوفرة:', en: 'Available items:' },
  low_items: { ar: 'الأصناف المنخفضة:', en: 'Low stock items:' },
  out_items: { ar: 'الأصناف النافدة:', en: 'Out of stock items:' },
  total_qty: { ar: 'إجمالي الكميات:', en: 'Total quantities:' },
  inventory_filename: { ar: 'تقرير_المخزون_', en: 'inventory_report_' },
  warehouses_sheet: { ar: 'تقرير المستودعات', en: 'Warehouses Report' },
  warehouse_name: { ar: 'اسم المستودع', en: 'Warehouse name' },
  location: { ar: 'الموقع', en: 'Location' },
  boxes_suffix: { ar: '(صناديق)', en: '(boxes)' },
  units_suffix: { ar: '(قطع)', en: '(units)' },
  units_paren: { ar: '(وحدات)', en: '(units)' },
  total_items_col: { ar: 'إجمالي الأصناف', en: 'Total items' },
  active: { ar: 'نشط', en: 'Active' },
  inactive: { ar: 'غير نشط', en: 'Inactive' },
  grand_total: { ar: 'الإجمالي', en: 'Total' },
  general_stats: { ar: 'الإحصائيات العامة', en: 'General statistics' },
  total_warehouses: { ar: 'إجمالي المستودعات', en: 'Total warehouses' },
  active_warehouses: { ar: 'المستودعات النشطة', en: 'Active warehouses' },
  inactive_warehouses: { ar: 'المستودعات غير النشطة', en: 'Inactive warehouses' },
  total_item_count: { ar: 'إجمالي عدد الأصناف', en: 'Total item count' },
  total_suffix: { ar: '(إجمالي)', en: '(total)' },
  warehouses_filename: { ar: 'تقرير_المستودعات_', en: 'warehouses_report_' },
  warehouses_report_title: { ar: 'تقرير المستودعات الشامل', en: 'Comprehensive Warehouses Report' },
  thermal_paper: { ar: 'ورق حراري', en: 'Thermal paper' },
  stickers: { ar: 'ملصقات', en: 'Stickers' },
  batteries: { ar: 'بطاريات', en: 'Batteries' },
  mobily: { ar: 'موبايلي', en: 'Mobily' },
  zain: { ar: 'زين', en: 'Zain' },
  lebara: { ar: 'ليبارا', en: 'Lebara' },
  total_boxes: { ar: 'إجمالي الصناديق', en: 'Total boxes' },
  units_sheet: { ar: 'الوحدات - Units', en: 'Units' },
  units_subtitle: { ar: 'تقرير الوحدات - Units Report', en: 'Units Report' },
  units_stats: { ar: 'الإحصائيات العامة - Units Statistics', en: 'General statistics - Units' },
  total_units: { ar: 'إجمالي الوحدات', en: 'Total units' },
  item_col: { ar: 'الصنف', en: 'Item' },
  city_date: { ar: 'المدينة: {{city}} | التاريخ: {{date}} - {{time}}', en: 'City: {{city}} | Date: {{date}} - {{time}}' },
  boxes: { ar: 'صناديق', en: 'Boxes' },
  pieces: { ar: 'قطع', en: 'Pieces' },
  fixed_inventory: { ar: 'المخزون الثابت - Fixed', en: 'Fixed inventory' },
  tech_inventory_report: { ar: 'تقرير مخزون المندوب', en: 'Technician inventory report' },
  moving_inventory: { ar: 'المخزون المتحرك - Moving', en: 'Moving inventory' },
  moving_report: { ar: 'تقرير المخزون المتحرك', en: 'Moving inventory report' },
  tech_filename: { ar: 'تقرير_مخزون_المندوب_', en: 'technician_inventory_' },
  inventory_tab: { ar: 'المخزون', en: 'Inventory' },
  warehouse_inventory_report: { ar: 'تقرير مخزون المستودع: {{name}}', en: 'Warehouse inventory report: {{name}}' },
  location_label: { ar: 'الموقع: {{location}}', en: 'Location: {{location}}' },
  cartons: { ar: 'الكراتين', en: 'Cartons' },
  units_col: { ar: 'الوحدات', en: 'Units' },
  print_paper: { ar: 'ورق الطباعة', en: 'Print paper' },
  the_stickers: { ar: 'الملصقات', en: 'Stickers' },
  the_batteries: { ar: 'البطاريات', en: 'Batteries' },
  transfer_log_sheet: { ar: 'سجل النقل', en: 'Transfer log' },
  transfer_log_title: { ar: 'سجل عمليات النقل - {{name}}', en: 'Transfer operations log - {{name}}' },
  transferred_items: { ar: 'الأصناف المنقولة', en: 'Transferred items' },
  notes: { ar: 'الملاحظات', en: 'Notes' },
  date: { ar: 'التاريخ', en: 'Date' },
  warehouse_inv_filename: { ar: 'تقرير_مخزون_', en: 'warehouse_inventory_' },
  system_ops_title: { ar: 'تقرير سجل عمليات النظام', en: 'System operations log report' },
  system_log_sheet: { ar: 'سجل النظام', en: 'System log' },
  user: { ar: 'المستخدم', en: 'User' },
  role: { ar: 'الدور', en: 'Role' },
  operation: { ar: 'العملية', en: 'Operation' },
  entity_type: { ar: 'نوع الكيان', en: 'Entity type' },
  entity_name: { ar: 'اسم الكيان', en: 'Entity name' },
  level: { ar: 'المستوى', en: 'Level' },
  description: { ar: 'الوصف', en: 'Description' },
  system_log_filename: { ar: 'سجل_عمليات_النظام_', en: 'system_operations_log_' },
  withdrawn_title: { ar: 'تقرير الأجهزة المسحوبة والمرتجعة الشامل', en: 'Comprehensive withdrawn & returned devices report' },
  withdrawn_sheet: { ar: 'الأجهزة المرتجعة', en: 'Returned devices' },
  col_city: { ar: 'المدينة (City)', en: 'City' },
  col_tec: { ar: 'اسم الفني (Tec Name)', en: 'Technician name' },
  col_terminal: { ar: 'رقم الجهاز (Terminal ID)', en: 'Terminal ID' },
  col_serial: { ar: 'الرقم التسلسلي للجهاز (serial number)', en: 'Device serial number' },
  col_battery: { ar: 'البطارية سليمة ام لا (Battery)', en: 'Battery OK' },
  col_charger_cable: { ar: 'كابل الشاحن (charger cable)', en: 'Charger cable' },
  col_charger_head: { ar: 'رأس الشاحن (charger head)', en: 'Charger head' },
  col_sim_present: { ar: 'وجود شريحة الاتصال في الجهاز (SIM)', en: 'SIM present in device' },
  col_sim_type: { ar: 'نوع شريحة الاتصال (SIM card type)', en: 'SIM card type' },
  col_damage: { ar: 'يرجى ذكر الضرر ان وجد (damage part)', en: 'Damage details if any' },
  col_notes: { ar: 'ملاحظات (Notes)', en: 'Notes' },
  col_total_devices: { ar: 'إجمالي عدد الأجهزة (Total Terminal ID)', en: 'Total devices' },
  withdrawn_filename: { ar: 'تقرير_الأجهزة_المسحوبة_', en: 'withdrawn_devices_report_' },
};

const helper = `
export type ExcelLanguage = 'ar' | 'en';
export type ExcelTranslateFn = (key: string, options?: Record<string, any>) => string;

const EXCEL_I18N = ${JSON.stringify(EXCEL_MAP, null, 2)} as const;

type ExcelKey = keyof typeof EXCEL_I18N;

function interpolate(template: string, vars?: Record<string, any>): string {
  if (!vars) return template;
  return Object.keys(vars).reduce((acc, key) => {
    return acc.replace(new RegExp('\\\\{\\\\{' + key + '\\\\}\\\\}', 'g'), String(vars[key]))
      .replace(new RegExp('\\\\{' + key + '\\\\}', 'g'), String(vars[key]));
  }, template);
}

function xl(key: ExcelKey, lang: ExcelLanguage = 'ar', vars?: Record<string, any>): string {
  const entry = EXCEL_I18N[key];
  const text = entry?.[lang] || entry?.ar || key;
  return interpolate(text, vars);
}

function resolveLang(opts?: { language?: ExcelLanguage; t?: ExcelTranslateFn }): ExcelLanguage {
  if (opts?.language === 'en' || opts?.language === 'ar') return opts.language;
  if (typeof localStorage !== 'undefined' && localStorage.getItem('language') === 'en') return 'en';
  return 'ar';
}
`;

let content = fs.readFileSync('apps/portal/src/lib/exportToExcel.ts', 'utf8');

// Insert helper after imports block
if (!content.includes('EXCEL_I18N')) {
  const importBlockEnd = content.indexOf('\ninterface ExportData');
  if (importBlockEnd < 0) throw new Error('ExportData interface not found');
  content = content.slice(0, importBlockEnd) + '\n' + helper + '\n' + content.slice(importBlockEnd);
}

// Replace helper functions
content = content.replace(
  /const getTypeNameArabic = \(type: string\): string => \{[\s\S]*?\n\};/,
  `const getTypeName = (type: string, lang: ExcelLanguage = 'ar'): string => {
  switch (type) {
    case 'devices': return xl('devices', lang);
    case 'sim': return xl('sims', lang);
    case 'papers': return xl('papers', lang);
    default: return type;
  }
};`
);

content = content.replace(
  /const getStatusNameArabic = \(status: string\): string => \{[\s\S]*?\n\};/,
  `const getStatusName = (status: string, lang: ExcelLanguage = 'ar'): string => {
  switch (status) {
    case 'available': return xl('available', lang);
    case 'low': return xl('low', lang);
    case 'out': return xl('out', lang);
    default: return status;
  }
};`
);

// Update exportInventoryToExcel signature and body key strings
content = content.replace(
  /export const exportInventoryToExcel = async \(\{ \r?\n  inventory, \r?\n  companyName = 'نظام إدارة المخزون', \r?\n  reportTitle = 'تقرير المخزون الشامل' \r?\n\}: ExportData\) => \{/,
  `export const exportInventoryToExcel = async ({ 
  inventory, 
  companyName,
  reportTitle,
  language,
}: ExportData & { language?: ExcelLanguage }) => {
  const lang = resolveLang({ language });
  companyName = companyName || xl('company_default', lang);
  reportTitle = reportTitle || xl('inventory_report_title', lang);`
);

content = content.replace(
  /workbook\.addWorksheet\('تقرير المخزون'\)/,
  "workbook.addWorksheet(xl('inventory_sheet', lang))"
);

content = content.replace(
  /dateCell\.value = `تاريخ التقرير: \$\{currentDate\}`;/,
  "dateCell.value = xl('report_date', lang, { date: currentDate });"
);

// Header row for inventory - replace Arabic array
content = content.replace(
  /const headerRow = worksheet\.addRow\(\['#', 'اسم الصنف', 'النوع', 'الكمية', 'الوحدة', 'الحد الأدنى', 'اسم المندوب', 'المدينة', 'الحالة', 'المنطقة'\]\);/,
  `const headerRow = worksheet.addRow(['#', xl('item_name', lang), xl('type', lang), xl('quantity', lang), xl('unit', lang), xl('min_threshold', lang), xl('technician_name', lang), xl('city', lang), xl('status', lang), xl('region', lang)]);`
);

content = content.replace(/getTypeNameArabic\(/g, 'getTypeName(');
content = content.replace(/getStatusNameArabic\(/g, 'getStatusName(');

// After getTypeName( calls, need to pass lang - do a careful replace for inventory section
content = content.replace(/getTypeName\(item\.type\)/g, 'getTypeName(item.type, lang)');
content = content.replace(/getStatusName\(item\.status\)/g, 'getStatusName(item.status, lang)');

content = content.replace(/item\.regionName \|\| 'غير محدد'/g, "item.regionName || xl('unspecified', lang)");

content = content.replace(
  /worksheet\.addRow\(\['📊 الإحصائيات'\]\)\.font = \{ bold: true, size: 12 \};/,
  "worksheet.addRow([xl('statistics', lang)]).font = { bold: true, size: 12 };"
);
content = content.replace(
  /worksheet\.addRow\(\['إجمالي الأصناف:', inventory\.length\]\);/,
  "worksheet.addRow([xl('total_items', lang), inventory.length]);"
);
content = content.replace(
  /worksheet\.addRow\(\['الأصناف المتوفرة:', inventory\.filter\(i => i\.status === 'available'\)\.length\]\);/,
  "worksheet.addRow([xl('available_items', lang), inventory.filter(i => i.status === 'available').length]);"
);
content = content.replace(
  /worksheet\.addRow\(\['الأصناف المنخفضة:', inventory\.filter\(i => i\.status === 'low'\)\.length\]\);/,
  "worksheet.addRow([xl('low_items', lang), inventory.filter(i => i.status === 'low').length]);"
);
content = content.replace(
  /worksheet\.addRow\(\['الأصناف النافدة:', inventory\.filter\(i => i\.status === 'out'\)\.length\]\);/,
  "worksheet.addRow([xl('out_items', lang), inventory.filter(i => i.status === 'out').length]);"
);
content = content.replace(
  /worksheet\.addRow\(\['إجمالي الكميات:', inventory\.reduce\(\(sum, item\) => sum \+ item\.quantity, 0\)\]\);/,
  "worksheet.addRow([xl('total_qty', lang), inventory.reduce((sum, item) => sum + item.quantity, 0)]);"
);
content = content.replace(
  /const fileName = `تقرير_المخزون_\$\{new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]\}\.xlsx`;/,
  "const fileName = `${xl('inventory_filename', lang)}${new Date().toISOString().split('T')[0]}.xlsx`;"
);

// Bulk replace remaining common Arabic string literals with xl() where safe
const replacements = [
  ["'تقرير المستودعات'", "xl('warehouses_sheet', lang)"],
  ["`تاريخ التقرير: ${arabicDate} - الساعة: ${time}`", "xl('report_date_time', lang, { date: arabicDate, time })"],
  ["'اسم المستودع'", "xl('warehouse_name', lang)"],
  ["'الموقع'", "xl('location', lang)"],
  ["'الحالة'", "xl('status', lang)"],
  ["'إجمالي الأصناف'", "xl('total_items_col', lang)"],
  ["'نشط'", "xl('active', lang)"],
  ["'غير نشط'", "xl('inactive', lang)"],
  ["'الإجمالي'", "xl('grand_total', lang)"],
  ["'الإحصائيات العامة'", "xl('general_stats', lang)"],
  ["'إجمالي المستودعات'", "xl('total_warehouses', lang)"],
  ["'المستودعات النشطة'", "xl('active_warehouses', lang)"],
  ["'المستودعات غير النشطة'", "xl('inactive_warehouses', lang)"],
  ["'إجمالي عدد الأصناف'", "xl('total_item_count', lang)"],
  ["`تقرير_المستودعات_${new Date().toISOString().split('T')[0]}.xlsx`", "`${xl('warehouses_filename', lang)}${new Date().toISOString().split('T')[0]}.xlsx`"],
  ["'نظام إدارة المخزون - RAS Saudi'", "xl('company_ras', lang)"],
  ["'تقرير المستودعات الشامل'", "xl('warehouses_report_title', lang)"],
  ["'ورق حراري'", "xl('thermal_paper', lang)"],
  ["'ملصقات'", "xl('stickers', lang)"],
  ["'بطاريات'", "xl('batteries', lang)"],
  ["'موبايلي'", "xl('mobily', lang)"],
  ["'زين'", "xl('zain', lang)"],
  ["'ليبارا'", "xl('lebara', lang)"],
  ["'إجمالي الصناديق'", "xl('total_boxes', lang)"],
  ["'الوحدات - Units'", "xl('units_sheet', lang)"],
  ["'تقرير الوحدات - Units Report'", "xl('units_subtitle', lang)"],
  ["'الإحصائيات العامة - Units Statistics'", "xl('units_stats', lang)"],
  ["'إجمالي الوحدات'", "xl('total_units', lang)"],
  ["'الصنف'", "xl('item_col', lang)"],
  ["'صناديق'", "xl('boxes', lang)"],
  ["'قطع'", "xl('pieces', lang)"],
  ["'المخزون الثابت - Fixed'", "xl('fixed_inventory', lang)"],
  ["'تقرير مخزون المندوب'", "xl('tech_inventory_report', lang)"],
  ["'المخزون المتحرك - Moving'", "xl('moving_inventory', lang)"],
  ["'تقرير المخزون المتحرك'", "xl('moving_report', lang)"],
  ["'المخزون'", "xl('inventory_tab', lang)"],
  ["'الكراتين'", "xl('cartons', lang)"],
  ["'الوحدات'", "xl('units_col', lang)"],
  ["'ورق الطباعة'", "xl('print_paper', lang)"],
  ["'الملصقات'", "xl('the_stickers', lang)"],
  ["'البطاريات'", "xl('the_batteries', lang)"],
  ["'سجل النقل'", "xl('transfer_log_sheet', lang)"],
  ["'الأصناف المنقولة'", "xl('transferred_items', lang)"],
  ["'الملاحظات'", "xl('notes', lang)"],
  ["'التاريخ'", "xl('date', lang)"],
  ["'المندوب'", "xl('technician_name', lang)"],
  ["'نظام إدارة المخزون'", "xl('company_default', lang)"],
  ["'تقرير سجل عمليات النظام'", "xl('system_ops_title', lang)"],
  ["'سجل النظام'", "xl('system_log_sheet', lang)"],
  ["'المستخدم'", "xl('user', lang)"],
  ["'الدور'", "xl('role', lang)"],
  ["'العملية'", "xl('operation', lang)"],
  ["'نوع الكيان'", "xl('entity_type', lang)"],
  ["'اسم الكيان'", "xl('entity_name', lang)"],
  ["'المستوى'", "xl('level', lang)"],
  ["'الوصف'", "xl('description', lang)"],
  ["'تقرير الأجهزة المسحوبة والمرتجعة الشامل'", "xl('withdrawn_title', lang)"],
  ["'الأجهزة المرتجعة'", "xl('withdrawn_sheet', lang)"],
  ["'المدينة (City)'", "xl('col_city', lang)"],
  ["'اسم الفني (Tec Name)'", "xl('col_tec', lang)"],
  ["'رقم الجهاز (Terminal ID)'", "xl('col_terminal', lang)"],
  ["'الرقم التسلسلي للجهاز (serial number)'", "xl('col_serial', lang)"],
  ["'البطارية سليمة ام لا (Battery)'", "xl('col_battery', lang)"],
  ["'كابل الشاحن (charger cable)'", "xl('col_charger_cable', lang)"],
  ["'رأس الشاحن (charger head)'", "xl('col_charger_head', lang)"],
  ["'وجود شريحة الاتصال في الجهاز (SIM)'", "xl('col_sim_present', lang)"],
  ["'نوع شريحة الاتصال (SIM card type)'", "xl('col_sim_type', lang)"],
  ["'يرجى ذكر الضرر ان وجد (damage part)'", "xl('col_damage', lang)"],
  ["'ملاحظات (Notes)'", "xl('col_notes', lang)"],
  ["'إجمالي عدد الأجهزة (Total Terminal ID)'", "xl('col_total_devices', lang)"],
];

let replaced = 0;
for (const [from, to] of replacements) {
  if (content.includes(from)) {
    const count = content.split(from).length - 1;
    content = content.split(from).join(to);
    replaced += count;
  }
}

// Template literals with Arabic
const tmplReplacements = [
  [
    "`${it.nameAr} (صناديق)`",
    "`${it.nameAr} ${xl('boxes_suffix', lang)}`"
  ],
  [
    "`${it.nameAr} (قطع)`",
    "`${it.nameAr} ${xl('units_suffix', lang)}`"
  ],
  [
    "`${it.nameAr} (إجمالي)`",
    "`${it.nameAr} ${xl('total_suffix', lang)}`"
  ],
  [
    "`تاريخ التقرير: ${currentDate}`",
    "xl('report_date', lang, { date: currentDate })"
  ],
  [
    "`تقرير مخزون المستودع: ${data.warehouse.name}`",
    "xl('warehouse_inventory_report', lang, { name: data.warehouse.name })"
  ],
  [
    "`الموقع: ${data.warehouse.location}`",
    "xl('location_label', lang, { location: data.warehouse.location })"
  ],
  [
    "`تاريخ التقرير: ${arabicDate} - ${time}`",
    "xl('report_date_time', lang, { date: arabicDate, time })"
  ],
  [
    "`سجل عمليات النقل - ${data.warehouse.name}`",
    "xl('transfer_log_title', lang, { name: data.warehouse.name })"
  ],
  [
    "`المدينة: ${data.city} | التاريخ: ${arabicDate} - ${time}`",
    "xl('city_date', lang, { city: data.city, date: arabicDate, time })"
  ],
  [
    "`تقرير_مخزون_المندوب_${data.technicianName}_${new Date().toISOString().split('T')[0]}.xlsx`",
    "`${xl('tech_filename', lang)}${data.technicianName}_${new Date().toISOString().split('T')[0]}.xlsx`"
  ],
  [
    "`تقرير_مخزون_${data.warehouse.name}_${new Date().toISOString().split('T')[0]}.xlsx`",
    "`${xl('warehouse_inv_filename', lang)}${data.warehouse.name}_${new Date().toISOString().split('T')[0]}.xlsx`"
  ],
  [
    "`سجل_عمليات_النظام_${new Date().toISOString().split('T')[0]}.xlsx`",
    "`${xl('system_log_filename', lang)}${new Date().toISOString().split('T')[0]}.xlsx`"
  ],
  [
    "`تقرير_الأجهزة_المسحوبة_${new Date().toISOString().split('T')[0]}.xlsx`",
    "`${xl('withdrawn_filename', lang)}${new Date().toISOString().split('T')[0]}.xlsx`"
  ],
];

for (const [from, to] of tmplReplacements) {
  if (content.includes(from)) {
    const count = content.split(from).length - 1;
    content = content.split(from).join(to);
    replaced += count;
  }
}

// Product-specific headers like 'N950 (صناديق)'
content = content.replace(/'(\w[\w]*) \(صناديق\)'/g, (_, name) => `\`\${'${name}'} \${xl('boxes_suffix', lang)}\``);
content = content.replace(/'(\w[\w]*) \(قطع\)'/g, (_, name) => `\`\${'${name}'} \${xl('units_suffix', lang)}\``);
content = content.replace(/'(\w[\w]*) \(وحدات\)'/g, (_, name) => `\`\${'${name}'} \${xl('units_paren', lang)}\``);
content = content.replace(/'(ورق حراري|ملصقات|بطاريات|موبايلي|STC|زين|ليبارا) \(صناديق\)'/g, (m, name) => {
  // already handled if Arabic product names
  return m;
});

// Fix remaining Arabic product headers
const productHeaders = [
  ["'ورق حراري (صناديق)'", "`${xl('thermal_paper', lang)} ${xl('boxes_suffix', lang)}`"],
  ["'ورق حراري (قطع)'", "`${xl('thermal_paper', lang)} ${xl('units_suffix', lang)}`"],
  ["'ورق حراري (وحدات)'", "`${xl('thermal_paper', lang)} ${xl('units_paren', lang)}`"],
  ["'ملصقات (صناديق)'", "`${xl('stickers', lang)} ${xl('boxes_suffix', lang)}`"],
  ["'ملصقات (قطع)'", "`${xl('stickers', lang)} ${xl('units_suffix', lang)}`"],
  ["'ملصقات (وحدات)'", "`${xl('stickers', lang)} ${xl('units_paren', lang)}`"],
  ["'بطاريات (صناديق)'", "`${xl('batteries', lang)} ${xl('boxes_suffix', lang)}`"],
  ["'بطاريات (قطع)'", "`${xl('batteries', lang)} ${xl('units_suffix', lang)}`"],
  ["'بطاريات (وحدات)'", "`${xl('batteries', lang)} ${xl('units_paren', lang)}`"],
  ["'موبايلي (صناديق)'", "`${xl('mobily', lang)} ${xl('boxes_suffix', lang)}`"],
  ["'موبايلي (قطع)'", "`${xl('mobily', lang)} ${xl('units_suffix', lang)}`"],
  ["'موبايلي (وحدات)'", "`${xl('mobily', lang)} ${xl('units_paren', lang)}`"],
  ["'زين (صناديق)'", "`${xl('zain', lang)} ${xl('boxes_suffix', lang)}`"],
  ["'زين (قطع)'", "`${xl('zain', lang)} ${xl('units_suffix', lang)}`"],
  ["'زين (وحدات)'", "`${xl('zain', lang)} ${xl('units_paren', lang)}`"],
  ["'ليبارا (صناديق)'", "`${xl('lebara', lang)} ${xl('boxes_suffix', lang)}`"],
  ["'ليبارا (قطع)'", "`${xl('lebara', lang)} ${xl('units_suffix', lang)}`"],
  ["'ليبارا (وحدات)'", "`${xl('lebara', lang)} ${xl('units_paren', lang)}`"],
  ["'STC (صناديق)'", "`STC ${xl('boxes_suffix', lang)}`"],
  ["'STC (قطع)'", "`STC ${xl('units_suffix', lang)}`"],
  ["'STC (وحدات)'", "`STC ${xl('units_paren', lang)}`"],
  ["'موبايلي SIM'", "'Mobily SIM'"],
  ["'زين SIM'", "'Zain SIM'"],
  ["'ليبارا SIM'", "'Lebara SIM'"],
];

for (const [from, to] of productHeaders) {
  if (content.includes(from)) {
    const count = content.split(from).length - 1;
    content = content.split(from).join(to);
    replaced += count;
  }
}

// Ensure each export function has `const lang = resolveLang(...)`
// Add lang to functions that don't have it yet
const fnMarkers = [
  'export const exportWarehousesToExcel = async',
  'const exportWarehousesToExcelDynamic = async',
  'export const exportTechnicianToExcel = async',
  'export const exportSingleWarehouseToExcel = async',
  'export const exportSystemLogsToExcel = async',
  'export const exportWithdrawnDevicesToExcel = async',
];

for (const marker of fnMarkers) {
  const idx = content.indexOf(marker);
  if (idx < 0) continue;
  const arrowIdx = content.indexOf('=>', idx);
  const brace = arrowIdx >= 0 ? content.indexOf('{', arrowIdx) : content.indexOf('{', idx);
  const slice = content.slice(brace, brace + 200);
  if (slice.includes('resolveLang')) continue;
  content = content.slice(0, brace + 1) + "\n  const lang = resolveLang();\n" + content.slice(brace + 1);
}

// Fix ternary active/inactive that may have been partially replaced
content = content.replace(
  /warehouse\.isActive \? xl\('active', lang\) : xl\('inactive', lang\)/g,
  "warehouse.isActive ? xl('active', lang) : xl('inactive', lang)"
);

fs.writeFileSync('apps/portal/src/lib/exportToExcel.ts', content);

const remaining = [];
content.split(/\r?\n/).forEach((line, i) => {
  if (/[\u0600-\u06FF]/.test(line) && !line.includes('ar:') && !line.includes("'ar'") && !line.includes('"ar"')) {
    // still count ar map entries as ok if in EXCEL_I18N
    if (line.includes('ar:')) return;
    remaining.push({ line: i + 1, text: line.trim().slice(0, 120) });
  }
});

console.log(JSON.stringify({ replaced, remainingOutsideMap: remaining.filter(r => !r.text.includes('ar:')).slice(0, 40), remainingCount: remaining.length }, null, 2));
