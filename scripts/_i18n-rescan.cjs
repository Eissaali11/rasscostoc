const fs = require('fs');
const path = require('path');

const ARABIC = /[\u0600-\u06FF]/;
const roots = [
  'apps/portal/src/pages',
  'apps/portal/src/components',
  'apps/portal/src/features',
  'apps/portal/src/lib',
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'ui' || e.name === 'scratch') continue;
      walk(p, acc);
    } else if (/\.(tsx|ts)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function isComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*');
}

function isRegexMatcher(line) {
  return (/\/\([^)]*[\u0600-\u06FF]/.test(line) || /\.test\(/.test(line)) && ARABIC.test(line);
}

function isBilingualMap(line) {
  return /\bar\s*:\s*['"`]/.test(line) || /"ar"\s*:/.test(line);
}

const results = [];
for (const root of roots) {
  for (const file of walk(root)) {
    // skip export bilingual dictionary body but keep if literal UI outside map - we already converted
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    let inExcelMap = false;
    lines.forEach((line, i) => {
      if (file.includes('exportToExcel') && (line.includes('const EXCEL_I18N') || line.includes('EXCEL_I18N'))) inExcelMap = true;
      if (inExcelMap && (line.includes('} as const') || line.trim() === '};')) {
        // end of map object — keep excluding until we leave the const block
        if (line.includes('as const')) inExcelMap = false;
      }
      if (inExcelMap) return;
      if (/^\s*const p\d+\s*=\s*\{\s*ar:/.test(line)) return;
      if (file.includes('queryClient') && (line.includes('const messages') || line.includes("ar: '"))) return;
      if (!ARABIC.test(line)) return;
      if (isComment(line)) return;
      if (isRegexMatcher(line)) return;
      if (isBilingualMap(line)) return;
      // keep Arabic data-matching includes like "رئيس"
      if (/includes\(["'][\u0600-\u06FF]/.test(line)) return;
      results.push({
        file: file.replace(/\\/g, '/'),
        line: i + 1,
        text: line.trim().slice(0, 160),
      });
    });
  }
}

fs.writeFileSync('scripts/_remaining-arabic-rescanned.json', JSON.stringify(results, null, 2));
const byFile = {};
for (const r of results) byFile[r.file] = (byFile[r.file] || 0) + 1;
const top = Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 30);
console.log(JSON.stringify({ total: results.length, files: Object.keys(byFile).length, top, sample: results.slice(0, 40) }, null, 2));
