const ns = 'reports';

function processLine(line, ns) {
  const backtickCount = (line.match(/`/g) || []).length;
  
  let codePart = line;

  // 0. Pure Arabic line (JSX text on its own line)
  const pureArabicRegex = /^[ \t]*([\u0600-\u06FF][\u0600-\u06FF\s]*)$/;
  if (pureArabicRegex.test(line)) {
    const text = line.trim();
    return line.replace(text, `{t('${ns}.key')}`);
  }

  // 1. Backticks (only if no nested backticks on the line)
  if (backtickCount === 2) {
    const backtickRegex = /`([^`\n]*[\u0600-\u06FF]+[^`\n]*)`/g;
    codePart = codePart.replace(backtickRegex, (match, innerText) => {
      if (innerText.includes('t(')) return match;
      console.log("Matched backtick:", match);
      return `t('${ns}.key')`;
    });
  }

  // 2. JSX Text Nodes (only if the line contains JSX tags)
  const hasJsx = /<[a-zA-Z]|<\/[a-zA-Z]| \/>/.test(line);
  if (hasJsx) {
    const jsxTextRegex = /([>}])([^<>{}]*[\u0600-\u06FF]+[^<>{}]*)([<{])/g;
    codePart = codePart.replace(jsxTextRegex, (match, prefix, p1, suffix) => {
      const text = p1.trim();
      if (!text) return match;
      console.log("Matched jsxText:", match, "p1:", p1);
      return `${prefix}{t('${ns}.key')}${suffix}`;
    });
  }

  // 3. JSX Attribute values: name="عربي"
  const attrRegex = /([a-zA-Z0-9_-]+)=(["'])\s*([^"'\n]*[\u0600-\u06FF]+[^"'\n]*)\s*\2/g;
  codePart = codePart.replace(attrRegex, (match, attrName, quote, attrVal) => {
    const text = attrVal.trim();
    if (!text) return match;
    console.log("Matched attr:", match);
    return `${attrName}={t('${ns}.key')}`;
  });

  // 4. Object keys with Arabic: "عربي":
  // Must be preceded by start of line, comma, or open brace
  const objectKeyRegex = /(^[ \t]*|[{,][ \t]*)(["'])([^"'\n]*[\u0600-\u06FF]+[^"'\n]*)\2\s*:/g;
  codePart = codePart.replace(objectKeyRegex, (match, prefix, quote, val) => {
    const text = val.trim();
    if (!text || text.includes('${') || text.includes('t(')) return match;
    console.log("Matched objectKey:", match);
    return `${prefix}[t('${ns}.key')]:`;
  });

  // 5. String literals (excluding those already processed)
  const stringLiteralRegex = /(["'])([^"'\n{}<>]*[\u0600-\u06FF]+[^"'\n{}<>]*)\1/g;
  codePart = codePart.replace(stringLiteralRegex, (match, quote, val) => {
    const text = val.trim();
    if (!text || text.includes('${') || text.includes('t(')) return match;
    console.log("Matched stringLiteral:", match, "val:", val);
    return `t('${ns}.key')`;
  });

  return codePart;
}

console.log("TEST 1:", processLine('  "الأجهزة": "devices",', ns));
console.log("TEST 2:", processLine('alt="صورة إثبات التسليم"', ns));
console.log("TEST 3:", processLine('const x = `تم إنشاء سجل للجهاز ${device.terminalId}.`;', ns));
console.log("TEST 4:", processLine('description: `تم حفظ ${successCount} سيريال${failedCount ? `, وفشل ${failedCount}` : ""}`,', ns));
console.log("TEST 5:", processLine('    حالة الشريحة', ns));
console.log("TEST 6:", processLine('<p className="text-slate-200">حالة الشريحة: {hasSim ? "متوفرة" : "غير متوفرة"}</p>', ns));
console.log("TEST 7:", processLine('<Link href={`/products-management/${id}/details`}>تفاصيل المنتج</Link>', ns));
