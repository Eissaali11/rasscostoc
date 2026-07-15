/**
 * Convert PDF export helpers to bilingual maps (language from localStorage).
 * Removes illegal useTranslation() from non-component modules.
 */
const fs = require('fs');

const LANG_HELPER = `
type PdfLang = 'ar' | 'en';

function resolvePdfLang(): PdfLang {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('language') === 'en') return 'en';
  return 'ar';
}

function pdfT(map: Record<PdfLang, string>, vars?: Record<string, string | number>): string {
  const lang = resolvePdfLang();
  let text = map[lang] || map.ar;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp('\\\\{\\\\{' + k + '\\\\}\\\\}', 'g'), String(v))
        .replace(new RegExp('\\\\{' + k + '\\\\}', 'g'), String(v));
    }
  }
  return text;
}
`;

function convertFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/import \{ useTranslation \} from ["']@\/lib\/language["'];\r?\n/, '');
  content = content.replace(/^\s*const \{ t \} = useTranslation\(\);\r?\n/gm, '');

  if (!content.includes('function pdfT(')) {
    // Find the end of the last import statement
    const lines = content.split('\n');
    let lastImportLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import') || lines[i].trim().includes('from \'') || lines[i].trim().includes('from "')) {
        lastImportLineIdx = i;
      }
    }
    let insertIdx = lastImportLineIdx + 1;
    while (insertIdx < lines.length) {
      const trimmed = lines[insertIdx].trim();
      if (!trimmed || trimmed.startsWith('}') || trimmed.startsWith(',') || trimmed.includes('from \'') || trimmed.includes('from "')) {
        insertIdx++;
      } else {
        break;
      }
    }
    lines.splice(insertIdx, 0, LANG_HELPER);
    content = lines.join('\n');
  }

  // Replace HTML text nodes with Arabic: >عربي<
  const phraseCache = new Map();
  let counter = 0;

  content = content.replace(/>([^<$\n]*[\u0600-\u06FF][^<\n]*)</g, (full, arRaw) => {
    const ar = arRaw.trim();
    if (!ar || ar.includes('${')) {
      // handle "label: ${var}" patterns
      const m = arRaw.match(/^([^$]*[\u0600-\u06FF][^:]*:?)\s*(\$\{[^}]+\})\s*$/);
      if (m) {
        const label = m[1].trim().replace(/:$/, '');
        const expr = m[2];
        if (!phraseCache.has(label)) {
          const id = `p${counter++}`;
          phraseCache.set(label, id);
        }
        const id = phraseCache.get(label);
        return `>\${pdfT(${id}, { v: ${expr.slice(2, -1)} }).replace('{v}', '') || ''}<`.replace(
          `pdfT(${id}, { v: ${expr.slice(2, -1)} }).replace('{v}', '') || ''`,
          `pdfT(${id}) + ' ' + (${expr.slice(2, -1)})`
        );
      }
      return full;
    }
    if (!phraseCache.has(ar)) {
      phraseCache.set(ar, `p${counter++}`);
    }
    const id = phraseCache.get(ar);
    return `>\${pdfT(${id})}<`;
  });

  // Build const maps from phraseCache
  const EN_HINTS = {
    'تقرير رحلة الجهاز وتفاصيل العملية': 'Device journey and operation details report',
    'إيصال نقل المستودع': 'Warehouse transfer receipt',
    'تاريخ التصدير': 'Export date',
    'المستودع': 'Warehouse',
    'الموقع': 'Location',
    'المندوب': 'Technician',
    'الحالة': 'Status',
    'التاريخ': 'Date',
    'الكمية': 'Quantity',
    'الصنف': 'Item',
    'الإجمالي': 'Total',
    'ملاحظات': 'Notes',
    'لا توجد بيانات': 'No data',
    'تفاصيل الأصناف': 'Item details',
    'الأصناف المنقولة': 'Transferred items',
    'إجمالي الأصناف': 'Total items',
    'رحلة الجهاز': 'Device journey',
    'الجدول الزمني': 'Timeline',
    'إثبات التسليم': 'Delivery proof',
    'نموذج الاستلام': 'Receipt form',
    'الرقم التسلسلي': 'Serial number',
    'رقم الجهاز': 'Terminal ID',
    'البطارية': 'Battery',
    'كابل الشاحن': 'Charger cable',
    'رأس الشاحن': 'Charger head',
    'الشريحة': 'SIM',
    'الضرر': 'Damage',
    'موافق': 'Approved',
    'مرفوض': 'Rejected',
    'قيد الانتظار': 'Pending',
    'نعم': 'Yes',
    'لا': 'No',
    'من': 'From',
    'إلى': 'To',
    'تفاصيل العملية': 'Operation details',
    'تقرير الجهاز المسحوب': 'Withdrawn device report',
    'تفاصيل الجهاز المسحوب': 'Withdrawn device details',
  };

  function enFor(ar) {
    if (EN_HINTS[ar]) return EN_HINTS[ar];
    for (const [k, v] of Object.entries(EN_HINTS)) {
      if (ar.startsWith(k)) return ar.replace(k, v);
    }
    // bilingual fallback: keep Arabic as EN until better translation — prefer readable English paraphrase
    return ar;
  }

  let maps = '';
  for (const [ar, id] of phraseCache.entries()) {
    const en = enFor(ar);
    maps += `const ${id} = { ar: ${JSON.stringify(ar)}, en: ${JSON.stringify(en)} } as const;\n`;
  }

  if (maps) {
    content = content.replace('function pdfT(', maps + '\nfunction pdfT(');
  }

  // Also replace standalone Arabic string literals used as values
  content = content.replace(/(=\s*)(['"])([\u0600-\u06FF][^'"]*)\2/g, (m, eq, q, ar) => {
    if (!phraseCache.has(ar)) {
      const id = `p${counter++}`;
      phraseCache.set(ar, id);
      // late-add map — inject before pdfT
      const en = enFor(ar);
      content = content.replace('function pdfT(', `const ${id} = { ar: ${JSON.stringify(ar)}, en: ${JSON.stringify(en)} } as const;\nfunction pdfT(`);
    }
    return `${eq}pdfT(${phraseCache.get(ar)})`;
  });

  fs.writeFileSync(filePath, content);
  console.log(filePath, 'phrases', phraseCache.size);
}

[
  'apps/portal/src/features/received-devices/export-received-device-details-pdf.ts',
  'apps/portal/src/features/withdrawn-devices/export-withdrawn-device-details-pdf.ts',
  'apps/portal/src/features/warehouse-details/export-transfer-pdf.ts',
].forEach(convertFile);
