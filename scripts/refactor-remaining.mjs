import fs from 'fs';
import path from 'path';

const LOCALES_DIR = './apps/portal/src/i18n/locales';
const PAGES_DIR = './apps/portal/src/pages';
const COMPONENTS_DIR = './apps/portal/src/components';

const namespaces = [
  'common', 'dashboard', 'inventory', 'courier', 'warehouse',
  'users', 'reports', 'settings', 'errors', 'notifications',
  'verification', 'scanner', 'accounting'
];

const wordMap = {
  "لوحة": "dashboard", "التحكم": "control", "المخزون": "inventory", "المستودعات": "warehouses",
  "المستودع": "warehouse", "مستودع": "warehouse", "الفنيين": "technicians", "المندوبين": "couriers",
  "المندوب": "technician", "الفني": "technician", "التقارير": "reports", "تقرير": "report",
  "الإعدادات": "settings", "المستخدمين": "users", "المستخدم": "user", "التحقق": "verification",
  "الرسائل": "messages", "الإشعارات": "notifications", "المحاسبة": "accounting", "المالية": "finance",
  "تأكيد": "confirm", "إلغاء": "cancel", "حفظ": "save", "بحث": "search", "تصفية": "filter",
  "عرض": "view", "حذف": "delete", "تعديل": "edit", "إضافة": "add", "رقم": "number",
  "تاريخ": "date", "حالة": "status", "نشط": "active", "النشطة": "active", "الكل": "all",
  "تفاصيل": "details", "تحميل": "loading", "الرئيسية": "home", "نعم": "yes", "لا": "no",
  "موافق": "ok", "إغلاق": "close", "تم": "completed", "بنجاح": "successfully", "خطأ": "error",
  "نوع": "type", "اسم": "name", "جهاز": "device", "أجهزة": "devices", "شريحة": "sim",
  "شرائح": "sims", "ورق": "paper", "بطارية": "battery", "بطاريات": "batteries", "ملصق": "sticker",
  "ملصقات": "stickers", "جديد": "new", "قديم": "old", "تحديث": "update", "سجل": "log",
  "سجلات": "logs", "العمليات": "operations", "عملية": "operation", "حركة": "transaction",
  "حركات": "transactions", "رقمي": "digital", "سحابة": "cloud", "سحابي": "cloud", "محلي": "local",
  "نسخة": "backup", "احتياطية": "backup", "تنزيل": "download", "تصدير": "export", "استيراد": "import",
  "ملف": "file", "ملفات": "files", "طباعة": "print", "مراجعة": "review", "استلام": "receive",
  "مستلم": "received", "أرسل": "send", "إرسال": "send", "طلب": "request", "طلبات": "requests",
  "قبول": "approve", "مقبول": "approved", "رفض": "reject", "مرفوض": "rejected", "قيد": "pending",
  "الانتظار": "waiting", "معلق": "pending", "توصيل": "delivery", "مسح": "scan", "ماسح": "scanner",
  "الرمز": "code", "تسلسلي": "serial", "السيريال": "serial", "عميل": "customer", "العميل": "customer",
  "سعر": "price", "كمية": "quantity", "الكمية": "quantity", "إجمالي": "total", "الإجمالي": "total",
  "كرتون": "box", "كراتين": "boxes", "قطعة": "unit", "قطع": "units", "وحدة": "unit", "وحدات": "units",
  "موبايلي": "mobily", "زين": "zain", "ليبارا": "lebara", "ملاحظات": "notes", "عقد": "contract",
  "مدينة": "city", "المدينة": "city", "منطقة": "region", "المنطقة": "region", "هاتف": "phone",
  "جوال": "mobile", "الرمز": "code", "كود": "code", "نوع": "type", "النوع": "type", "مسؤول": "admin",
  "المشرف": "supervisor", "مشرف": "supervisor", "المدير": "manager", "مدير": "manager", "إدارة": "management",
  "تاريخ": "date", "الوقت": "time", "وقت": "time", "يوم": "day", "شهر": "month", "سنة": "year",
  "أسبوع": "week", "رئيسي": "primary", "مخزن": "store", "فروع": "branches", "فرع": "branch",
  "نظام": "system", "فشل": "fail", "نجاح": "success", "تنبيه": "alert", "تحذير": "warning",
  "خطر": "danger", "معلومات": "info", "مستوى": "level", "حجم": "size", "نتائج": "results",
  "خالي": "empty", "تراجع": "undo", "التالي": "next", "السابق": "previous", "الصفحة": "page",
  "جدول": "table", "بطاقة": "card", "مخطط": "chart", "رسم": "chart", "بيان": "statement",
  "بيانات": "data", "قيمة": "value", "قيم": "values", "النسبة": "percentage", "معدل": "rate",
  "مكتمل": "completed", "المالي": "financial", "فواتير": "invoices", "فاتورة": "invoice",
  "مبيعات": "sales", "مشتريات": "purchases", "سند": "voucher", "سندات": "vouchers", "مدفوعات": "payments",
  "دفع": "payment", "صرف": "disbursement", "قبض": "receipt", "ضريبة": "vat", "الضريبة": "vat",
  "مرحل": "posted", "مسودة": "draft", "أخرى": "other", "ترتيب": "rank", "تصنيف": "category",
  "عنصر": "item", "عناصر": "items", "تجاوز": "skip", "تكرار": "duplicate", "مكرر": "duplicate",
  "إثبات": "proof", "توقيع": "signature", "موقع": "signed", "صورة": "image", "صور": "images",
  "مسار": "route", "رحلة": "journey", "مرحلة": "stage", "مراحل": "stages", "عذر": "excuse",
  "سبب": "reason", "صيانة": "maintenance", "تلف": "damage", "جزء": "part", "أجزاء": "parts",
  "مستند": "document", "مستندات": "documents", "مصدر": "source", "هدف": "destination",
  "مناقلة": "transfer", "مناقلات": "transfers", "تحويل": "transfer", "تحويلات": "transfers",
  "دفعة": "batch", "شحنة": "batch", "سحوبات": "withdrawn", "سحب": "withdraw", "مرتجع": "returned",
  "المرتجعة": "returned", "إدخال": "submit", "متابعة": "followup", "رصد": "track",
  "تتبع": "track", "مراقبة": "monitor", "أمان": "security", "نسخ": "backup", "استعادة": "restore",
  "مستودعات": "warehouses"
};

