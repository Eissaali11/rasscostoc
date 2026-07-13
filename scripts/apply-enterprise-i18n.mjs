/**
 * SAFE enterprise i18n migration for StockPro portal.
 *
 * Converts remaining hardcoded Arabic UI strings in:
 *   apps/portal/src/pages, components, features
 * into t('namespace.key') with matching ar/en locale entries.
 *
 * SAFETY RULES:
 * 1. Never wrap expressions, URLs, handlers, imports, classNames, testids, non-Arabic
 * 2. Only JSX text, quoted UI string literals, and safe attrs (title/placeholder/aria-label/alt/description)
 * 3. Skip comment lines / block comments
 * 4. Skip ui/ primitives when Arabic is comment-only
 * 5. Skip already-translated t('...')
 * 6. Semantic keys from phrase map — never item_HASH for known phrases
 * 7. Rich phrase English (not word salad)
 * 8. Namespace by path
 * 9. Inject useTranslation carefully (never inside hooks)
 * 10. Merge into existing locale JSON
 * 11. Fix dir="rtl" → dir={dir} on page roots
 *
 * Usage: node scripts/apply-enterprise-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'apps/portal/src/i18n/locales');
const SCAN_ROOTS = [
  path.join(ROOT, 'apps/portal/src/pages'),
  path.join(ROOT, 'apps/portal/src/components'),
  path.join(ROOT, 'apps/portal/src/features'),
];

const NAMESPACES = [
  'common', 'dashboard', 'inventory', 'courier', 'warehouse',
  'users', 'reports', 'settings', 'errors', 'notifications',
  'verification', 'scanner', 'accounting',
];

const ARABIC_RE = /[\u0600-\u06FF]/;
const SAFE_ATTRS = new Set([
  'title', 'placeholder', 'aria-label', 'alt', 'description',
  'label', 'headerText', 'heading', 'tooltip', 'message', 'emptyText',
]);

const SKIP_ATTRS = new Set([
  'className', 'class', 'href', 'src', 'to', 'path', 'id', 'key',
  'data-testid', 'testid', 'onClick', 'onChange', 'onSubmit', 'onOpenChange',
  'style', 'type', 'role', 'htmlFor', 'name', 'value', 'defaultValue',
  'action', 'method', 'target', 'rel', 'download', 'autoComplete',
]);

// ---------------------------------------------------------------------------
// Phrase dictionary (Arabic → { key, en })
// ---------------------------------------------------------------------------
const PHRASE_MAP = {
  'خطأ': { key: 'error', en: 'Error' },
  'غير محدد': { key: 'unspecified', en: 'Unspecified' },
  'الحالة': { key: 'status', en: 'Status' },
  'التاريخ': { key: 'date', en: 'Date' },
  'الكمية يجب أن تكون صفر أو أكثر': { key: 'qty_must_be_zero_or_more', en: 'Quantity must be zero or greater' },
  'الكمية': { key: 'quantity', en: 'Quantity' },
  'الإجمالي': { key: 'total', en: 'Total' },
  'إلغاء': { key: 'cancel', en: 'Cancel' },
  'المدينة': { key: 'city', en: 'City' },
  'قيد المراجعة': { key: 'under_review', en: 'Under review' },
  'مرفوض': { key: 'rejected', en: 'Rejected' },
  'وحدات': { key: 'units', en: 'Units' },
  'مكتمل': { key: 'completed', en: 'Completed' },
  'كراتين': { key: 'cartons', en: 'Cartons' },
  'لا توجد بيانات': { key: 'no_data', en: 'No data available' },
  'جاري التحميل...': { key: 'loading_ellipsis', en: 'Loading...' },
  'جاري التحميل': { key: 'loading', en: 'Loading' },
  'الصنف': { key: 'item', en: 'Item' },
  'مرفوضة': { key: 'rejected_f', en: 'Rejected' },
  'حدث خطأ غير متوقع': { key: 'unexpected_error', en: 'An unexpected error occurred' },
  'إضافة': { key: 'add', en: 'Add' },
  'موبايلي': { key: 'mobily', en: 'Mobily' },
  'مستودع': { key: 'warehouse', en: 'Warehouse' },
  'تحديث': { key: 'update', en: 'Update' },
  'تنبيه': { key: 'alert', en: 'Alert' },
  'جاري الحفظ...': { key: 'saving', en: 'Saving...' },
  'زين': { key: 'zain', en: 'Zain' },
  'المخزون الثابت': { key: 'fixed_inventory', en: 'Fixed inventory' },
  'نشط': { key: 'active', en: 'Active' },
  'الإجراءات': { key: 'actions', en: 'Actions' },
  'حذف': { key: 'delete', en: 'Delete' },
  'أوراق رول': { key: 'roll_paper', en: 'Roll paper' },
  'شرائح موبايلي': { key: 'sims_mobily', en: 'Mobily SIMs' },
  'شرائح STC': { key: 'sims_stc', en: 'STC SIMs' },
  'شرائح زين': { key: 'sims_zain', en: 'Zain SIMs' },
  'ملصقات': { key: 'stickers', en: 'Stickers' },
  'المخزون المتحرك': { key: 'moving_inventory', en: 'Moving inventory' },
  'كرتون': { key: 'carton', en: 'Carton' },
  'ملاحظات': { key: 'notes', en: 'Notes' },
  'تم': { key: 'done', en: 'Done' },
  'النوع': { key: 'type', en: 'Type' },
  'المنطقة': { key: 'region', en: 'Region' },
  'مسح البحث': { key: 'clear_search', en: 'Clear search' },
  'غير مكتمل': { key: 'incomplete', en: 'Incomplete' },
  'المندوب': { key: 'technician', en: 'Technician' },
  'اسم المندوب': { key: 'technician_name', en: 'Technician name' },
  'بطاريات جديدة': { key: 'new_batteries', en: 'New batteries' },
  'المستودع': { key: 'the_warehouse', en: 'Warehouse' },
  'اسم المنتج': { key: 'product_name', en: 'Product name' },
  'الضريبة': { key: 'tax', en: 'Tax' },
  'المبيعات': { key: 'sales', en: 'Sales' },
  'رقم الفاتورة': { key: 'invoice_number', en: 'Invoice number' },
  'القيمة الخاضعة': { key: 'taxable_amount', en: 'Taxable amount' },
  'قيد الانتظار': { key: 'pending', en: 'Pending' },
  'الاسم الكامل': { key: 'full_name', en: 'Full name' },
  'تصدير Excel': { key: 'export_excel', en: 'Export Excel' },
  'شرائح ليبارا': { key: 'sims_lebara', en: 'Lebara SIMs' },
  'الرقم التسلسلي': { key: 'serial_number', en: 'Serial number' },
  'مقبول': { key: 'accepted', en: 'Accepted' },
  'رفض': { key: 'reject', en: 'Reject' },
  'مندوب': { key: 'tech', en: 'Technician' },
  'موافق عليها': { key: 'approved', en: 'Approved' },
  'تم التسليم': { key: 'delivered', en: 'Delivered' },
  'موجود': { key: 'present', en: 'Present' },
  'غير موجود': { key: 'missing', en: 'Missing' },
  'تالف': { key: 'damaged', en: 'Damaged' },
  'الوصف': { key: 'description', en: 'Description' },
  'مخزون ثابت': { key: 'fixed_stock', en: 'Fixed inventory' },
  'تصدير': { key: 'export', en: 'Export' },
  'اسم المستخدم': { key: 'username', en: 'Username' },
  'نعم': { key: 'yes', en: 'Yes' },
  'لا': { key: 'no', en: 'No' },
  'المستودع الرئيسي': { key: 'main_warehouse', en: 'Main warehouse' },
  'نوع العملية': { key: 'operation_type', en: 'Operation type' },
  'أجهزة N950': { key: 'devices_n950', en: 'N950 devices' },
  'تأكيد الرفض': { key: 'confirm_reject', en: 'Confirm rejection' },
  'قطعة': { key: 'piece', en: 'Piece' },
  'موافقة': { key: 'approve', en: 'Approve' },
  'المنتج': { key: 'product', en: 'Product' },
  'تم التصدير': { key: 'exported', en: 'Exported' },
  'إجراءات': { key: 'actions_short', en: 'Actions' },
  'تم التصدير بنجاح': { key: 'export_success', en: 'Exported successfully' },
  'المستخدم': { key: 'user', en: 'User' },
  'محلي': { key: 'local', en: 'Local' },
  'نوع الشريحة': { key: 'sim_type', en: 'SIM type' },
  'جهاز': { key: 'device', en: 'Device' },
  'أجهزة I9000s': { key: 'devices_i9000s', en: 'I9000s devices' },
  'أجهزة I9100': { key: 'devices_i9100', en: 'I9100 devices' },
  'الأجهزة': { key: 'devices', en: 'Devices' },
  'الكل': { key: 'all', en: 'All' },
  'شرائح': { key: 'sims', en: 'SIMs' },
  'بطاريات': { key: 'batteries', en: 'Batteries' },
  'سحب': { key: 'withdraw', en: 'Withdraw' },
  'غير متوفر': { key: 'unavailable', en: 'Unavailable' },
  'رأس الشاحن': { key: 'charger_head', en: 'Charger head' },
  'بطارية': { key: 'battery', en: 'Battery' },
  'ليبارا': { key: 'lebara', en: 'Lebara' },
  'لا توجد': { key: 'none_found', en: 'None' },
  'في المخزون': { key: 'in_stock', en: 'In stock' },
  'المبلغ': { key: 'amount', en: 'Amount' },
  'إنشاء': { key: 'create', en: 'Create' },
  'الدور': { key: 'role', en: 'Role' },
  'سحابي': { key: 'cloud', en: 'Cloud' },
  'تم الحذف بنجاح': { key: 'deleted_success', en: 'Deleted successfully' },
  'تعديل': { key: 'edit', en: 'Edit' },
  'تم الحفظ بنجاح': { key: 'saved_success', en: 'Saved successfully' },
  'العميل لا يرد': { key: 'customer_no_answer', en: 'Customer not answering' },
  'تحت الإجراء': { key: 'in_progress', en: 'In progress' },
  'منخفض': { key: 'low', en: 'Low' },
  'إجمالي الكمية': { key: 'total_qty', en: 'Total quantity' },
  'أوراق': { key: 'papers', en: 'Paper' },
  'إدارة الأصناف': { key: 'manage_items', en: 'Manage items' },
  'حفظ التعديلات': { key: 'save_changes', en: 'Save changes' },
  'الملصقات': { key: 'the_stickers', en: 'Stickers' },
  'طلب مخزون': { key: 'request_inventory', en: 'Request inventory' },
  'ورق': { key: 'paper', en: 'Paper' },
  'الحالة:': { key: 'status_colon', en: 'Status:' },
  'نوع التغليف': { key: 'packaging_type', en: 'Packaging type' },
  'مكتملة': { key: 'completed_f', en: 'Completed' },
  'نقل مخزون': { key: 'transfer_inventory', en: 'Transfer inventory' },
  'شريحة SIM': { key: 'sim_card', en: 'SIM card' },
  'كابل الشاحن': { key: 'charger_cable', en: 'Charger cable' },
  'ملصق': { key: 'sticker', en: 'Sticker' },
  'جيدة': { key: 'good', en: 'Good' },
  'متوسطة': { key: 'fair', en: 'Fair' },
  'اسم الصنف': { key: 'item_name', en: 'Item name' },
  'جاري التحديث...': { key: 'updating', en: 'Updating...' },
  'ضريبة المخرجات': { key: 'output_vat', en: 'Output VAT' },
  'ضريبة المدخلات': { key: 'input_vat', en: 'Input VAT' },
  'أفضل الموزعين': { key: 'top_distributors', en: 'Top distributors' },
  'عدد الفواتير': { key: 'invoice_count', en: 'Invoice count' },
  'المصدر': { key: 'source', en: 'Source' },
  'تفاصيل الأصناف': { key: 'item_details', en: 'Item details' },
  'عدد الأصناف': { key: 'item_count', en: 'Item count' },
  'من تاريخ': { key: 'from_date', en: 'From date' },
  'إلى تاريخ': { key: 'to_date', en: 'To date' },
  'مخزون متحرك': { key: 'moving_stock', en: 'Moving inventory' },
  'لا توجد بيانات للتصدير': { key: 'no_export_data', en: 'No data to export' },
  'غير نشط': { key: 'inactive', en: 'Inactive' },
  'إضافة مستخدم جديد': { key: 'add_new_user', en: 'Add new user' },
  'البريد الإلكتروني': { key: 'email', en: 'Email' },
  'التاريخ والوقت': { key: 'datetime', en: 'Date and time' },
  'مستخدم': { key: 'user_noun', en: 'User' },
  'التوقيت': { key: 'timestamp', en: 'Timestamp' },
  'لا توجد نتائج مطابقة': { key: 'no_matching_results', en: 'No matching results' },
  'تم الإضافة بنجاح': { key: 'added_success', en: 'Added successfully' },
  'نوع التركيب': { key: 'install_type', en: 'Installation type' },
  'العميل': { key: 'customer', en: 'Customer' },
  'يرجى تحديد حالة التركيب أولاً.': { key: 'select_install_status_first', en: 'Please select the installation status first.' },
  'شريحة': { key: 'sim', en: 'SIM' },
  'اختر النوع': { key: 'select_type', en: 'Select type' },
  'شرائح الاتصال': { key: 'connectivity_sims', en: 'Connectivity SIMs' },
  'صنف غير معروف': { key: 'unknown_item', en: 'Unknown item' },
  'تحذير': { key: 'warning', en: 'Warning' },
  'ملصقات مداى': { key: 'madaya_stickers', en: 'Madaya stickers' },
  'رجوع': { key: 'back', en: 'Back' },
  'المستودعات': { key: 'warehouses', en: 'Warehouses' },
  'الإجمالي الكلي': { key: 'grand_total', en: 'Grand total' },
  'إجمالي الأصناف': { key: 'total_items', en: 'Total items' },
  'أجهزة': { key: 'devices_short', en: 'Devices' },
  'تم الرفض': { key: 'was_rejected', en: 'Rejected' },
  'يجب إدخال سبب الرفض': { key: 'reject_reason_required', en: 'Rejection reason is required' },
  'اكتب سبب الرفض هنا...': { key: 'enter_reject_reason', en: 'Enter rejection reason here...' },
  'تفاصيل العملية': { key: 'operation_details', en: 'Operation details' },
  'ملاحظات:': { key: 'notes_colon', en: 'Notes:' },
  'تاريخ العملية': { key: 'operation_date', en: 'Operation date' },
  'سجل العمليات': { key: 'operations_log', en: 'Operations log' },
  'المستودع الوجهة': { key: 'dest_warehouse', en: 'Destination warehouse' },
  'السيريال نمبر': { key: 'serial_num', en: 'Serial number' },
  'وحدة': { key: 'unit', en: 'Unit' },
  'ملف التسليم': { key: 'delivery_file', en: 'Delivery file' },
  'ملاحظات المشرف': { key: 'supervisor_notes', en: 'Supervisor notes' },
  'البطارية': { key: 'the_battery', en: 'Battery' },
  'نقل': { key: 'transfer', en: 'Transfer' },
  'الرقم التسلسلي S/N': { key: 'serial_sn', en: 'Serial number (S/N)' },
  'رقم الجهاز (Terminal ID)': { key: 'terminal_id', en: 'Terminal ID' },
  'رأس شاحن': { key: 'charger_head_short', en: 'Charger head' },
  'تم التسليم للعميل': { key: 'delivered_to_customer', en: 'Delivered to customer' },
  'جاري الإضافة...': { key: 'adding', en: 'Adding...' },
  'أضف ملاحظات إضافية...': { key: 'add_extra_notes', en: 'Add additional notes...' },
  'سيئة': { key: 'poor', en: 'Poor' },
  'متوفر': { key: 'available', en: 'Available' },
  'تصفير': { key: 'zero_out', en: 'Reset to zero' },
  'فواتير المبيعات': { key: 'sales_invoices', en: 'Sales invoices' },
  'فواتير المشتريات': { key: 'purchase_invoices', en: 'Purchase invoices' },
  'القيمة': { key: 'value', en: 'Value' },
  'الحسابات النشطة': { key: 'active_accounts', en: 'Active accounts' },
  'إجمالي المبيعات': { key: 'total_sales', en: 'Total sales' },
  'إجمالي المشتريات': { key: 'total_purchases', en: 'Total purchases' },
  'الموزع': { key: 'distributor', en: 'Distributor' },
  'حركات الضريبة': { key: 'vat_transactions', en: 'VAT transactions' },
  'إجراء': { key: 'action', en: 'Action' },
  'ترحيل': { key: 'post', en: 'Post' },
  'الطريقة': { key: 'method', en: 'Method' },
  'الاعتماد': { key: 'approval', en: 'Approval' },
  'اختر المنطقة': { key: 'select_region', en: 'Select region' },
  'الوصف (اختياري)': { key: 'description_optional', en: 'Description (optional)' },
  'العملية': { key: 'operation', en: 'Operation' },
  'مرحل': { key: 'posted', en: 'Posted' },
  'مسودة': { key: 'draft', en: 'Draft' },
  'معلق': { key: 'on_hold', en: 'Pending' },
  'إعادة محاولة': { key: 'retrying', en: 'Retrying' },
  'مولد': { key: 'generated', en: 'Generated' },
  'الملخص': { key: 'overview', en: 'Overview' },
  'دليل الحسابات': { key: 'chart_of_accounts', en: 'Chart of accounts' },
  'القيود اليومية': { key: 'journal_entries', en: 'Journal entries' },
  'المدفوعات': { key: 'payments', en: 'Payments' },
  'الفاتورة الإلكترونية': { key: 'einvoice', en: 'E-invoice' },
  'التقارير': { key: 'reports', en: 'Reports' },
  'قبض': { key: 'receipt', en: 'Receipt' },
  'صرف': { key: 'disbursement', en: 'Disbursement' },
  'أخرى': { key: 'other', en: 'Other' },
  'تم تسجيل الدخول بنجاح': { key: 'login_success', en: 'Signed in successfully' },
  'خطأ في تسجيل الدخول': { key: 'login_error', en: 'Sign-in error' },
  'خطأ في بيانات الدخول، يرجى المحاولة مرة أخرى.': { key: 'invalid_credentials', en: 'Invalid credentials. Please try again.' },
  'تم تسجيل الخروج بنجاح': { key: 'logout_success', en: 'Signed out successfully' },
  'شكراً لك على استخدام النظام': { key: 'thanks_for_using', en: 'Thank you for using the system' },
  'حفظ': { key: 'save', en: 'Save' },
  'بحث': { key: 'search', en: 'Search' },
  'تصفية': { key: 'filter', en: 'Filter' },
  'استيراد': { key: 'import', en: 'Import' },
  'طباعة': { key: 'print', en: 'Print' },
  'تأكيد': { key: 'confirm', en: 'Confirm' },
  'إغلاق': { key: 'close', en: 'Close' },
  'التالي': { key: 'next', en: 'Next' },
  'السابق': { key: 'previous', en: 'Previous' },
  'الصفحة الرئيسية': { key: 'home', en: 'Home' },
  'الملف الشخصي': { key: 'profile', en: 'Profile' },
  'الإعدادات': { key: 'settings', en: 'Settings' },
  'الإشعارات': { key: 'notifications', en: 'Notifications' },
  'تسجيل الخروج': { key: 'logout', en: 'Sign out' },
  'غير مصرح لك بالوصول، يرجى تسجيل الدخول.': { key: 'unauthorized_login', en: 'You are not authorized. Please sign in.' },
  'تم استلام صفحة HTML بدل بيانات API. تأكد أن السيرفر يعمل وأن مسارات /api متاحة.': { key: 'html_instead_of_api', en: 'Received HTML instead of API data. Ensure the server is running and /api routes are available.' },
  'الاستجابة من السيرفر ليست JSON. غالبًا المسار المطلوب غير موجود أو لم يتم تحميل API بشكل صحيح.': { key: 'response_not_json', en: 'Server response is not JSON. The route may be missing or the API failed to load.' },
  'صافي الضريبة': { key: 'net_vat', en: 'Net VAT' },
  'إجمالي القبض': { key: 'total_receipts', en: 'Total receipts' },
  'إجمالي الصرف': { key: 'total_disbursements', en: 'Total disbursements' },
  'القيود المرحلة': { key: 'posted_journals', en: 'Posted journals' },
  'البند': { key: 'line_item', en: 'Item' },
  'ملخص': { key: 'summary', en: 'Summary' },
  'تقرير المحاسبة': { key: 'accounting_report', en: 'Accounting report' },
  'أفضل الأصناف': { key: 'top_items', en: 'Top items' },
  'تقرير أفضل الموزعين': { key: 'top_distributors_report', en: 'Top distributors report' },
  'تقرير أفضل الأصناف': { key: 'top_items_report', en: 'Top items report' },
  'الاتجاه': { key: 'direction', en: 'Direction' },
  'قيمة الضريبة': { key: 'tax_amount', en: 'Tax amount' },
  'ملخص عام': { key: 'general_summary', en: 'General summary' },
  'تقرير محاسبي شامل PDF': { key: 'full_accounting_pdf', en: 'Full accounting PDF report' },
  'تقرير الأفضل PDF': { key: 'top_performers_pdf', en: 'Top performers PDF report' },
  'تم تصدير التقرير بصيغة Excel بنجاح.': { key: 'excel_export_success', en: 'Report exported to Excel successfully.' },
  'تم تصدير التقرير بصيغة PDF بنجاح.': { key: 'pdf_export_success', en: 'Report exported to PDF successfully.' },
  'لا توجد بيانات كافية لتصدير تقرير الأفضل.': { key: 'insufficient_top_export', en: 'Not enough data to export the top performers report.' },
  'لا توجد بيانات كافية لتصدير تقرير PDF.': { key: 'insufficient_pdf_export', en: 'Not enough data to export the PDF report.' },
  'لا توجد فواتير مبيعات لتصديرها': { key: 'no_sales_invoices_export', en: 'No sales invoices to export' },
  'لا توجد فواتير مشتريات لتصديرها': { key: 'no_purchase_invoices_export', en: 'No purchase invoices to export' },
  'حفظ': { key: 'save', en: 'Save' },
  'بحث': { key: 'search', en: 'Search' },
};

// Load seed dictionary if present (extends phrase map with English only)
const seedPath = path.join(ROOT, 'scripts/_phrase-seed.json');
let seedEn = {};
if (fs.existsSync(seedPath)) {
  try {
    seedEn = JSON.parse(fs.readFileSync(seedPath, 'utf8')).curated || {};
  } catch { /* ignore */ }
}

