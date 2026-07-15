function processLine(line, ns, isInsideBackticks) {
  let codePart = line;
  let lineModified = false;

  // 3. JSX Attribute values: name="عربي" or name='عربي' (not inside backticks)
  const attrRegex = /([a-zA-Z0-9_-]+)=(["'])\s*([^"'\n]*[\u0600-\u06FF]+[^"'\n]*)\s*\2/g;
  if (!isInsideBackticks) {
    codePart = codePart.replace(attrRegex, (match, attrName, quote, attrVal) => {
      console.log('Matched attrRegex with:', match);
      return `${attrName}={t('${ns}.key')}`;
    });
  }

  // 5. String literals (excluding those already processed)
  const stringLiteralRegex = /(["'])([^"'\n{}<>]*[\u0600-\u06FF]+[^"'\n{}<>]*)\1/g;
  codePart = codePart.replace(stringLiteralRegex, (match, quote, val) => {
    console.log('Matched stringLiteralRegex with:', match);
    return `t('${ns}.key')`;
  });

  return codePart;
}

const line = '                  <Area type="monotone" name="ثابت" dataKey="fixed" stroke="#18B2B0" strokeWidth={3}fill="url(#smFixed)" {...chartAnim}/>';
console.log('Result:', processLine(line, 'common', false));