// Load database
const db = { ar: {}, en: {} };
namespaces.forEach(ns => {
  db.ar[ns] = {};
  db.en[ns] = {};
  
  const arPath = path.join(LOCALES_DIR, 'ar', `${ns}.json`);
  if (fs.existsSync(arPath)) {
    db.ar[ns] = JSON.parse(fs.readFileSync(arPath, 'utf-8'));
  }
  const enPath = path.join(LOCALES_DIR, 'en', `${ns}.json`);
  if (fs.existsSync(enPath)) {
    db.en[ns] = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
  }
});

function translateText(arabic) {
  const clean = arabic.replace(/[^\u0600-\u06FF\s]+/g, ' ').trim();
  const tokens = clean.split(/\s+/).filter(Boolean);
  
  const englishTokens = tokens.map(token => {
    if (wordMap[token]) return wordMap[token];
    if (token.startsWith('ال') && wordMap[token.slice(2)]) return wordMap[token.slice(2)];
    return '';
  }).filter(Boolean);

  if (englishTokens.length === 0) {
    const hash = arabic.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `item_${hash}`;
  }
  return englishTokens.join(' ');
}

function generateKey(arabic, ns) {
  for (const [k, val] of Object.entries(db.ar[ns])) {
    if (val === arabic) return k;
  }

  const translated = translateText(arabic);
  let baseKey = translated.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 35);
  if (!baseKey || baseKey.startsWith('item_')) {
    const hash = arabic.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    baseKey = `item_${hash}`;
  }

  let key = baseKey;
  let counter = 1;
  while (db.ar[ns][key] && db.ar[ns][key] !== arabic) {
    key = `${baseKey}_${counter}`;
    counter++;
  }

  db.ar[ns][key] = arabic;
  const englishLabel = translateText(arabic)
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  db.en[ns][key] = englishLabel;

  return key;
}

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function getNamespace(filePath) {
  const filename = path.basename(filePath).toLowerCase();
  const dir = path.dirname(filePath).toLowerCase();

  if (filename.includes('courier') || dir.includes('courier')) return 'courier';
  if (filename.includes('accounting')) return 'accounting';
  if (filename.includes('warehouse')) return 'warehouse';
  if (filename.includes('inventory')) return 'inventory';
  if (filename.includes('user') || filename.includes('profile') || filename.includes('employee')) return 'users';
  if (filename.includes('notification')) return 'notifications';
  if (filename.includes('report') || filename.includes('withdrawn') || filename.includes('log')) return 'reports';
  if (filename.includes('verification') || filename.includes('received')) return 'verification';
  if (filename.includes('scanner')) return 'scanner';
  if (filename.includes('dashboard')) return 'dashboard';
  if (filename.includes('settings')) return 'settings';
  return 'common';
}