// Word-level fallback for reasonable English (used only when phrase unknown)
const WORD_EN = {
  'لوحة': 'dashboard', 'التحكم': 'control', 'المخزون': 'inventory', 'المستودعات': 'warehouses',
  'المستودع': 'warehouse', 'مستودع': 'warehouse', 'الفنيين': 'technicians', 'المندوبين': 'technicians',
  'المندوب': 'technician', 'الفني': 'technician', 'التقارير': 'reports', 'تقرير': 'report',
  'الإعدادات': 'settings', 'المستخدمين': 'users', 'المستخدم': 'user', 'التحقق': 'verification',
  'الإشعارات': 'notifications', 'المحاسبة': 'accounting', 'المالية': 'finance',
  'تأكيد': 'confirm', 'إلغاء': 'cancel', 'حفظ': 'save', 'بحث': 'search', 'تصفية': 'filter',
  'عرض': 'view', 'حذف': 'delete', 'تعديل': 'edit', 'إضافة': 'add', 'رقم': 'number',
  'تاريخ': 'date', 'حالة': 'status', 'نشط': 'active', 'تفاصيل': 'details', 'تحميل': 'loading',
  'نعم': 'yes', 'لا': 'no', 'موافق': 'ok', 'إغلاق': 'close', 'تم': 'done', 'بنجاح': 'successfully',
  'خطأ': 'error', 'نوع': 'type', 'اسم': 'name', 'جهاز': 'device', 'أجهزة': 'devices',
  'شريحة': 'SIM', 'شرائح': 'SIMs', 'بطارية': 'battery', 'بطاريات': 'batteries',
  'ملصق': 'sticker', 'ملصقات': 'stickers', 'جديد': 'new', 'تحديث': 'update', 'سجل': 'log',
  'العمليات': 'operations', 'عملية': 'operation', 'تصدير': 'export', 'استيراد': 'import',
  'طلب': 'request', 'طلبات': 'requests', 'قبول': 'approve', 'رفض': 'reject', 'معلق': 'pending',
  'كمية': 'quantity', 'الكمية': 'quantity', 'إجمالي': 'total', 'ملاحظات': 'notes',
  'مدينة': 'city', 'منطقة': 'region', 'نظام': 'system', 'فشل': 'failed', 'نجاح': 'success',
  'تنبيه': 'alert', 'تحذير': 'warning', 'بيانات': 'data', 'قيمة': 'value', 'مكتمل': 'completed',
  'فاتورة': 'invoice', 'فواتير': 'invoices', 'مبيعات': 'sales', 'مشتريات': 'purchases',
  'ضريبة': 'tax', 'تحويل': 'transfer', 'سحب': 'withdraw', 'مرتجع': 'returned',
  'المرتجعة': 'returned', 'نسخ': 'backup', 'استعادة': 'restore', 'جاري': 'loading',
  'الانتظار': 'waiting', 'قيد': 'pending', 'غير': 'not', 'محدد': 'specified', 'موجود': 'present',
  'تالف': 'damaged', 'متوفر': 'available', 'منخفض': 'low', 'الكل': 'all', 'أخرى': 'other',
  'مرحل': 'posted', 'مسودة': 'draft', 'قبض': 'receipt', 'صرف': 'disbursement',
  'لا': 'no', 'توجد': 'found', 'يجب': 'must', 'أن': 'be', 'تكون': 'be', 'صفر': 'zero',
  'أو': 'or', 'أكثر': 'more', 'يرجى': 'please', 'تحديد': 'select', 'أولاً': 'first',
  'هنا': 'here', 'اكتب': 'enter', 'سبب': 'reason', 'الرفض': 'rejection',
};

