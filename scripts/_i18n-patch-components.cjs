const fs = require('fs');
const path = require('path');

const patches = [
  {
    file: 'apps/portal/src/components/add-stock-modal.tsx',
    from: `          <DialogTitle>إضافة للمخزون</DialogTitle>
          <DialogDescription>
            إضافة كمية جديدة من "{selectedItem?.name}" إلى المخزون
          </DialogDescription>`,
    to: `          <DialogTitle>{t('inventory.add_to_stock')}</DialogTitle>
          <DialogDescription>
            {t('inventory.add_quantity_of', { name: selectedItem?.name })}
          </DialogDescription>`,
  },
  {
    file: 'apps/portal/src/components/dashboard/GlobalInventoryChart.tsx',
    from: `                المجموع: {(payload[0]?.value || 0) + (payload[1]?.value || 0) + (payload[2]?.value || 0)}`,
    to: `                {t('common.total_label', { total: (payload[0]?.value || 0) + (payload[1]?.value || 0) + (payload[2]?.value || 0) })}`,
  },
  {
    file: 'apps/portal/src/components/dashboard/stats-kpi-card.tsx',
    from: `              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% من الشهر الماضي`,
    to: `              {t('common.from_last_month', { direction: trend.isPositive ? '↑' : '↓', value: Math.abs(trend.value) })}`,
  },
  {
    file: 'apps/portal/src/components/edit-courier-execution-modal.tsx',
    from: `            إضافة {role === "device" ? "جهاز" : "شريحة"}`,
    to: `            {t('courier.add_role_item', { role: role === "device" ? t('courier.device_1') : t('courier.sim_1') })}`,
  },
  {
    file: 'apps/portal/src/components/edit-item-modal.tsx',
    from: `          <DialogTitle>تعديل الصنف</DialogTitle>
          <DialogDescription>
            تعديل بيانات "{selectedItem?.name}"
          </DialogDescription>`,
    to: `          <DialogTitle>{t('inventory.edit_item')}</DialogTitle>
          <DialogDescription>
            {t('inventory.edit_item_data', { name: selectedItem?.name })}
          </DialogDescription>`,
  },
  {
    file: 'apps/portal/src/components/header.tsx',
    from: `              <span className="hidden sm:inline">{t('common.system_4')}</span>إدارة المخزون`,
    to: `              <span className="hidden sm:inline">{t('common.system_4')} </span>{t('common.inventory_management')}`,
  },
  {
    file: 'apps/portal/src/components/inventory-table.tsx',
    from: `              هذا الإجراء لا يمكن التراجع عنه. سيتم حذف "{selectedItem?.name}" من المخزون نهائياً.`,
    to: `              {t('inventory.delete_item_confirm', { name: selectedItem?.name })}`,
  },
  {
    file: 'apps/portal/src/components/transfer-from-warehouse-modal.tsx',
    from: `            نقل أصناف من {warehouseName} إلى مندوب`,
    to: `            {t('warehouse.transfer_items_from', { name: warehouseName })}`,
  },
];

// Also add missing inventory keys
const root = 'apps/portal/src/i18n/locales';
function load(ns, lang) {
  return JSON.parse(fs.readFileSync(path.join(root, lang, ns + '.json'), 'utf8'));
}
function save(ns, lang, obj) {
  fs.writeFileSync(path.join(root, lang, ns + '.json'), JSON.stringify(obj, null, 2) + '\n');
}

const invAr = load('inventory', 'ar');
const invEn = load('inventory', 'en');
invAr.add_to_stock = invAr.add_to_stock || 'إضافة للمخزون';
invEn.add_to_stock = invEn.add_to_stock || 'Add to inventory';
invAr.edit_item = invAr.edit_item || 'تعديل الصنف';
invEn.edit_item = invEn.edit_item || 'Edit item';
save('inventory', 'ar', invAr);
save('inventory', 'en', invEn);

let ok = 0, fail = [];
for (const p of patches) {
  const full = path.resolve(p.file);
  let content = fs.readFileSync(full, 'utf8');
  if (!content.includes(p.from)) {
    fail.push({ file: p.file, snippet: p.from.slice(0, 120) });
    continue;
  }
  // ensure useLanguage/useTranslation if needed
  content = content.replace(p.from, p.to);
  fs.writeFileSync(full, content);
  ok++;
}
console.log(JSON.stringify({ ok, fail }, null, 2));
