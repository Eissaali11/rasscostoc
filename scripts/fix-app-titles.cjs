const fs = require('fs');
const path = 'apps/portal/src/App.tsx';
let c = fs.readFileSync(path, 'utf8');

const map = [
  ['الصفحة الرئيسية', 'titles.home'],
  ['سجل الحركات', 'titles.transactions'],
  ['البحث في العمليات', 'titles.operations_search'],
  ['إدارة الأصناف المرتجعة', 'titles.withdrawn_management'],
  ['سجل العمليات المرتجعة', 'titles.withdrawn_all'],
  ['تفاصيل الجهاز المرتجع', 'titles.withdrawn_details'],
  ['الأصناف المرتجعة', 'titles.withdrawn_devices'],
  ['إدخال أجهزة مستقبلة', 'titles.received_submit'],
  ['مراجعة الأجهزة المستقبلة', 'titles.received_review'],
  ['تفاصيل الجهاز المستلم', 'titles.received_details'],
  ['مركز التنبيهات الذكي', 'titles.notifications'],
  ['إدارة المنتجات', 'titles.products'],
  ['مركز المسح والتحقق الذكي', 'titles.product_smart_add'],
  ['الملف الشخصي', 'titles.profile'],
  ['تفاصيل عهدة المندوب', 'titles.technician_details'],
  ['الملف التفصيلي للموظف', 'titles.employee_profile'],
  ['تعديل بيانات الموظف', 'titles.employee_edit'],
  ['سجل النظام', 'titles.system_logs'],
  ['المخزون الثابت للمندوبين', 'titles.fixed_inventory'],
  ['المخزون الثابت', 'titles.my_fixed'],
  ['المخزون المتحرك', 'titles.my_moving'],
  ['بوابة التحقق من الرقم التسلسلي', 'titles.verification'],
  ['لوحة مخزون المندوبين', 'titles.admin_inventory'],
  ['إدارة المستودعات', 'titles.warehouses'],
  ['تفاصيل المستودع', 'titles.warehouse_details'],
  ['تفاصيل التحويل', 'titles.transfer_details'],
  ['لوحة العمليات', 'titles.operations'],
  ['تفاصيل العملية', 'titles.operation_details'],
  ['قسم المحاسبة', 'titles.accounting'],
  ['البيانات الخام', 'titles.courier_raw'],
  ['تفاصيل الطلب', 'titles.courier_request_detail'],
  ['تقارير PDF', 'titles.courier_pdf'],
  ['مراجعة تقرير PDF', 'titles.courier_pdf_review'],
  ['التقارير', 'titles.courier_reports'],
  ['تصدير Excel', 'titles.courier_export'],
  ['مراقبة الذكاء الاصطناعي', 'titles.courier_ai'],
  ['سجل التدقيق', 'titles.courier_audit'],
  ['مراقبة النظام والتتبع', 'titles.courier_observability'],
  ['إدارة المستخدمين والمناطق', 'titles.admin'],
  ['إدارة المستخدمين', 'titles.users'],
  ['إدارة النسخ الاحتياطية', 'titles.backup'],
  ['إدارة الأصناف', 'titles.item_types'],
  ['تفاصيل الصنف', 'titles.item_type_details'],
  ['تفاصيل المنتج', 'titles.product_details'],
  ['لوحة التحكم', 'titles.courier'],
  ['التحقق', 'titles.courier_requests'],
  ['الإعدادات', 'titles.courier_settings'],
];

for (const [ar, key] of map) {
  const needle = `, "${ar}")`;
  const repl = `, "${key}")`;
  c = c.split(needle).join(repl);
}

fs.writeFileSync(path, c);
const left = c.match(/withShell\([^)]*[\u0600-\u06FF][^)]*\)/g) || [];
console.log('remaining arabic withShell', left.length);
console.log(left.slice(0, 8));
console.log('home key ok', c.includes('titles.home'));
