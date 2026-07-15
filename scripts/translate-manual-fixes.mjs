import fs from 'fs';
import path from 'path';

const LOCALES_DIR = './apps/portal/src/i18n/locales';

const fixes = [
  {
    file: './apps/portal/src/pages/technician-item-details.tsx',
    replacements: [
      {
        target: 'renderDetailItem("الرقم التسلسلي S/N", selectedRow.raw?.serialNumber, true)',
        replace: 'renderDetailItem(t(\'inventory.serial_sn\'), selectedRow.raw?.serialNumber, true)',
        ar: { serial_sn: 'الرقم التسلسلي S/N' },
        en: { serial_sn: 'Serial Number S/N' }
      },
      {
        target: 'renderDetailItem("رقم الجهاز (Terminal ID)", selectedRow.raw?.terminalId || "-", true)',
        replace: 'renderDetailItem(t(\'inventory.terminal_id\'), selectedRow.raw?.terminalId || "-", true)',
        ar: { terminal_id: 'رقم الجهاز (Terminal ID)' },
        en: { terminal_id: 'Terminal ID (TID)' }
      },
      {
        target: 'renderDetailItem("كود التحقق الثنائي OTP", "OTP-4820", true)',
        replace: 'renderDetailItem(t(\'inventory.otp_code\'), "OTP-4820", true)',
        ar: { otp_code: 'كود التحقق الثنائي OTP' },
        en: { otp_code: 'OTP Verification Code' }
      },
      {
        target: 'selectedRow.raw?.hasSim ? `شريحة ${selectedRow.raw?.simCardType || "SIM"}` : "شريحة SIM"',
        replace: 'selectedRow.raw?.hasSim ? t(\'inventory.sim_card_with_type\', { type: selectedRow.raw?.simCardType || "SIM" }) : t(\'inventory.sim_card\')',
        ar: { sim_card_with_type: 'شريحة {{type}}', sim_card: 'شريحة SIM' },
        en: { sim_card_with_type: '{{type}} SIM Card', sim_card: 'SIM Card' }
      }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/pages/transfer-details.tsx',
    replacements: [
      {
        target: 'stcSim: "شرائح STC"',
        replace: 'stcSim: t(\'inventory.stc_sims\')',
        ar: { stc_sims: 'شرائح STC' },
        en: { stc_sims: 'STC SIM Cards' }
      },
      {
        target: 'التاريخ: {new Date(transferDetail.createdAt).toLocaleDateString(\'en-US\', {',
        replace: 't(\'common.date\')}: {new Date(transferDetail.createdAt).toLocaleDateString(\'en-US\', {'
      },
      {
        target: 'الوقت: {new Date(transferDetail.createdAt).toLocaleTimeString(\'en-US\', {',
        replace: 't(\'common.time\')}: {new Date(transferDetail.createdAt).toLocaleTimeString(\'en-US\', {'
      }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/pages/users.tsx',
    replacements: [
      {
        target: '{user.isActive ? \'✓ نشط\' : \'✗ غير نشط\'}',
        replace: '{user.isActive ? t(\'users.status_active_symbol\') : t(\'users.status_inactive_symbol\')}',
        ar: { status_active_symbol: '✓ نشط', status_inactive_symbol: '✗ غير نشط' },
        en: { status_active_symbol: '✓ Active', status_inactive_symbol: '✗ Inactive' }
      }
    ],
    ns: 'users'
  },
  {
    file: './apps/portal/src/pages/verification.tsx',
    replacements: [
      {
        target: 'return { label: "أجهزة POS", icon: Smartphone, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };',
        replace: 'return { label: t(\'verification.pos_devices\'), icon: Smartphone, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };',
        ar: { pos_devices: 'أجهزة POS' },
        en: { pos_devices: 'POS Devices' }
      },
      {
        target: 'return { label: "ملحقات / شواحن", icon: Cable, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };',
        replace: 'return { label: t(\'verification.accessories_chargers\'), icon: Cable, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };',
        ar: { accessories_chargers: 'ملحقات / شواحن' },
        en: { accessories_chargers: 'Accessories / Chargers' }
      }
    ],
    ns: 'verification'
  },
  {
    file: './apps/portal/src/pages/warehouse-details.tsx',
    replacements: [
      {
        target: 'description: "تم تصدير بيانات المستودع إلى ملف Excel",',
        replace: 'description: t(\'warehouse.exported_to_excel\'),',
        ar: { exported_to_excel: 'تم تصدير بيانات المستودع إلى ملف Excel' },
        en: { exported_to_excel: 'Warehouse data exported to Excel file' }
      }
    ],
    ns: 'warehouse'
  },
  {
    file: './apps/portal/src/pages/warehouses.tsx',
    replacements: [
      {
        target: 'description: "تم حفظ ملف Excel في جهازك"',
        replace: 'description: t(\'warehouse.excel_saved_device\')',
        ar: { excel_saved_device: 'تم حفظ ملف Excel في جهازك' },
        en: { excel_saved_device: 'Excel file saved to your device' }
      },
      {
        target: '{warehouse.isActive ? "● نشط" : "○ غير نشط"}',
        replace: '{warehouse.isActive ? t(\'warehouse.status_active_dot\') : t(\'warehouse.status_inactive_dot\')}',
        ar: { status_active_dot: '● نشط', status_inactive_dot: '○ غير نشط' },
        en: { status_active_dot: '● Active', status_inactive_dot: '○ Inactive' }
      }
    ],
    ns: 'warehouse'
  },
  {
    file: './apps/portal/src/pages/withdrawn-devices-all.tsx',
    replacements: [
      {
        target: '<span>بطارية ({device.battery})</span>',
        replace: '<span>{t(\'inventory.battery_with_val\', { val: device.battery })}</span>',
        ar: { battery_with_val: 'بطارية ({{val}})' },
        en: { battery_with_val: 'Battery ({{val}})' }
      }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/pages/withdrawn-devices.tsx',
    replacements: [
      {
        target: '{analytics.monthlyDelta >= 0 ? "+" : ""}{analytics.monthlyDelta}% عن الشهر السابق',
        replace: '{analytics.monthlyDelta >= 0 ? "+" : ""}{analytics.monthlyDelta}% {t(\'inventory.compared_to_previous_month\')}',
        ar: { compared_to_previous_month: 'عن الشهر السابق' },
        en: { compared_to_previous_month: 'compared to previous month' }
      }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/pages/WithdrawnDeviceDetails.tsx',
    replacements: [
      {
        target: 'description: "تم تنزيل تقرير PDF المنسق لتفاصيل العملية.",',
        replace: 'description: t(\'reports.pdf_download_success\'),',
        ar: { pdf_download_success: 'تم تنزيل تقرير PDF المنسق لتفاصيل العملية.' },
        en: { pdf_download_success: 'Formatted PDF report downloaded successfully.' }
      },
      {
        target: '<h2 className="text-2xl font-bold text-white">تفاصيل الجهاز المسحوب : #{device.terminalId}</h2>',
        replace: '<h2 className="text-2xl font-bold text-white">{t(\'inventory.withdrawn_device_details_id\', { id: device.terminalId })}</h2>',
        ar: { withdrawn_device_details_id: 'تفاصيل الجهاز المسحوب : #{{id}}' },
        en: { withdrawn_device_details_id: 'Withdrawn Device Details: #{{id}}' }
      },
      {
        target: '{[hasBattery, hasCable, hasHead, hasSim].filter(Boolean).length} من 4 متوفرة',
        replace: 't(\'inventory.accessories_available_count\', { count: [hasBattery, hasCable, hasHead, hasSim].filter(Boolean).length })',
        ar: { accessories_available_count: '{{count}} من ٤ متوفرة' },
        en: { accessories_available_count: '{{count}} of 4 available' }
      }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/components/add-courier-request-modal.tsx',
    replacements: [
      {
        target: 'placeholder="أدخل رمز الـ TID"',
        replace: 'placeholder={t(\'courier.enter_tid_code\')}',
        ar: { enter_tid_code: 'أدخل رمز الـ TID' },
        en: { enter_tid_code: 'Enter TID Code' }
      },
      {
        target: 'placeholder="أدخل معرف الـ Terminal"',
        replace: 'placeholder={t(\'courier.enter_terminal_id\')}',
        ar: { enter_terminal_id: 'أدخل معرف الـ Terminal' },
        en: { enter_terminal_id: 'Enter Terminal ID' }
      }
    ],
    ns: 'courier'
  },
  {
    file: './apps/portal/src/components/add-item-modal.tsx',
    replacements: [
      {
        target: 'placeholder="مثل: كرتون نيولاند N950"',
        replace: 'placeholder={t(\'inventory.item_name_example\')}',
        ar: { item_name_example: 'مثل: كرتون نيولاند N950' },
        en: { item_name_example: 'Example: Newland N950 Box' }
      }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/components/add-stock-modal.tsx',
    replacements: [
      {
        target: 'إضافة كمية جديدة من "{selectedItem?.name}" إلى المخزون',
        replace: 't(\'inventory.add_stock_for_item\', { name: selectedItem?.name })',
        ar: { add_stock_for_item: 'إضافة كمية جديدة من "{{name}}" إلى المخزون' },
        en: { add_stock_for_item: 'Add new stock for "{{name}}"' }
      }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/components/dashboard/GlobalInventoryChart.tsx',
    replacements: [
      {
        target: '<span>مخزون ثابت: {payload[0]?.value || 0}</span>',
        replace: '<span>{t(\'dashboard.fixed_inventory_chart\')}: {payload[0]?.value || 0}</span>',
        ar: { fixed_inventory_chart: 'مخزون ثابت' },
        en: { fixed_inventory_chart: 'Fixed Inventory' }
      },
      {
        target: '<span>مخزون متحرك: {payload[1]?.value || 0}</span>',
        replace: '<span>{t(\'dashboard.moving_inventory_chart\')}: {payload[1]?.value || 0}</span>',
        ar: { moving_inventory_chart: 'مخزون متحرك' },
        en: { moving_inventory_chart: 'Moving Inventory' }
      },
      {
        target: '<span>مستودعات: {payload[2]?.value || 0}</span>',
        replace: '<span>{t(\'dashboard.warehouses_chart\')}: {payload[2]?.value || 0}</span>',
        ar: { warehouses_chart: 'مستودعات' },
        en: { warehouses_chart: 'Warehouses' }
      },
      {
        target: 'المجموع: {(payload[0]?.value || 0) + (payload[1]?.value || 0) + (payload[2]?.value || 0)}',
        replace: 't(\'dashboard.total_chart\') + ": " + ((payload[0]?.value || 0) + (payload[1]?.value || 0) + (payload[2]?.value || 0))',
        ar: { total_chart: 'المجموع' },
        en: { total_chart: 'Total' }
      }
    ],
    ns: 'dashboard'
  },
  {
    file: './apps/portal/src/components/dashboard/InventoryBarCard.tsx',
    replacements: [
      {
        target: '<span className="text-[#18B2B0]">ث:{category.fixed}</span>',
        replace: '<span className="text-[#18B2B0]">{t(\'dashboard.fixed_short\')}:{category.fixed}</span>',
        ar: { fixed_short: 'ثابت' },
        en: { fixed_short: 'Fixed' }
      },
      {
        target: '<span className="text-emerald-400">م:{category.moving}</span>',
        replace: '<span className="text-emerald-400">{t(\'dashboard.moving_short\')}:{category.moving}</span>',
        ar: { moving_short: 'متحرك' },
        en: { moving_short: 'Moving' }
      }
    ],
    ns: 'dashboard'
  },
  {
    file: './apps/portal/src/components/dashboard/InventoryPieCard.tsx',
    replacements: [
      {
        target: '{payload[0].value.toLocaleString()} وحدة',
        replace: 't(\'dashboard.units_count\', { count: payload[0].value })',
        ar: { units_count: '{{count}} وحدة' },
        en: { units_count: '{{count}} Units' }
      },
      {
        target: '<p className="text-gray-400 text-sm">{percent}% من الإجمالي</p>',
        replace: '<p className="text-gray-400 text-sm">{percent}% {t(\'dashboard.of_total\')}</p>',
        ar: { of_total: 'من الإجمالي' },
        en: { of_total: 'of total' }
      }
    ],
    ns: 'dashboard'
  },
  {
    file: './apps/portal/src/components/dashboard/system-motion-charts.tsx',
    replacements: [
      { target: 'ثابت: t.fixed,', replace: 'fixed: t.fixed,' },
      { target: 'متحرك: t.moving,', replace: 'moving: t.moving,' },
      { target: 'إضافة: 0,', replace: 'addition: 0,' },
      { target: 'مناقلة: 0,', replace: 'transfer: 0,' },
      { target: 'مخزون: point.fixed + point.moving + point.central,', replace: 'stock: point.fixed + point.moving + point.central,' },
      { target: 'عمليات: Math.max(1, Math.round((todayTransactions || 8) * factor + (pendingActions || 0) * 0.4)),', replace: 'operations: Math.max(1, Math.round((todayTransactions || 8) * factor + (pendingActions || 0) * 0.4)),' },
      { target: 'مناقلات: Math.max(0, Math.round(transfers.length * (0.15 + index * 0.07))),', replace: 'transfers_count: Math.max(0, Math.round(transfers.length * (0.15 + index * 0.07))),' },
      { target: 'ثابت: p.fixed,', replace: 'fixed: p.fixed,' },
      { target: 'متحرك: p.moving,', replace: 'moving: p.moving,' }
    ],
    ns: 'dashboard'
  },
  {
    file: './apps/portal/src/components/edit-courier-execution-modal.tsx',
    replacements: [
      {
        target: '? "تم إكمال الطلب وخصم الأجهزة/الشرائح من عهدة الفني."',
        replace: '? t(\'courier.execution_success_desc\')',
        ar: { execution_success_desc: 'تم إكمال الطلب وخصم الأجهزة/الشرائح من عهدة الفني.' },
        en: { execution_success_desc: 'Order completed and items deducted from technician custody.' }
      },
      {
        target: 'const label = role === "device" ? "الرقم التسلسلي للجهاز (SN)" : "الرقم التسلسلي للشريحة (ICCID)";',
        replace: 'const label = role === "device" ? t(\'inventory.device_sn\') : t(\'inventory.sim_iccid\');',
        ar: { device_sn: 'الرقم التسلسلي للجهاز (SN)', sim_iccid: 'الرقم التسلسلي للشريحة (ICCID)' },
        en: { device_sn: 'Device Serial Number (SN)', sim_iccid: 'SIM Serial Number (ICCID)' }
      },
      {
        target: 'بيانات التنفيذ الميداني',
        replace: 't(\'courier.execution_details\')',
        ar: { execution_details: 'بيانات التنفيذ الميداني' },
        en: { execution_details: 'Field Execution Details' }
      }
    ],
    ns: 'courier'
  },
  {
    file: './apps/portal/src/components/edit-item-modal.tsx',
    replacements: [
      {
        target: 'تعديل بيانات "{selectedItem?.name}"',
        replace: 't(\'inventory.edit_item_data\', { name: selectedItem?.name })',
        ar: { edit_item_data: 'تعديل بيانات "{{name}}"' },
        en: { edit_item_data: 'Edit details for "{{name}}"' }
      }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/components/edit-technician-fixed-inventory-modal.tsx',
    replacements: [
      {
        target: 'title: "✓ تم الحفظ بنجاح",',
        replace: 'title: t(\'common.save_success_title\'),',
        ar: { save_success_title: '✓ تم الحفظ بنجاح' },
        en: { save_success_title: '✓ Saved Successfully' }
      },
      {
        target: 'description: `تم حفظ المخزون الثابت لـ ${technicianName}`,',
        replace: 'description: t(\'inventory.save_fixed_success_desc\', { name: technicianName }),',
        ar: { save_fixed_success_desc: 'تم حفظ المخزون الثابت لـ {{name}}' },
        en: { save_fixed_success_desc: 'Fixed inventory saved for {{name}}' }
      },
      {
        target: 'title: "✗ فشل الحفظ",',
        replace: 'title: t(\'common.save_failed_title\'),',
        ar: { save_failed_title: '✗ فشل الحفظ' },
        en: { save_failed_title: '✗ Save Failed' }
      },
      { target: "name: 'أجهزة N950',", replace: "name: t('inventory.n950_devices'),", ar: { n950_devices: 'أجهزة N950' }, en: { n950_devices: 'N950 Devices' } },
      { target: "name: 'أجهزة I9000s',", replace: "name: t('inventory.i9000s_devices'),", ar: { i9000s_devices: 'أجهزة I9000s' }, en: { i9000s_devices: 'I9000s Devices' } },
      { target: "name: 'أجهزة I9100',", replace: "name: t('inventory.i9100_devices'),", ar: { i9100_devices: 'أجهزة I9100' }, en: { i9100_devices: 'I9100 Devices' } },
      { target: "name: 'شرائح STC',", replace: "name: t('inventory.stc_sims')," }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/components/inventory-table.tsx',
    replacements: [
      {
        target: 'هذا الإجراء لا يمكن التراجع عنه. سيتم حذف "{selectedItem?.name}" من المخزون نهائياً.',
        replace: 't(\'inventory.delete_warning_desc\', { name: selectedItem?.name })',
        ar: { delete_warning_desc: 'هذا الإجراء لا يمكن التراجع عنه. سيتم حذف "{{name}}" من المخزون نهائياً.' },
        en: { delete_warning_desc: 'This action is irreversible. "{{name}}" will be permanently deleted from inventory.' }
      }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/components/layout/neo-shell-layout.tsx',
    replacements: [
      {
        target: 'const def = language === "ar" ? "م" : "U";',
        replace: 'const def = language === "ar" ? "م" : "U";'
      }
    ],
    ns: 'common'
  },
  {
    file: './apps/portal/src/components/technicians-table.tsx',
    replacements: [
      { target: '{ width: 25 },  // اسم المندوب', replace: '{ width: 25 },' },
      { target: '{ width: 18 },  // المدينة', replace: '{ width: 18 },' },
      { target: '{ width: 14 },  // أوراق رول', replace: '{ width: 14 },' },
      { target: '{ width: 16 },  // ملصقات مداى', replace: '{ width: 16 },' },
      { target: '{ width: 16 },  // بطاريات جديدة', replace: '{ width: 16 },' },
      { target: '{ width: 14 },  // زين', replace: '{ width: 14 },' },
      { target: '{ width: 35 },  // ملاحظات', replace: '{ width: 35 },' }
    ],
    ns: 'users'
  },
  {
    file: './apps/portal/src/components/transfer-from-warehouse-modal.tsx',
    replacements: [
      {
        target: '<Label htmlFor={`${item.id}-unit`} className="text-xs cursor-pointer">وحدة ({availableUnits})</Label>',
        replace: '<Label htmlFor={`${item.id}-unit`} className="text-xs cursor-pointer">{t(\'inventory.unit\')} ({availableUnits})</Label>'
      },
      {
        target: 'الكمية المدخلة أكبر من المتاح ({selectedPackagingAvailable})',
        replace: 't(\'inventory.input_greater_than_available\', { available: selectedPackagingAvailable })',
        ar: { input_greater_than_available: 'الكمية المدخلة أكبر من المتاح ({{available}})' },
        en: { input_greater_than_available: 'Input quantity is greater than available ({{available}})' }
      }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/components/transfer-to-moving-modal.tsx',
    replacements: [
      {
        target: 'title: "✓ تم النقل بنجاح",',
        replace: 'title: t(\'inventory.transfer_success_title\'),',
        ar: { transfer_success_title: '✓ تم النقل بنجاح' },
        en: { transfer_success_title: '✓ Transferred Successfully' }
      },
      {
        target: 'title: "✗ فشل النقل",',
        replace: 'title: t(\'inventory.transfer_failed_title\'),',
        ar: { transfer_failed_title: '✗ فشل النقل' },
        en: { transfer_failed_title: '✗ Transfer Failed' }
      }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/components/withdraw-from-technician-modal.tsx',
    replacements: [
      {
        target: '{(technicianName || "ف").slice(0, 1)}',
        replace: '{(technicianName || "T").slice(0, 1)}'
      },
      {
        target: 'حسب التحديد ({selectedItems.length})',
        replace: 't(\'inventory.selected_count\', { count: selectedItems.length })',
        ar: { selected_count: 'حسب التحديد ({{count}})' },
        en: { selected_count: 'By selection ({{count}})' }
      }
    ],
    ns: 'inventory'
  },
  {
    file: './apps/portal/src/components/withdrawal-modal.tsx',
    replacements: [
      {
        target: 'الكمية المطلوب سحبها',
        replace: 't(\'inventory.withdrawal_requested_qty\')',
        ar: { withdrawal_requested_qty: 'الكمية المطلوب سحبها' },
        en: { withdrawal_requested_qty: 'Requested withdrawal quantity' }
      }
    ],
    ns: 'inventory'
  }
];

fixes.forEach(fix => {
  const filePath = fix.file;
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  let fileModified = false;

  fix.replacements.forEach(r => {
    if (content.includes(r.target)) {
      content = content.replace(r.target, r.replace);
      fileModified = true;

      // Add to translation dictionary
      if (r.ar && r.en) {
        Object.entries(r.ar).forEach(([key, arVal]) => {
          const enVal = r.en[key];
          
          // Load current
          const arNsPath = path.join(LOCALES_DIR, 'ar', `${fix.ns}.json`);
          const enNsPath = path.join(LOCALES_DIR, 'en', `${fix.ns}.json`);

          const arDb = JSON.parse(fs.readFileSync(arNsPath, 'utf-8'));
          const enDb = JSON.parse(fs.readFileSync(enNsPath, 'utf-8'));

          arDb[key] = arVal;
          enDb[key] = enVal;

          fs.writeFileSync(arNsPath, JSON.stringify(arDb, null, 2), 'utf-8');
          fs.writeFileSync(enNsPath, JSON.stringify(enDb, null, 2), 'utf-8');
        });
      }
    }
  });

  if (fileModified) {
    if (!content.includes('useTranslation')) {
      content = `import { useTranslation } from "@/lib/language";\n` + content;
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Manually fixed: ${filePath}`);
  }
});

console.log('Manual fixes applied successfully!');