const allFiles = [...getFiles(PAGES_DIR), ...getFiles(COMPONENTS_DIR)];
let totalModified = 0;
let totalConverted = 0;

allFiles.forEach((filePath) => {
  if (filePath.includes('i18n')) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  const ns = getNamespace(filePath);
  let fileModified = false;

  // Pattern: backticks with Arabic characters and possible template variables ${...}
  // Let's capture the entire backtick literal
  const backtickRegex = /`([^`]*[\u0600-\u06FF]+[^`]*)`/g;
  
  content = content.replace(backtickRegex, (match, innerText) => {
    // If it is already using t(), skip
    if (innerText.includes('t(')) return match;
    
    // Extract variables and replace them with {{var_N}}
    let placeholderText = innerText;
    const variables = [];
    const varRegex = /\$\{([^}]+)\}/g;
    let varMatch;
    let varIndex = 0;
    
    while ((varMatch = varRegex.exec(innerText)) !== null) {
      const expr = varMatch[1];
      const placeholder = `{{var_${varIndex}}}`;
      placeholderText = placeholderText.replace(varMatch[0], placeholder);
      variables.push({ name: `var_${varIndex}`, expr: expr });
      varIndex++;
    }

    // Now generate translation key for placeholderText
    const key = generateKey(placeholderText, ns);
    totalConverted++;
    fileModified = true;

    if (variables.length === 0) {
      return `t('${ns}.${key}')`;
    } else {
      const varArgs = variables.map(v => `${v.name}: ${v.expr}`).join(', ');
      return `t('${ns}.${key}', { ${varArgs} })`;
    }
  });

  // Let's also handle normal string templates/concatenations: "عربي" + expr or expr + "عربي"
  // For simplicity, handle typical hardcoded patterns:
  // e.g. {totalInventory} وحدة -> {t('ns.key', { count: totalInventory })} or similar
  const inlineSuffixRegex = /\{\s*([a-zA-Z0-9_\.\?\!\(\)]+)\s*\}\s*([\u0600-\u06FF\s]+)/g;
  content = content.replace(inlineSuffixRegex, (match, expr, arabicText) => {
    const text = `{{count}} ${arabicText.trim()}`;
    const key = generateKey(text, ns);
    totalConverted++;
    fileModified = true;
    return `{t('${ns}.${key}', { count: ${expr} })}`;
  });

  const inlinePrefixRegex = /([\u0600-\u06FF\s]+)\s*\{\s*([a-zA-Z0-9_\.\?\!\(\)]+)\s*\}/g;
  content = content.replace(inlinePrefixRegex, (match, arabicText, expr) => {
    const text = `${arabicText.trim()} {{count}}`;
    const key = generateKey(text, ns);
    totalConverted++;
    fileModified = true;
    return `{t('${ns}.${key}', { count: ${expr} })}`;
  });

  if (fileModified) {
    totalModified++;
    // Ensure useTranslation import is present
    if (!content.includes('useTranslation')) {
      content = `import { useTranslation } from "@/lib/language";\n` + content;
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Refactored remaining templates: ${filePath}`);
  }
});

// Save updated JSON translation files
namespaces.forEach(ns => {
  const arPath = path.join(LOCALES_DIR, 'ar', `${ns}.json`);
  const enPath = path.join(LOCALES_DIR, 'en', `${ns}.json`);

  fs.writeFileSync(arPath, JSON.stringify(db.ar[ns], null, 2), 'utf-8');
  fs.writeFileSync(enPath, JSON.stringify(db.en[ns], null, 2), 'utf-8');
});

console.log(`Finished advanced template literal refactoring!`);
