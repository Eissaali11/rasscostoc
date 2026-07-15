const fs = require('fs');
const path = require('path');

const patches = [
  {
    file: 'apps/portal/src/pages/fixed-inventory-dashboard.tsx',
    from: `                      ⚠️ تنبيه: {t('inventory.item_33113', { count: summary.techniciansWithCriticalStock })}!`,
    to: `                      {t('inventory.critical_stock_alert', { count: summary.techniciansWithCriticalStock })}`,
  },
  {
    file: 'apps/portal/src/pages/notifications.tsx',
    from: `                                        المندوب: {technicianNameById.get(device.technicianId) || t('notifications.item_9013', { var_0: device.technicianId.slice(0, 8) })}`,
    to: `                                        {t('notifications.technician_label', { name: technicianNameById.get(device.technicianId) || t('notifications.item_9013', { var_0: device.technicianId.slice(0, 8) }) })}`,
  },
  {
    file: 'apps/portal/src/pages/notifications.tsx',
    from: `              هل تريد قبول {t('notifications.item_7419', { count: selectedBatchIds.length })}`,
    to: `              {t('notifications.accept_batch_confirm', { count: selectedBatchIds.length })}`,
  },
  {
    file: 'apps/portal/src/pages/notifications.tsx',
    from: `              يرجى إدخال سبب رفض {t('notifications.request_4', { count: selectedBatchIds.length })}`,
    to: `              {t('notifications.reject_batch_reason_prompt', { count: selectedBatchIds.length })}`,
  },
  {
    file: 'apps/portal/src/pages/operation-details.tsx',
    from: `                نقل مخزون داخلي - {operationGroup.warehouseName || t('common.warehouse_1')} إلى {operationGroup.technicianName || t('common.technician')}`,
    to: `                {t('common.internal_transfer_to', { from: operationGroup.warehouseName || t('common.warehouse_1'), to: operationGroup.technicianName || t('common.technician') })}`,
  },
  {
    file: 'apps/portal/src/pages/operations.tsx',
    from: `                            المنفذ: {mainOperation.technicianName || t('common.item_11173')} • {mainOperation.systemMeta?.userRole || "-"}`,
    to: `                            {t('common.executed_by', { name: mainOperation.technicianName || t('common.item_11173'), role: mainOperation.systemMeta?.userRole || "-" })}`,
  },
  {
    file: 'apps/portal/src/pages/product-smart-add.tsx',
    from: `        description: \`تم حفظ \${t('common.item_10652', { count: successCount })}\${failedCount ? \`، وفشل \${failedCount}\` : ""}\`,`,
    to: `        description: t('common.save_serials_result', { success: successCount, failedSuffix: failedCount ? t('common.save_failed_suffix', { failed: failedCount }) : "" }),`,
  },
  {
    file: 'apps/portal/src/pages/ReceivedDeviceDetails.tsx',
    from: `                      تاريخ الرفع: {deliveryProof.createdAt ? \`\${formatDate(deliveryProof.createdAt.toISOString())} - \${formatTime(deliveryProof.createdAt.toISOString())}\` : t('verification.item_12798')}`,
    to: `                      {t('verification.upload_date', { date: deliveryProof.createdAt ? \`\${formatDate(deliveryProof.createdAt.toISOString())} - \${formatTime(deliveryProof.createdAt.toISOString())}\` : t('verification.item_12798') })}`,
  },
  {
    file: 'apps/portal/src/pages/ReceivedDeviceDetails.tsx',
    from: `                      تاريخ الرفع: {receiptFormProof.createdAt ? \`\${formatDate(receiptFormProof.createdAt.toISOString())} - \${formatTime(receiptFormProof.createdAt.toISOString())}\` : t('verification.item_12798')}`,
    to: `                      {t('verification.upload_date', { date: receiptFormProof.createdAt ? \`\${formatDate(receiptFormProof.createdAt.toISOString())} - \${formatTime(receiptFormProof.createdAt.toISOString())}\` : t('verification.item_12798') })}`,
  },
  {
    file: 'apps/portal/src/pages/ReceivedDeviceDetails.tsx',
    from: `              ملاحظات {actionType === "reject" ? t('verification.item_9642') : t('verification.item_12773')}`,
    to: `              {t('verification.notes_for_action', { action: actionType === "reject" ? t('verification.item_9642') : t('verification.item_12773') })}`,
  },
  {
    file: 'apps/portal/src/pages/ReceivedDevicesReview.tsx',
    from: `                <>مادة: {getItemName(selectedDevice.itemTypeId, selectedDevice.terminalId)} - {selectedDevice.serialNumber}</>`,
    to: `                <>{t('verification.material_with_serial', { name: getItemName(selectedDevice.itemTypeId, selectedDevice.terminalId), serial: selectedDevice.serialNumber })}</>`,
  },
  {
    file: 'apps/portal/src/pages/ReceivedDevicesReview.tsx',
    from: `                ملاحظات {actionType === 'reject' ? t('verification.item_9642') : t('verification.item_12773')}`,
    to: `                {t('verification.notes_for_action', { action: actionType === 'reject' ? t('verification.item_9642') : t('verification.item_12773') })}`,
  },
  {
    file: 'apps/portal/src/pages/technician-details.tsx',
    from: `                  عهدة نشطة: {arNumber(serializedItems.length)}`,
    to: `                  {t('common.active_custody_count', { count: arNumber(serializedItems.length) })}`,
  },
  {
    file: 'apps/portal/src/pages/technician-details.tsx',
    from: `                  مسلَّم: {arNumber(deliveryLogCount)}`,
    to: `                  {t('common.delivered_count_label', { count: arNumber(deliveryLogCount) })}`,
  },
  {
    file: 'apps/portal/src/pages/transaction-history.tsx',
    from: `                        الصفحة {t('common.item_4292', { count: transactionData.page })}{transactionData.totalPages}`,
    to: `                        {t('common.page_of', { page: transactionData.page, totalPages: transactionData.totalPages })}`,
  },
  {
    file: 'apps/portal/src/pages/withdrawn-devices.tsx',
    from: `                {analytics.monthlyDelta >= 0 ? "+" : ""}{analytics.monthlyDelta}% عن الشهر السابق`,
    to: `                {t('common.vs_previous_month', { delta: \`\${analytics.monthlyDelta >= 0 ? "+" : ""}\${analytics.monthlyDelta}\` })}`,
  },
];

let ok = 0, fail = [];
for (const p of patches) {
  const full = path.resolve(p.file);
  let content = fs.readFileSync(full, 'utf8');
  if (!content.includes(p.from)) {
    fail.push({ file: p.file, snippet: p.from.slice(0, 100) });
    continue;
  }
  content = content.replace(p.from, p.to);
  fs.writeFileSync(full, content);
  ok++;
}
console.log(JSON.stringify({ ok, failCount: fail.length, fail }, null, 2));
