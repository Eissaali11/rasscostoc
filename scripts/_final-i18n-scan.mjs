import fs from 'fs';
import path from 'path';

function walk(d, acc = []) {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!['i18n', 'node_modules'].includes(e.name)) walk(p, acc);
    } else if (/\.(tsx|ts)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = walk('apps/portal/src');
let tCalls = 0;
const hard = [];

for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tm = line.match(/\bt\(\s*['"`]/g);
    if (tm) tCalls += tm.length;

    const t = line.trim();
    if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('{/*')) continue;
    if (!/[\u0600-\u06FF]/.test(line)) continue;
    if (/\.test\(/.test(line) || /new RegExp/.test(line)) continue;
    if (/\bar:\s*['"`]/.test(line)) continue;
    if (/exportToExcel|export-|queryClient/.test(f.replace(/\\/g, '/'))) continue;
    hard.push(f.replace(/\\/g, '/') + ':' + (i + 1) + ': ' + t.slice(0, 100));
  }
}

const shell = fs.readFileSync('apps/portal/src/components/layout/neo-shell-layout.tsx', 'utf8');
const report = {
  tCalls,
  hardUI: hard.length,
  hardSamples: hard.slice(0, 40),
  shell: {
    titleKey: shell.includes('titleKey'),
    changeLanguage: shell.includes('changeLanguage'),
    dirDynamic: /dir=\{dir\}/.test(shell),
    labelKey: shell.includes('labelKey'),
    languageToggle: shell.includes('button-language-toggle'),
  },
};

fs.writeFileSync('scripts/_final-i18n-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
