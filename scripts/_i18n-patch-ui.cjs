const fs = require('fs');
const path = require('path');

const replacements = [
  // courier-audit-log
  {
    file: 'apps/portal/src/pages/courier/courier-audit-log.tsx',
    from: `{t('courier.completed_2')} <span className="font-semibold text-cyan-400">{total}</span> حركة نظام وتعديل.`,
    to: `{t('courier.audit_moves_summary', { total })}`.replace(
      '{ total }',
      '{ total: <span className="font-semibold text-cyan-400">{total}</span> }'
    ),
  },
];

// Better approach: patch files with exact string replacements
const patches = [
  {
    file: 'apps/portal/src/pages/courier/courier-audit-log.tsx',
    from: `        {t('courier.completed_2')} <span className="font-semibold text-cyan-400">{total}</span> حركة نظام وتعديل.`,
    to: `        {t('courier.audit_moves_summary', { total })}`,
  },
  {
    file: 'apps/portal/src/pages/courier/courier-pdf-review.tsx',
    from: `                    مرتبط بـ TID: {linkedRequestTid || t('courier.loading')}`,
    to: `                    {t('courier.linked_to_tid', { tid: linkedRequestTid || t('courier.loading') })}`,
  },
  {
    file: 'apps/portal/src/pages/courier/courier-raw-data.tsx',
    from: `            الصفحة {t('courier.item_4292', { count: page })}{totalPages} (إجمالي {t('courier.log_1', { count: total })})`,
    to: `            {t('courier.page_of_with_total', { page, totalPages, total })}`,
  },
  {
    file: 'apps/portal/src/pages/courier/courier-request-detail.tsx',
    from: `                        الجهاز ({deviceLookup?.technician?.fullName}) والشريحة ({simLookup?.technician?.fullName}) ينتميان لفنيين مختلفين.`,
    to: `                        {t('courier.device_sim_different_techs', { device: deviceLookup?.technician?.fullName, sim: simLookup?.technician?.fullName })}`,
  },
  {
    file: 'apps/portal/src/pages/courier/courier-request-detail.tsx',
    from: `                            ⚠ الخصم من عهدة: {deviceLookup.technician.fullName} — وليس من اسم التعيين.`,
    to: `                            {t('courier.deduct_from_custody_not_assignment', { name: deviceLookup.technician.fullName })}`,
  },
  {
    file: 'apps/portal/src/pages/courier/courier-request-detail.tsx',
    from: `              عند الحفظ بحالة t('courier.completed_5')، سيتم خصم كل الأجهزة والشرائح المُدخلة تلقائياً من عهدة الفني (Scan-Out).`,
    to: `              {t('courier.scan_out_on_complete', { status: t('courier.completed_5') })}`,
  },
  {
    file: 'apps/portal/src/pages/courier/courier-requests.tsx',
    from: `            {t('courier.total_review')} <span className="text-slate-200 font-medium">{total}</span> طلب`,
    to: `            {t('courier.total_review_with_count', { total })}`,
  },
  {
    file: 'apps/portal/src/pages/courier/courier-requests.tsx',
    from: `                الحالة: {status === "pending" ? t('courier.verification_3') : status}`,
    to: `                {t('courier.status_filter_label', { status: status === "pending" ? t('courier.verification_3') : status })}`,
  },
  {
    file: 'apps/portal/src/pages/courier/courier-requests.tsx',
    from: `          صفحة {t('courier.item_4292', { count: page })}{totalPages}`,
    to: `          {t('courier.page_of', { page, totalPages })}`,
  },
  {
    file: 'apps/portal/src/pages/dashboard.tsx',
    from: `              مرحباً بك مجدداً، {user?.fullName || t('dashboard.supervisor')}. إليك نظرة شاملة على عمليات المخزون ومؤشرات الأداء.`,
    to: `              {t('dashboard.welcome_back_overview', { name: user?.fullName || t('dashboard.supervisor') })}`,
  },
  {
    file: 'apps/portal/src/pages/dashboard.tsx',
    from: `            أهلاً بك، {user?.fullName || t('dashboard.technician')}. تابع عهدتك الثابتة والمتحركة وقدم طلبات المخزون الجديدة.`,
    to: `            {t('dashboard.welcome_tech_custody', { name: user?.fullName || t('dashboard.technician') })}`,
  },
];

let ok = 0, fail = [];
for (const p of patches) {
  const full = path.resolve(p.file);
  let content = fs.readFileSync(full, 'utf8');
  if (!content.includes(p.from)) {
    fail.push({ file: p.file, reason: 'not found', snippet: p.from.slice(0, 80) });
    continue;
  }
  content = content.replace(p.from, p.to);
  fs.writeFileSync(full, content);
  ok++;
}
console.log(JSON.stringify({ ok, fail }, null, 2));
