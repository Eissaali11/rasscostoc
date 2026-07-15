import fs from 'fs';

const ns = 'reports';

// Copied exactly from refactor-translations.mjs:
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

  // 0. Pure Arabic line
  const pureArabicRegex = /^[ \t]*([\u0600-\u06FF][\u0600-\u06FF\s]*)$/;
  if (pureArabicRegex.test(codePart)) {
    console.log('Matched rule 0');
    return { line: 'rule 0', modified: true };
  }

  // 1. Backticks
  const backtickCount = (codePart.match(/`/g) || []).length;
  if (backtickCount === 2) {
    const backtickRegex = /`([^`\n]*[\u0600-\u06FF]+[^`\n]*)`/g;
    if (backtickRegex.test(codePart)) {
      console.log('Matched rule 1');
    }
  }

  // 2. JSX Text
  const hasJsx = !isInsideBackticks && /<[a-zA-Z]|<\/[a-zA-Z]| \/>/.test(codePart);
  if (hasJsx) {
    const jsxTextRegex = /([>}])([^<>{}]*[\u0600-\u06FF]+[^<>{}]*)([<{])/g;
    if (jsxTextRegex.test(codePart)) {
      console.log('Matched rule 2');
    }
  }

  // 3. JSX Attr
  const attrRegex = /([a-zA-Z0-9_-]+)=(["'])\s*([^"'\n]*[\u0600-\u06FF]+[^"'\n]*)\s*\2/g;
  if (!isInsideBackticks && attrRegex.test(codePart)) {
    console.log('Matched rule 3');
  }

  // 4. Object keys
  const objectKeyRegex = /(^[ \t]*|[{,][ \t]*)(["'])([^"'\n]*[\u0600-\u06FF]+[^"'\n]*)\2\s*:/g;
  if (objectKeyRegex.test(codePart)) {
    console.log('Matched rule 4');
  }

  // 5. String literals
  const stringLiteralRegex = /(["'])([^"'\n{}<>]*[\u0600-\u06FF]+[^"'\n{}<>]*)\1/g;
  if (stringLiteralRegex.test(codePart)) {
    console.log('Matched rule 5');
  }

  // 6. Inline suffix
  const inlineSuffixRegex = /\{\s*([a-zA-Z0-9_\.\?\!\(\)\[\]\?]+)\s*\}\s*([ \t]*[\u0600-\u06FF]+[ \t\u0600-\u06FF]*)/g;
  if (inlineSuffixRegex.test(codePart)) {
    console.log('Matched rule 6');
  }

  // 7. Inline prefix
  const inlinePrefixRegex = /([ \t]*[\u0600-\u06FF]+[ \t\u0600-\u06FF]*)\s*\{\s*([a-zA-Z0-9_\.\?\!\(\)\[\]\?]+)\s*\}/g;
  if (inlinePrefixRegex.test(codePart)) {
    console.log('Matched rule 7');
  }
}

const line1 = '    /^(لا|no|false|0|لا يوجد)$/i.test(normalized) ||';
processLine(line1, ns, false);
