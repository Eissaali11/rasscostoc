const fs = require('fs');
const path = require('path');

const root = 'apps/portal/src/i18n/locales';
for (const lang of ['ar', 'en']) {
  const p = path.join(root, lang, 'accounting.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.export_date_label = lang === 'ar' ? 'تاريخ التصدير: {{date}}' : 'Export date: {{date}}';
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
}

const dict = {
  'بيانات الجهاز': 'Device data',
  'السيريال:': 'Serial:',
  'المنطقة:': 'Region:',
  'تاريخ الإدخال:': 'Created at:',
  'تاريخ الاعتماد:': 'Approved at:',
  'ملف التسليم': 'Delivery file',
  'حالة الملف:': 'File status:',
  'اسم الملف:': 'File name:',
  'المصدر:': 'Source:',
  'وقت الرفع:': 'Upload time:',
  'الرافع:': 'Uploaded by:',
  'حالة الملحقات': 'Accessories status',
  'البطارية:': 'Battery:',
  'كابل الشاحن:': 'Charger cable:',
  'رأس الشاحن:': 'Charger head:',
  'الشريحة:': 'SIM:',
  'نوع الشريحة:': 'SIM type:',
  'الضرر:': 'Damage:',
  'ملاحظات المشرف:': 'Supervisor notes:',
  'رحلة الجهاز': 'Device journey',
  'الجدول الزمني': 'Timeline',
  'لا توجد بيانات': 'No data',
  'موجود': 'Present',
  'غير موجود': 'Missing',
  'تالف': 'Damaged',
  'سليم': 'OK',
  'مقبول': 'Approved',
  'مرفوض': 'Rejected',
  'قيد الانتظار': 'Pending',
  'نعم': 'Yes',
  'لا': 'No',
  'إيصال نقل المستودع': 'Warehouse transfer receipt',
  'من مستودع': 'From warehouse',
  'إلى مندوب': 'To technician',
  'الأصناف المنقولة': 'Transferred items',
  'إجمالي الأصناف': 'Total items',
  'ملاحظات': 'Notes',
  'الحالة': 'Status',
  'التاريخ': 'Date',
  'الكمية': 'Quantity',
  'الصنف': 'Item',
  'المندوب': 'Technician',
  'المستودع': 'Warehouse',
  'الموقع': 'Location',
  'رقم الجهاز:': 'Terminal ID:',
  'الحالة:': 'Status:',
};

const pdfFiles = [
  'apps/portal/src/features/received-devices/export-received-device-details-pdf.ts',
  'apps/portal/src/features/withdrawn-devices/export-withdrawn-device-details-pdf.ts',
  'apps/portal/src/features/warehouse-details/export-transfer-pdf.ts',
];

for (const f of pdfFiles) {
  let s = fs.readFileSync(f, 'utf8');
  let n = 0;
  s = s.replace(/en: "([^"]*[\u0600-\u06FF][^"]*)"/g, (m, ar) => {
    let en = dict[ar];
    if (!en) {
      for (const [k, v] of Object.entries(dict)) {
        if (ar.includes(k)) {
          en = ar.split(k).join(v);
          break;
        }
      }
    }
    if (en && en !== ar) {
      n++;
      return 'en: ' + JSON.stringify(en);
    }
    return m;
  });
  fs.writeFileSync(f, s);
  console.log(f, 'en fixed', n);
}

let tt = fs.readFileSync('apps/portal/src/components/technicians-table.tsx', 'utf8');
const cmap = {
  'اسم المندوب': 'technician name',
  'المدينة': 'city',
  'أوراق رول': 'roll paper',
  'ملصقات مداى': 'mada stickers',
  'بطاريات جديدة': 'new batteries',
  'موبايلي': 'mobily',
  'زين': 'zain',
  'ملاحظات': 'notes',
};
for (const [ar, en] of Object.entries(cmap)) {
  tt = tt.split('// ' + ar).join('// ' + en);
}
fs.writeFileSync('apps/portal/src/components/technicians-table.tsx', tt);
console.log('done');
