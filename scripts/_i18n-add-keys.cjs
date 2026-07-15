const fs = require('fs');
const path = require('path');

const root = 'apps/portal/src/i18n/locales';

function load(ns, lang) {
  return JSON.parse(fs.readFileSync(path.join(root, lang, ns + '.json'), 'utf8'));
}
function save(ns, lang, obj) {
  fs.writeFileSync(path.join(root, lang, ns + '.json'), JSON.stringify(obj, null, 2) + '\n');
}

const keys = {
  courier: {
    audit_moves_summary: {
      ar: 'تم تسجيل {{total}} حركة نظام وتعديل.',
      en: 'Recorded {{total}} system moves and edits.'
    },
    linked_to_tid: {
      ar: 'مرتبط بـ TID: {{tid}}',
      en: 'Linked to TID: {{tid}}'
    },
    page_of_with_total: {
      ar: 'الصفحة {{page}} من {{totalPages}} (إجمالي {{total}} سجل)',
      en: 'Page {{page}} of {{totalPages}} ({{total}} records total)'
    },
    device_sim_different_techs: {
      ar: 'الجهاز ({{device}}) والشريحة ({{sim}}) ينتميان لفنيين مختلفين.',
      en: 'Device ({{device}}) and SIM ({{sim}}) belong to different technicians.'
    },
    deduct_from_custody_not_assignment: {
      ar: '⚠ الخصم من عهدة: {{name}} — وليس من اسم التعيين.',
      en: '⚠ Deduct from custody: {{name}} — not from the assignment name.'
    },
    scan_out_on_complete: {
      ar: 'عند الحفظ بحالة {{status}}، سيتم خصم كل الأجهزة والشرائح المُدخلة تلقائياً من عهدة الفني (Scan-Out).',
      en: 'When saving as {{status}}, all entered devices and SIMs will be automatically deducted from the technician custody (Scan-Out).'
    },
    total_review_with_count: {
      ar: 'إجمالي الحالات بانتظار المراجعة والتحقق: {{total}} طلب',
      en: 'Total cases awaiting review and verification: {{total}} requests'
    },
    status_filter_label: {
      ar: 'الحالة: {{status}}',
      en: 'Status: {{status}}'
    },
    page_of: {
      ar: 'صفحة {{page}} من {{totalPages}}',
      en: 'Page {{page}} of {{totalPages}}'
    },
    add_role_item: {
      ar: 'إضافة {{role}}',
      en: 'Add {{role}}'
    },
    completed_2: { ar: null, en: 'Recorded' },
    completed_5: { ar: null, en: 'Completed' },
    verification_3: { ar: null, en: 'Pending verification' },
    total_review: { ar: null, en: 'Total cases awaiting review and verification:' },
    item_4292: { ar: null, en: '{{count}} of' },
    log_1: { ar: null, en: '{{count}} records' },
    device_1: { ar: null, en: 'device' },
    sim_1: { ar: null, en: 'SIM' },
  },
  dashboard: {
    welcome_back_overview: {
      ar: 'مرحباً بك مجدداً، {{name}}. إليك نظرة شاملة على عمليات المخزون ومؤشرات الأداء.',
      en: 'Welcome back, {{name}}. Here is a full overview of inventory operations and performance indicators.'
    },
    welcome_tech_custody: {
      ar: 'أهلاً بك، {{name}}. تابع عهدتك الثابتة والمتحركة وقدم طلبات المخزون الجديدة.',
      en: 'Welcome, {{name}}. Track your fixed and moving custody and submit new inventory requests.'
    },
  },
  inventory: {
    critical_stock_alert: {
      ar: '⚠️ تنبيه: {{count}} مندوبين لديهم مخزون حرج!',
      en: '⚠️ Alert: {{count}} technicians have critical stock!'
    },
    add_quantity_of: {
      ar: 'إضافة كمية جديدة من "{{name}}" إلى المخزون',
      en: 'Add a new quantity of "{{name}}" to inventory'
    },
    delete_item_confirm: {
      ar: 'هذا الإجراء لا يمكن التراجع عنه. سيتم حذف "{{name}}" من المخزون نهائياً.',
      en: 'This action cannot be undone. "{{name}}" will be permanently deleted from inventory.'
    },
    inventory_report_dated: {
      ar: 'تقرير المخزون - {{date}}',
      en: 'Inventory Report - {{date}}'
    },
    item_33113: { ar: null, en: '{{count}} technicians have critical stock' },
    item_4292: { ar: null, en: '{{count}} of' },
    edit_item_data: { ar: null, en: 'Edit details for "{{name}}"' },
  },
  notifications: {
    technician_label: {
      ar: 'المندوب: {{name}}',
      en: 'Technician: {{name}}'
    },
    accept_batch_confirm: {
      ar: 'هل تريد قبول {{count}} طلب؟',
      en: 'Do you want to accept {{count}} request(s)?'
    },
    reject_batch_reason_prompt: {
      ar: 'يرجى إدخال سبب رفض {{count}} طلب',
      en: 'Please enter a rejection reason for {{count}} request(s)'
    },
    item_9013: { ar: null, en: 'Technician #{{var_0}}' },
    item_7419: { ar: null, en: '{{count}} request(s)?' },
    request_4: { ar: null, en: '{{count}} request(s)' },
  },
  common: {
    internal_transfer_to: {
      ar: 'نقل مخزون داخلي - {{from}} إلى {{to}}',
      en: 'Internal stock transfer - {{from}} to {{to}}'
    },
    executed_by: {
      ar: 'المنفذ: {{name}} • {{role}}',
      en: 'Executed by: {{name}} • {{role}}'
    },
    page_of: {
      ar: 'الصفحة {{page}} من {{totalPages}}',
      en: 'Page {{page}} of {{totalPages}}'
    },
    date_label: {
      ar: 'التاريخ: {{date}}',
      en: 'Date: {{date}}'
    },
    time_label: {
      ar: 'الوقت: {{time}}',
      en: 'Time: {{time}}'
    },
    active_custody_count: {
      ar: 'عهدة نشطة: {{count}}',
      en: 'Active custody: {{count}}'
    },
    delivered_count_label: {
      ar: 'مسلَّم: {{count}}',
      en: 'Delivered: {{count}}'
    },
    total_label: {
      ar: 'المجموع: {{total}}',
      en: 'Total: {{total}}'
    },
    from_last_month: {
      ar: '{{direction}} {{value}}% من الشهر الماضي',
      en: '{{direction}} {{value}}% from last month'
    },
    vs_previous_month: {
      ar: '{{delta}}% عن الشهر السابق',
      en: '{{delta}}% vs previous month'
    },
    inventory_management: {
      ar: 'إدارة المخزون',
      en: 'Inventory Management'
    },
    available_qty: {
      ar: '(متوفر: {{qty}})',
      en: '(Available: {{qty}})'
    },
    available_supply: {
      ar: '{{barcode}} • المتاح: {{qty}}',
      en: '{{barcode}} • Available: {{qty}}'
    },
    save_serials_result: {
      ar: 'تم حفظ {{success}} سيريال{{failedSuffix}}',
      en: 'Saved {{success}} serial(s){{failedSuffix}}'
    },
    save_failed_suffix: {
      ar: '، وفشل {{failed}}',
      en: ', and {{failed}} failed'
    },
    warehouse_1: { ar: null, en: 'Warehouse' },
    item_11173: { ar: null, en: 'Unspecified' },
    item_4292: { ar: null, en: '{{count}} of' },
    item_10652: { ar: null, en: '{{count}} serial(s)' },
    system_4: { ar: null, en: 'System' },
    technician: { ar: null, en: 'Technician' },
  },
  verification: {
    upload_date: {
      ar: 'تاريخ الرفع: {{date}}',
      en: 'Upload date: {{date}}'
    },
    notes_for_action: {
      ar: 'ملاحظات {{action}}',
      en: 'Notes {{action}}'
    },
    material_with_serial: {
      ar: 'مادة: {{name}} - {{serial}}',
      en: 'Item: {{name}} - {{serial}}'
    },
    item_9642: { ar: null, en: '(required)' },
    item_12773: { ar: null, en: '(optional)' },
    item_9013: { ar: null, en: 'Technician #{{var_0}}' },
    item_11173: { ar: null, en: 'Unspecified' },
  },
  warehouse: {
    transfer_items_from: {
      ar: 'نقل أصناف من {{name}}',
      en: 'Transfer items from {{name}}'
    },
    available_boxes_units: {
      ar: 'متاح: {{boxes}} صندوق / {{units}} قطعة',
      en: 'Available: {{boxes}} boxes / {{units}} units'
    },
    overflow_items_count: {
      ar: 'يوجد {{count}} صنف يتجاوز الكمية المتاحة',
      en: 'There are {{count}} items exceeding available quantity'
    },
  },
  reports: {
    region_warehouse: {
      ar: 'مستودع المنطقة{{region}}',
      en: 'Region warehouse{{region}}'
    },
  },
  errors: {
    server_connection_failed: {
      ar: 'فشل الاتصال بالسيرفر. يرجى التحقق من الاتصال بالإنترنت أو الاتصال بالدعم الفني.',
      en: 'Failed to connect to the server. Please check your internet connection or contact support.'
    },
    html_instead_of_json: {
      ar: 'تم استلام HTML بدل JSON من السيرفر. تحقق من مسارات API أو إعادة تشغيل الخادم.',
      en: 'Received HTML instead of JSON from the server. Check API routes or restart the server.'
    },
  },
};

let added = 0, updated = 0;
for (const [ns, map] of Object.entries(keys)) {
  const ar = load(ns, 'ar');
  const en = load(ns, 'en');
  for (const [k, v] of Object.entries(map)) {
    if (v.ar !== null) {
      if (!(k in ar)) added++;
      else updated++;
      ar[k] = v.ar;
    }
    if (v.en !== null) {
      if (!(k in en)) added++;
      else updated++;
      en[k] = v.en;
    }
  }
  save(ns, 'ar', ar);
  save(ns, 'en', en);
}
console.log(JSON.stringify({ added, updated }));
