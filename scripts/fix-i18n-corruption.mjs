/**
 * Unwraps corrupted auto-refactor artifacts:
 *   t('ns.item_1081', { count: EXPR })  →  EXPR  (or {EXPR} in JSX)
 * Also fixes broken alt=t(...) attributes without braces.
 */
import fs from 'fs';
import path from 'path';

const ROOTS = [
  './apps/portal/src/pages',
  './apps/portal/src/components',
];

function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) getFiles(filePath, fileList);
    else if (/\.(tsx|ts)$/.test(file)) fileList.push(filePath);
  }
  return fileList;
}

function findMatchingParen(str, openIdx) {
  let depth = 0;
  let inStr = null;
  let escape = false;
  for (let i = openIdx; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function unwrapItem1081(content) {
  // Match t('any.item_1081', { count:
  const marker = /t\(\s*(['"])([^'"]*\.)?item_1081\1\s*,\s*\{\s*count\s*:/;
  let result = '';
  let i = 0;
  let unwrapped = 0;

  while (i < content.length) {
    const slice = content.slice(i);
    const m = marker.exec(slice);
    if (!m) {
      result += content.slice(i);
      break;
    }

    const absStart = i + m.index;
    result += content.slice(i, absStart);

    // Find start of count expression (after "count:")
    const afterMatch = absStart + m[0].length;
    let exprStart = afterMatch;
    while (exprStart < content.length && /\s/.test(content[exprStart])) exprStart++;

    // Find end of { count: EXPR } — need balanced braces from the `{` before count
    // Back up to find the `{` of options object
    let braceStart = afterMatch - 1;
    while (braceStart > absStart && content[braceStart] !== '{') braceStart--;

    // Find matching } for options, then )
    let depth = 0;
    let inStr = null;
    let escape = false;
    let optsEnd = -1;
    for (let j = braceStart; j < content.length; j++) {
      const ch = content[j];
      if (inStr) {
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { optsEnd = j; break; }
      }
    }
    if (optsEnd < 0) {
      result += content[absStart];
      i = absStart + 1;
      continue;
    }

    let closeParen = optsEnd + 1;
    while (closeParen < content.length && /\s/.test(content[closeParen])) closeParen++;
    if (content[closeParen] !== ')') {
      result += content[absStart];
      i = absStart + 1;
      continue;
    }

    // Extract EXPR between count: and the options closing }
    const expr = content.slice(exprStart, optsEnd).replace(/,\s*$/, '').trim();
    result += expr;
    unwrapped++;
    i = closeParen + 1;
  }

  return { content: result, unwrapped };
}

function fixBrokenAlt(content) {
  // alt=t('...') → alt={t('...')}
  return content.replace(/\balt=t\(/g, 'alt={t(');
}

let totalFiles = 0;
let totalUnwrapped = 0;

for (const root of ROOTS) {
  for (const file of getFiles(root)) {
    let content = fs.readFileSync(file, 'utf8');
    const before = content;
    const { content: unwrapped, unwrapped: count } = unwrapItem1081(content);
    content = fixBrokenAlt(unwrapped);
    if (content !== before) {
      fs.writeFileSync(file, content, 'utf8');
      totalFiles++;
      totalUnwrapped += count;
      console.log(`Fixed ${path.relative('.', file)} (unwrapped ${count})`);
    }
  }
}

console.log(`\nDone. Files: ${totalFiles}, unwrapped wrappers: ${totalUnwrapped}`);
