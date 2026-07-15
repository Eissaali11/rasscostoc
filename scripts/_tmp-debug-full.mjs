import fs from 'fs';
import path from 'path';

// Let's load wordMap and databases
const wordMap = {
  "لا": "no", "يوجد": "present"
};

const db = { ar: { reports: {} }, en: { reports: {} } };

function translateText(arabic) {
  const clean = arabic.replace(/[^\u0600-\u06FF\s]+/g, ' ').trim();
  const tokens = clean.split(/\s+/).filter(Boolean);
  
  const englishTokens = tokens.map(token => {
    if (wordMap[token]) return wordMap[token];
    return '';
  }).filter(Boolean);

  if (englishTokens.length === 0) {
    return 'item_hash';
  }
  return englishTokens.join(' ');
}

function generateKey(arabic, ns) {
  const translated = translateText(arabic);
  let baseKey = translated.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
  return baseKey;
}

// Exactly processLine
function processLine(line, ns, isInsideBackticks) {
  if (line.trim().startsWith('import ') || line.trim().startsWith('import{') || line.trim().includes('from \'') || line.trim().includes('from "')) {
    return { line, modified: false };
  }

  let codePart = line;
  let commentPart = '';
  const commentIdx = line.indexOf('//');
  if (commentIdx !== -1) {
    const beforeComment = line.slice(0, commentIdx);
    const doubleQuotes = (beforeComment.match(/"/g) || []).length;
    const singleQuotes = (beforeComment.match(/'/g) || []).length;
    const backticks = (beforeComment.match(/`/g) || []).length;
    if (doubleQuotes % 2 === 0 && singleQuotes % 2 === 0 && backticks % 2 === 0) {
      codePart = beforeComment;
      commentPart = line.slice(commentIdx);
    }
  }

  let lineModified = false;

  const pureArabicRegex = /^[ \t]*([\u0600-\u06FF][\u0600-\u06FF\s]*)$/;
  if (pureArabicRegex.test(codePart)) {
    const text = codePart.trim();
    const key = generateKey(text, ns);
    return { line: codePart.replace(text, `{t('${ns}.${key}')}`) + commentPart, modified: true };
  }

  const backtickCount = (codePart.match(/`/g) || []).length;
  if (backtickCount === 2) {
    const backtickRegex = /`([^`\n]*[\u0600-\u06FF]+[^`\n]*)`/g;
    codePart = codePart.replace(backtickRegex, (match, innerText) => {
      const key = generateKey(innerText, ns);
      lineModified = true;
      return `t('${ns}.${key}')`;
    });
  }

  const hasJsx = !isInsideBackticks && /<[a-zA-Z]|<\/[a-zA-Z]| \/>/.test(codePart);
  if (hasJsx) {
    const jsxTextRegex = /([>}])([^<>{}]*[\u0600-\u06FF]+[^<>{}]*)([<{])/g;
    codePart = codePart.replace(jsxTextRegex, (match, prefix, p1, suffix) => {
      const text = p1.trim();
      if (!text) return match;
      const key = generateKey(text, ns);
      lineModified = true;
      return `${prefix}{t('${ns}.${key}')}${suffix}`;
    });
  }

  const attrRegex = /([a-zA-Z0-9_-]+)=(["'])\s*([^"'\n]*[\u0600-\u06FF]+[^"'\n]*)\s*\2/g;
  if (!isInsideBackticks) {
    codePart = codePart.replace(attrRegex, (match, attrName, quote, attrVal) => {
      const text = attrVal.trim();
      if (!text) return match;
      const key = generateKey(text, ns);
      lineModified = true;
      return `${attrName}={t('${ns}.${key}')}`;
    });
  }

  const objectKeyRegex = /(^[ \t]*|[{,][ \t]*)(["'])([^"'\n]*[\u0600-\u06FF]+[^"'\n]*)\2\s*:/g;
  codePart = codePart.replace(objectKeyRegex, (match, prefix, quote, val) => {
    const text = val.trim();
    if (!text || text.includes('${') || text.includes('t(')) return match;
    const key = generateKey(text, ns);
    lineModified = true;
    return `${prefix}[t('${ns}.${key}')]:`;
  });

  const stringLiteralRegex = /(["'])([^"'\n{}<>]*[\u0600-\u06FF]+[^"'\n{}<>]*)\1/g;
  codePart = codePart.replace(stringLiteralRegex, (match, quote, val) => {
    const text = val.trim();
    if (!text || text.includes('${') || text.includes('t(')) return match;
    const key = generateKey(text, ns);
    lineModified = true;
    return `t('${ns}.${key}')`;
  });

  const inlineSuffixRegex = /\{\s*([a-zA-Z0-9_\.\?\!\(\)\[\]\?]+)\s*\}\s*([ \t]*[\u0600-\u06FF]+[ \t\u0600-\u06FF]*)/g;
  codePart = codePart.replace(inlineSuffixRegex, (match, expr, arabicText) => {
    const text = `{{count}} ${arabicText.trim()}`;
    const key = generateKey(text, ns);
    lineModified = true;
    return `{t('${ns}.${key}', { count: ${expr} })}`;
  });

  const inlinePrefixRegex = /([ \t]*[\u0600-\u06FF]+[ \t\u0600-\u06FF]*)\s*\{\s*([a-zA-Z0-9_\.\?\!\(\)\[\]\?]+)\s*\}/g;
  codePart = codePart.replace(inlinePrefixRegex, (match, arabicText, expr) => {
    const text = `${arabicText.trim()} {{count}}`;
    const key = generateKey(text, ns);
    lineModified = true;
    return `{t('${ns}.${key}', { count: ${expr} })}`;
  });

  return { line: codePart + commentPart, modified: lineModified };
}

const lines = [
  '  if (',
  '    /^(لا|no|false|0|لا يوجد)$/i.test(normalized) ||',
  '    /(لا يوجد\\s*ملحقات|لا يوجد\\s*شاحن|لا يوجد\\s*سلك|cancel|none|n\\/a)/i.test(normalized)',
  '  ) {'
];

lines.forEach(l => {
  const res = processLine(l, 'reports', false);
  console.log(`Original: "${l}"`);
  console.log(`Result:   "${res.line}" (modified: ${res.modified})`);
});