// ---------------------------------------------------------------------------
// Locale DB helpers
// ---------------------------------------------------------------------------
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
  }
  return out;
}

function setNested(obj, dottedKey, value) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function loadLocales() {
  const db = { ar: {}, en: {}, reverse: new Map() };
  for (const ns of NAMESPACES) {
    const arPath = path.join(LOCALES_DIR, 'ar', `${ns}.json`);
    const enPath = path.join(LOCALES_DIR, 'en', `${ns}.json`);
    db.ar[ns] = fs.existsSync(arPath) ? JSON.parse(fs.readFileSync(arPath, 'utf8') || '{}') : {};
    db.en[ns] = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf8') || '{}') : {};
    const arFlat = flatten(db.ar[ns]);
    const enFlat = flatten(db.en[ns]);
    for (const [k, arVal] of Object.entries(arFlat)) {
      if (ARABIC_RE.test(arVal) && !db.reverse.has(arVal)) {
        db.reverse.set(arVal, { ns, key: k, en: enFlat[k] || '' });
      }
    }
  }
  return db;
}

function slugifyEnglish(en) {
  return en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'phrase';
}

function translateUnknown(arabic) {
  if (seedEn[arabic] && /[A-Za-z]/.test(seedEn[arabic]) && !seedEn[arabic].startsWith('item_')) {
    return seedEn[arabic];
  }
  // Prefer longest phrase-map substring matches for a readable sentence
  const parts = [];
  let rest = arabic;
  const sortedPhrases = Object.keys(PHRASE_MAP).sort((a, b) => b.length - a.length);
  while (rest.length) {
    let matched = false;
    for (const p of sortedPhrases) {
      if (rest.startsWith(p)) {
        parts.push(PHRASE_MAP[p].en);
        rest = rest.slice(p.length).replace(/^\s+/, '');
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const tokenMatch = rest.match(/^[\u0600-\u06FF]+/);
    if (tokenMatch) {
      const tok = tokenMatch[0];
      const bare = tok.startsWith('ال') && tok.length > 3 ? tok.slice(2) : tok;
      parts.push(WORD_EN[tok] || WORD_EN[bare] || tok);
      rest = rest.slice(tok.length).replace(/^\s+/, '');
      continue;
    }
    // keep punctuation / latin as-is
    const other = rest.match(/^[^\u0600-\u06FF]+/);
    if (other) {
      const chunk = other[0].trim();
      if (chunk) parts.push(chunk);
      rest = rest.slice(other[0].length);
      continue;
    }
    break;
  }
  const joined = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!joined || !/[A-Za-z]/.test(joined)) {
    // Last-resort readable placeholder — still semantic, not item_HASH
    return `Text: ${arabic.slice(0, 40)}`;
  }
  // Title-case first letter only for sentence feel
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

function resolveKey(arabic, ns, db, pending) {
  const text = arabic.trim();
  // 1) Exact reverse match in same ns
  const rev = db.reverse.get(text);
  if (rev && rev.ns === ns && rev.key && !/^item_\d+$/.test(rev.key.split('.').pop())) {
    return rev.key;
  }
  // 2) Phrase map semantic key
  if (PHRASE_MAP[text]) {
    const base = PHRASE_MAP[text].key;
    ensureLocale(db, pending, ns, base, text, PHRASE_MAP[text].en);
    return base;
  }
  // 3) Reverse match any ns — reuse key name if free in target ns
  if (rev && rev.key && !/^item_\d+$/.test(rev.key.split('.').pop())) {
    const localKey = rev.key.includes('.') ? rev.key.split('.').pop() : rev.key;
    const en = rev.en && !rev.en.startsWith('item_') ? rev.en : (PHRASE_MAP[text]?.en || translateUnknown(text));
    ensureLocale(db, pending, ns, localKey, text, en);
    return localKey;
  }
  // 4) Seed / unknown → semantic slug from English
  const en = PHRASE_MAP[text]?.en || translateUnknown(text);
  let base = slugifyEnglish(en);
  if (!base || base === 'phrase' || base.startsWith('item_') || base.startsWith('text_')) {
    // Stable semantic-ish key from content hash prefix — NOT item_HASH pattern for known map
    const h = createHash('sha1').update(text).digest('hex').slice(0, 8);
    base = `phrase_${h}`;
  }
  let key = base;
  let i = 1;
  while (true) {
    const existing = flatten(db.ar[ns])[key] ?? pending.ar[ns]?.[key];
    if (!existing || existing === text) break;
    key = `${base}_${i++}`;
  }
  ensureLocale(db, pending, ns, key, text, en);
  return key;
}

function ensureLocale(db, pending, ns, key, arVal, enVal) {
  const arFlat = flatten(db.ar[ns]);
  if (arFlat[key] === arVal) {
    // ensure en exists
    const enFlat = flatten(db.en[ns]);
    if (!enFlat[key] || enFlat[key].startsWith('item_')) {
      pending.en[ns] = pending.en[ns] || {};
      pending.en[ns][key] = enVal;
    }
    return;
  }
  pending.ar[ns] = pending.ar[ns] || {};
  pending.en[ns] = pending.en[ns] || {};
  pending.ar[ns][key] = arVal;
  pending.en[ns][key] = enVal;
  db.reverse.set(arVal, { ns, key, en: enVal });
}

function getNamespace(filePath) {
  const rel = filePath.replace(/\\/g, '/').toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  if (rel.includes('/courier/') || base.includes('courier')) return 'courier';
  if (base.includes('warehouse') || rel.includes('/warehouse')) return 'warehouse';
  if (base.includes('accounting')) return 'accounting';
  if (
    base.includes('inventory') || base.includes('technician') ||
    base.includes('product') || base.includes('item-type') || base.includes('item_type') ||
    base.includes('stock') || base.includes('add-item') || base.includes('add-stock')
  ) return 'inventory';
  if (
    base.includes('user') || base.includes('admin') || base.includes('profile') ||
    base.includes('employee') || base.includes('login')
  ) return 'users';
  if (base.includes('notification')) return 'notifications';
  if (base.includes('verification') || base.includes('received')) return 'verification';
  if (
    base.includes('report') || base.includes('withdrawn') || base.includes('log') ||
    base.includes('transaction')
  ) return 'reports';
  if (base.includes('dashboard') || base.includes('landing') || base.includes('operations')) return 'dashboard';
  if (base.includes('settings') || base.includes('backup') || base.includes('scanner')) {
    if (base.includes('scanner') || base.includes('smart-add') || base.includes('smart_add')) return 'scanner';
    return 'settings';
  }
  return 'common';
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

function isCommentOnlyLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/');
}

function stripLineComment(line) {
  const idx = line.indexOf('//');
  if (idx === -1) return { code: line, comment: '' };
  const before = line.slice(0, idx);
  const dq = (before.match(/"/g) || []).length;
  const sq = (before.match(/'/g) || []).length;
  const bq = (before.match(/`/g) || []).length;
  if (dq % 2 === 0 && sq % 2 === 0 && bq % 2 === 0) {
    return { code: before, comment: line.slice(idx) };
  }
  return { code: line, comment: '' };
}

function looksLikeUrl(s) {
  return /https?:\/\//i.test(s) || s.startsWith('/') && !ARABIC_RE.test(s.slice(0, 3));
}

function isInsideTCall(code, matchIndex) {
  // crude: if `t(` appears before match without closing on same segment
  const before = code.slice(Math.max(0, matchIndex - 80), matchIndex);
  return /\bt\(\s*['"`][^'"`]*$/.test(before) || /\bt\(\s*$/.test(before);
}

function processFileContent(content, ns, db, pending) {
  const lines = content.split('\n');
  let modified = false;
  let conversions = 0;
  let inBlockComment = false;

  const newLines = lines.map((line) => {
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      return line;
    }
    if (line.trim().startsWith('/*')) {
      if (!line.includes('*/')) inBlockComment = true;
      return line;
    }
    if (isCommentOnlyLine(line)) return line;
    if (!ARABIC_RE.test(line)) return line;
    // Skip imports
    if (/^\s*import\s/.test(line)) return line;
    // Skip already fully translated lines that only have Arabic inside locale JSON-like noise
    if (/^\s*\/\/.*[\u0600-\u06FF]/.test(line)) return line;

    const { code, comment } = stripLineComment(line);
    let codePart = code;
    let changed = false;

    // 1) JSX text nodes on one line: >عربي<
    codePart = codePart.replace(/>([^<{]*[\u0600-\u06FF]+[^<{]*)</g, (match, inner) => {
      const text = inner.trim();
      if (!text || text.includes('{') || text.includes('}')) return match;
      if (/\bt\s*\(/.test(text)) return match;
      const key = resolveKey(text, ns, db, pending);
      changed = true;
      conversions++;
      const lead = inner.match(/^\s*/)[0];
      const trail = inner.match(/\s*$/)[0];
      return `>${lead}{t('${ns}.${key}')}${trail}<`;
    });

    // 1b) Multi-line JSX text-only lines (common remaining gap):
    //     <p>\n  نص عربي هنا.\n</p>
    {
      const m = codePart.match(/^(\s*)([^<>{}=\n]*[\u0600-\u06FF][^<>{}=\n]*?)\s*$/);
      if (m) {
        const indent = m[1];
        const text = m[2].trim();
        // Avoid converting code-ish lines
        if (
          text &&
          !/\bt\s*\(/.test(text) &&
          !/^(import|export|return|const|let|var|function|if|else|for|while|switch|case|throw|new)\b/.test(text) &&
          !text.includes('://') &&
          !/^\s*[{[`]/.test(text)
        ) {
          const key = resolveKey(text, ns, db, pending);
          codePart = `${indent}{t('${ns}.${key}')}`;
          changed = true;
          conversions++;
        }
      }
    }

    // 1c) JSX mixed: {expr} عربي   or   عربي {expr}  (simple identifier/call expr only)
    if (!changed) {
      const suffix = codePart.match(/^(\s*)\{\s*([a-zA-Z_][\w.?]*)\s*\}\s*([\u0600-\u06FF][^<>{}]*?)\s*$/);
      if (suffix) {
        const [, indent, expr, arabic] = suffix;
        const text = `{{count}} ${arabic.trim()}`;
        const key = resolveKey(text, ns, db, pending);
        codePart = `${indent}{t('${ns}.${key}', { count: ${expr} })}`;
        changed = true;
        conversions++;
      } else {
        const prefix = codePart.match(/^(\s*)([\u0600-\u06FF][^<>{}]*?)\s*\{\s*([a-zA-Z_][\w.?]*)\s*\}\s*$/);
        if (prefix) {
          const [, indent, arabic, expr] = prefix;
          const text = `${arabic.trim()} {{count}}`;
          const key = resolveKey(text, ns, db, pending);
          codePart = `${indent}{t('${ns}.${key}', { count: ${expr} })}`;
          changed = true;
          conversions++;
        }
      }
    }

    // 1d) JSX: نص ({expr})  e.g. الكل ({arNumber(n)})
    if (!changed) {
      const m = codePart.match(/^(\s*)([\u0600-\u06FF][^<>{}]*?)\s*\(\s*\{\s*([^}]+)\s*\}\s*\)\s*$/);
      if (m) {
        const [, indent, arabic, expr] = m;
        const text = `${arabic.trim()} ({{count}})`;
        const key = resolveKey(text, ns, db, pending);
        codePart = `${indent}{t('${ns}.${key}', { count: ${expr} })}`;
        changed = true;
        conversions++;
      }
    }

    // 1e) Complex expr + Arabic suffix on same JSX line:
    //     {foo?.bar ?? baz} نسخة محفوظة
    //     {pct}% ثقة
    if (!changed) {
      const m = codePart.match(/^(\s*)(\{(?:[^{}]|\{[^{}]*\})*\})([^\n<>{}]*[\u0600-\u06FF][^\n<>{}]*)\s*$/);
      if (m) {
        const [, indent, exprBlock, rest] = m;
        const restTrim = rest.trim();
        if (restTrim && !restTrim.includes('t(')) {
          const phrase = restTrim.startsWith('%')
            ? `{{count}}${restTrim}`
            : `{{count}} ${restTrim}`;
          const key = resolveKey(phrase, ns, db, pending);
          const expr = exprBlock.slice(1, -1).trim();
          codePart = `${indent}{t('${ns}.${key}', { count: ${expr} })}`;
          changed = true;
          conversions++;
        }
      }
    }

    // 1f) Icon/element then Arabic text sibling: <Plus ... /> إضافة جهاز
    if (!changed) {
      const m = codePart.match(/^(\s*)(<[A-Z][^>]*\/>)\s*([\u0600-\u06FF][^<>{}]*?)\s*$/);
      if (m) {
        const [, indent, el, arabic] = m;
        const key = resolveKey(arabic.trim(), ns, db, pending);
        codePart = `${indent}${el}{t('${ns}.${key}')}`;
        changed = true;
        conversions++;
      }
    }

    // 1g) Arabic prefix then nested span (keep span): نص: <span>...</span>
    // Convert only the Arabic label portion before the tag.
    if (!changed) {
      const m = codePart.match(/^(\s*)([\u0600-\u06FF][^<>{}]*?)\s*(<[a-zA-Z][\s\S]*)$/);
      if (m) {
        const [, indent, arabic, restHtml] = m;
        const key = resolveKey(arabic.trim(), ns, db, pending);
        codePart = `${indent}{t('${ns}.${key}')} ${restHtml}`;
        changed = true;
        conversions++;
      }
    }

    // 2) Safe attributes: title="عربي" / title='عربي'
    codePart = codePart.replace(
      /\b([a-zA-Z_][\w-]*)\s*=\s*(["'])([^"'`]*[\u0600-\u06FF]+[^"'`]*)\2/g,
      (match, attr, quote, val, offset) => {
        if (SKIP_ATTRS.has(attr) || SKIP_ATTRS.has(attr.toLowerCase())) return match;
        if (!SAFE_ATTRS.has(attr) && !SAFE_ATTRS.has(attr.toLowerCase())) {
          // allow bare object-ish labels only when attr is clearly UI
          return match;
        }
        const text = val.trim();
        if (!text || looksLikeUrl(text)) return match;
        if (isInsideTCall(codePart, offset)) return match;
        const key = resolveKey(text, ns, db, pending);
        changed = true;
        conversions++;
        return `${attr}={t('${ns}.${key}')}`;
      }
    );

    // 3) Quoted Arabic string literals (UI): "عربي" / 'عربي'
    // Skip if already inside t(, className=, data-testid=, href=, import
    codePart = codePart.replace(/(["'])([^"'\\\n]*[\u0600-\u06FF]+[^"'\\\n]*)\1/g, (match, quote, val, offset) => {
      const text = val.trim();
      if (!text) return match;
      if (looksLikeUrl(text)) return match;
      if (isInsideTCall(codePart, offset)) return match;

      const before = codePart.slice(Math.max(0, offset - 40), offset);
      // skip className / testid / href / src / import from
      if (/\b(className|class|href|src|to|data-testid|testid|htmlFor|id)\s*=\s*$/.test(before)) return match;
      if (/from\s*$/.test(before) || /import\s*$/.test(before)) return match;
      // skip regex
      if (/\/$/.test(before.trimEnd()) || before.includes('new RegExp')) return match;
      // skip if this is an attribute we don't want (name=, value= for non-UI)
      if (/\b(name|value|defaultValue|type|role|key|autoComplete)\s*=\s*$/.test(before)) return match;

      const key = resolveKey(text, ns, db, pending);
      changed = true;
      conversions++;
      return `t('${ns}.${key}')`;
    });

    // 4) Pure backtick Arabic without interpolation
    codePart = codePart.replace(/`([^`$\n]*[\u0600-\u06FF]+[^`$\n]*)`/g, (match, inner) => {
      if (inner.includes('${')) return match;
      const text = inner.trim();
      if (!text) return match;
      const key = resolveKey(text, ns, db, pending);
      changed = true;
      conversions++;
      return `t('${ns}.${key}')`;
    });

    // 4b) Simple interpolated backticks (no HTML): `تقرير_${date}.xlsx`
    if (!changed && codePart.includes('`') && ARABIC_RE.test(codePart) && !codePart.includes('<')) {
      codePart = codePart.replace(/`([^`]*[\u0600-\u06FF]+[^`]*)`/g, (match, inner) => {
        if (!inner.includes('${')) return match;
        if (/<\/?[a-zA-Z]/.test(inner)) return match; // HTML template — skip
        let placeholderText = inner;
        const variables = [];
        const varRe = /\$\{([^}]+)\}/g;
        let vm;
        let idx = 0;
        while ((vm = varRe.exec(inner)) !== null) {
          const name = `var_${idx++}`;
          placeholderText = placeholderText.replace(vm[0], `{{${name}}}`);
          variables.push({ name, expr: vm[1] });
        }
        const key = resolveKey(placeholderText, ns, db, pending);
        changed = true;
        conversions++;
        const args = variables.map((v) => `${v.name}: ${v.expr}`).join(', ');
        return `t('${ns}.${key}', { ${args} })`;
      });
    }

    if (changed) {
      modified = true;
      return codePart + comment;
    }
    return line;
  });

  return { content: newLines.join('\n'), modified, conversions };
}

function ensureImport(content) {
  if (/useTranslation|useLanguage/.test(content)) return content;
  // Prefer @/lib/language (re-exports i18n)
  if (/^import .+$/m.test(content)) {
    return content.replace(/^(import .+;\s*\n)/m, (m) => `${m}import { useTranslation } from "@/lib/language";\n`);
  }
  return `import { useTranslation } from "@/lib/language";\n${content}`;
}

function hasTFromHook(fnBody) {
  return /useTranslation\s*\(|useLanguage\s*\(/.test(fnBody.slice(0, 1200));
}

function findMatchingBrace(content, start) {
  let depth = 1;
  let inStr = null;
  let escape = false;
  for (let i = start; i < content.length; i++) {
    const ch = content[i];
    if (inStr) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return content.length;
}

function injectHookIntoComponents(content, needDir) {
  // Inject into PascalCase / default-export components that call t( or use dir={dir}.
  // Never targets useMemo/useCallback/useEffect (those are camelCase callees).
  const patterns = [
    /export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{/g,
    /export\s+function\s+[A-Z]\w*\s*\([^)]*\)\s*\{/g,
    /function\s+[A-Z]\w*\s*\([^)]*\)\s*\{/g,
    /const\s+[A-Z]\w*\s*=\s*\([^)]*\)\s*=>\s*\{/g,
    /const\s+[A-Z]\w*\s*=\s*function\s*\([^)]*\)\s*\{/g,
    /export\s+default\s+function\s*\([^)]*\)\s*\{/g,
  ];

  const injections = [];

  for (const re of patterns) {
    let m;
    const r = new RegExp(re.source, 'g');
    while ((m = r.exec(content)) !== null) {
      const start = m.index + m[0].length;
      const end = findMatchingBrace(content, start);
      const body = content.slice(start, end);
      const usesT = /\bt\s*\(\s*['"`]/.test(body);
      const usesDir = /dir=\{dir\}/.test(body);
      if (!usesT && !(needDir && usesDir)) continue;

      if (hasTFromHook(body)) {
        if (needDir && usesDir) {
          const hookRe = /const\s*\{([^}]*)\}\s*=\s*use(?:Translation|Language)\s*\(\s*\)/;
          const hm = body.match(hookRe);
          if (hm && !/\bdir\b/.test(hm[1])) {
            const fields = hm[1].split(',').map((s) => s.trim()).filter(Boolean);
            if (!fields.includes('t')) fields.push('t');
            if (!fields.includes('dir')) fields.push('dir');
            const replacement = `const { ${fields.join(', ')} } = useTranslation()`;
            const abs = start + body.indexOf(hm[0]);
            // preserve trailing semicolon if present in original
            const withSemi = body.slice(body.indexOf(hm[0]), body.indexOf(hm[0]) + hm[0].length).endsWith(';')
              ? replacement + ';'
              : replacement;
            injections.push({ index: abs, length: hm[0].length, text: withSemi.includes('useTranslation') ? (hm[0].includes('useLanguage') ? `const { ${fields.join(', ')} } = useLanguage()` + (hm[0].endsWith(';') ? ';' : '') : withSemi) : withSemi });
          }
        }
        continue;
      }

      const destructure = (needDir && usesDir)
        ? 'const { t, dir } = useTranslation();'
        : 'const { t } = useTranslation();';
      injections.push({ index: start, length: 0, text: `\n  ${destructure}` });
    }
  }

  injections.sort((a, b) => b.index - a.index);
  let out = content;
  const seen = new Set();
  for (const inj of injections) {
    const sig = `${inj.index}:${inj.length}:${inj.text}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out = out.slice(0, inj.index) + inj.text + out.slice(inj.index + inj.length);
  }
  return out;
}

function fixDirRtl(content, isPage) {
  if (!isPage) return { content, changed: false };
  if (!/dir=["']rtl["']/.test(content)) return { content, changed: false };
  // Replace page-level dir="rtl" with dir={dir}
  const next = content.replace(/dir=["']rtl["']/g, 'dir={dir}');
  return { content: next, changed: next !== content };
}

function mergePending(db, pending) {
  for (const ns of NAMESPACES) {
    for (const [k, v] of Object.entries(pending.ar[ns] || {})) {
      setNested(db.ar[ns], k, v);
    }
    for (const [k, v] of Object.entries(pending.en[ns] || {})) {
      setNested(db.en[ns], k, v);
    }
  }
}

function writeLocales(db) {
  for (const ns of NAMESPACES) {
    fs.writeFileSync(path.join(LOCALES_DIR, 'ar', `${ns}.json`), JSON.stringify(db.ar[ns], null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(LOCALES_DIR, 'en', `${ns}.json`), JSON.stringify(db.en[ns], null, 2) + '\n', 'utf8');
  }
}

function ensureBaselineLocales(db) {
  const baselines = {
    settings: {
      ar: {
        title: 'الإعدادات',
        general: 'إعدادات عامة',
        language: 'اللغة',
        appearance: 'المظهر',
        notifications: 'إعدادات الإشعارات',
        security: 'الأمان',
        backup: 'النسخ الاحتياطي',
        backup_create: 'إنشاء نسخة احتياطية',
        backup_restore: 'استعادة نسخة احتياطية',
        backup_download: 'تنزيل النسخة',
        backup_success: 'تم إنشاء النسخة الاحتياطية بنجاح',
        backup_restore_success: 'تمت الاستعادة بنجاح',
        save: 'حفظ الإعدادات',
        saved: 'تم حفظ الإعدادات',
        cloud: 'سحابي',
        local: 'محلي',
      },
      en: {
        title: 'Settings',
        general: 'General settings',
        language: 'Language',
        appearance: 'Appearance',
        notifications: 'Notification settings',
        security: 'Security',
        backup: 'Backup',
        backup_create: 'Create backup',
        backup_restore: 'Restore backup',
        backup_download: 'Download backup',
        backup_success: 'Backup created successfully',
        backup_restore_success: 'Restore completed successfully',
        save: 'Save settings',
        saved: 'Settings saved',
        cloud: 'Cloud',
        local: 'Local',
      },
    },
    errors: {
      ar: {
        unexpected: 'حدث خطأ غير متوقع',
        network: 'تعذر الاتصال بالخادم',
        unauthorized: 'غير مصرح لك بالوصول',
        forbidden: 'ليس لديك صلاحية لهذا الإجراء',
        not_found: 'العنصر غير موجود',
        validation: 'يرجى التحقق من البيانات المدخلة',
        save_failed: 'فشل الحفظ',
        delete_failed: 'فشل الحذف',
        load_failed: 'فشل تحميل البيانات',
        timeout: 'انتهت مهلة الطلب',
        try_again: 'يرجى المحاولة مرة أخرى',
      },
      en: {
        unexpected: 'An unexpected error occurred',
        network: 'Unable to reach the server',
        unauthorized: 'You are not authorized',
        forbidden: 'You do not have permission for this action',
        not_found: 'Item not found',
        validation: 'Please check the entered data',
        save_failed: 'Save failed',
        delete_failed: 'Delete failed',
        load_failed: 'Failed to load data',
        timeout: 'Request timed out',
        try_again: 'Please try again',
      },
    },
    scanner: {
      ar: {
        title: 'الماسح الضوئي',
        scan: 'مسح',
        scanning: 'جاري المسح...',
        scan_serial: 'امسح الرقم التسلسلي',
        serial_placeholder: 'أدخل أو امسح السيريال',
        success: 'تم المسح بنجاح',
        invalid: 'رمز غير صالح',
        duplicate: 'سيريال مكرر',
        not_found: 'السيريال غير موجود',
        camera_permission: 'يلزم السماح بالكاميرا للمسح',
        manual_entry: 'إدخال يدوي',
        verify: 'تحقق',
        clear: 'مسح الحقل',
      },
      en: {
        title: 'Scanner',
        scan: 'Scan',
        scanning: 'Scanning...',
        scan_serial: 'Scan serial number',
        serial_placeholder: 'Enter or scan serial',
        success: 'Scan successful',
        invalid: 'Invalid code',
        duplicate: 'Duplicate serial',
        not_found: 'Serial not found',
        camera_permission: 'Camera permission is required to scan',
        manual_entry: 'Manual entry',
        verify: 'Verify',
        clear: 'Clear field',
      },
    },
  };

  for (const [ns, { ar, en }] of Object.entries(baselines)) {
    const arEmpty = !db.ar[ns] || Object.keys(db.ar[ns]).length === 0;
    const enEmpty = !db.en[ns] || Object.keys(db.en[ns]).length === 0;
    if (arEmpty) db.ar[ns] = { ...ar };
    else {
      for (const [k, v] of Object.entries(ar)) {
        if (db.ar[ns][k] === undefined) db.ar[ns][k] = v;
      }
    }
    if (enEmpty) db.en[ns] = { ...en };
    else {
      for (const [k, v] of Object.entries(en)) {
        if (db.en[ns][k] === undefined) db.en[ns][k] = v;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const db = loadLocales();
  ensureBaselineLocales(db);

  const pending = { ar: {}, en: {} };
  for (const ns of NAMESPACES) {
    pending.ar[ns] = {};
    pending.en[ns] = {};
  }

  const files = SCAN_ROOTS.flatMap((r) => walk(r));
  let filesModified = 0;
  let totalConversions = 0;
  let dirFixes = 0;

  for (const filePath of files) {
    const rel = filePath.replace(/\\/g, '/');
    const isUi = rel.includes('/components/ui/');
    let raw = fs.readFileSync(filePath, 'utf8');

    // ui primitives: skip if Arabic only in comments
    if (isUi) {
      const withoutComments = raw
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      if (!ARABIC_RE.test(withoutComments)) continue;
    }

    // Skip .ts helpers handled by walk (tsx only)

    const ns = getNamespace(filePath);
    const isPage = rel.includes('/pages/');

    const dirResult = fixDirRtl(raw, isPage);
    if (dirResult.changed) {
      raw = dirResult.content;
      dirFixes++;
    }

    const { content: processed, modified, conversions } = processFileContent(raw, ns, db, pending);

    if (!modified && !dirResult.changed) continue;

    let finalContent = processed;
    if (conversions > 0 || dirResult.changed) {
      finalContent = ensureImport(finalContent);
      finalContent = injectHookIntoComponents(finalContent, dirResult.changed);
    }

    fs.writeFileSync(filePath, finalContent, 'utf8');
    filesModified++;
    totalConversions += conversions;
    console.log(`✓ ${path.relative(ROOT, filePath)} (+${conversions}${dirResult.changed ? ', dir' : ''})`);
  }

  mergePending(db, pending);
  writeLocales(db);

  const newKeys = NAMESPACES.reduce((n, ns) => n + Object.keys(pending.ar[ns] || {}).length, 0);
  console.log('\n=== apply-enterprise-i18n summary ===');
  console.log(`Files modified: ${filesModified}`);
  console.log(`Conversions:    ${totalConversions}`);
  console.log(`dir={dir} fixes: ${dirFixes}`);
  console.log(`New locale keys: ${newKeys}`);
}

main();
