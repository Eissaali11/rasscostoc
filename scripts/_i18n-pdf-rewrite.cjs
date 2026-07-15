const fs = require('fs');

const EN = {
  'تقرير رحلة الجهاز وتفاصيل العملية': 'Device journey and operation details report',
  'بيانات الجهاز': 'Device data',
  'رقم الجهاز:': 'Terminal ID:',
  'السيريال:': 'Serial:',
  'المنطقة:': 'Region:',
  'الحالة:': 'Status:',
  'تاريخ الإدخال:': 'Created at:',
  'تاريخ الاعتماد:': 'Approved at:',
  'ملف التسليم': 'Delivery file',
  'حالة الملف:': 'File status:',
  'اسم الملف:': 'File name:',
  'المصدر:': 'Source:',
  'وقت الرفع:': 'Upload time:',
  'الرافع:': 'Uploaded by:',
  'حالة الملحقات': 'Accessories status',
  'البطارية': 'Battery',
  'كابل الشاحن': 'Charger cable',
  'رأس الشاحن': 'Charger head',
  'الشريحة': 'SIM',
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
  'تقرير الجهاز المسحوب': 'Withdrawn device report',
  'تفاصيل الجهاز المسحوب': 'Withdrawn device details',
  'إثبات التسليم': 'Delivery proof',
  'نموذج الاستلام': 'Receipt form',
  'من': 'From',
  'إلى': 'To',
};

const HELPER = `type PdfLang = 'ar' | 'en';

function resolvePdfLang(): PdfLang {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('language') === 'en') return 'en';
  return 'ar';
}

function pdfT(map: Record<PdfLang, string>): string {
  const lang = resolvePdfLang();
  return map[lang] || map.ar;
}
`;

function convert(file) {
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(/import \{ useTranslation \} from ["']@\/lib\/language["'];\r?\n/g, '');
  s = s.replace(/^\s*const \{ t \} = useTranslation\(\);\r?\n/gm, '');
  // strip previous broken helpers/maps
  s = s.replace(/type PdfLang[\s\S]*?function pdfT\([\s\S]*?\n\}\n/, '');
  s = s.replace(/^const p\d+ = \{ ar:[\s\S]*?\} as const;\n/gm, '');

  const phrases = [];
  const seen = new Map();

  function idFor(ar) {
    if (seen.has(ar)) return seen.get(ar);
    const id = `p${phrases.length}`;
    seen.set(ar, id);
    let en = EN[ar];
    if (!en) {
      for (const [k, v] of Object.entries(EN)) {
        if (ar.includes(k)) { en = ar.split(k).join(v); break; }
      }
    }
    phrases.push({ id, ar, en: en || ar });
    return id;
  }

  // HTML text nodes
  s = s.replace(/>([^<${}]*[\u0600-\u06FF][^<]*)</g, (m, raw) => {
    const ar = raw.trim();
    if (!ar || ar.includes('${')) return m;
    const id = idFor(ar);
    const lead = raw.match(/^\s*/)?.[0] || '';
    const trail = raw.match(/\s*$/)?.[0] || '';
    return `>${lead}\${pdfT(${id})}${trail}<`;
  });

  // quoted Arabic literals
  s = s.replace(/(['"])([\u0600-\u06FF][^'"]*)\1/g, (m, q, ar) => {
    if (ar.includes('${')) return m;
    const id = idFor(ar);
    return `pdfT(${id})`;
  });

  const maps = phrases.map(p => `const ${p.id} = { ar: ${JSON.stringify(p.ar)}, en: ${JSON.stringify(p.en)} } as const;`).join('\n');

  // Place helper + maps after imports
  const importLines = [];
  const rest = [];
  let inImports = true;
  for (const line of s.split(/\r?\n/)) {
    if (inImports && (/^import\s/.test(line) || line.trim() === '')) {
      importLines.push(line);
    } else {
      inImports = false;
      rest.push(line);
    }
  }
  const out = [...importLines, '', HELPER, maps, '', ...rest].join('\n');
  fs.writeFileSync(file, out);
  console.log(file, 'phrases', phrases.length);
}

[
  'apps/portal/src/features/received-devices/export-received-device-details-pdf.ts',
  'apps/portal/src/features/withdrawn-devices/export-withdrawn-device-details-pdf.ts',
  'apps/portal/src/features/warehouse-details/export-transfer-pdf.ts',
].forEach(convert);
