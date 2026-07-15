import fs from 'fs';
import path from 'path';

const PAGES_DIR = './apps/portal/src/pages';
const COMPONENTS_DIR = './apps/portal/src/components';

const arabicRegex = /[\u0600-\u06FF\s0-9%٬٫()\-+:]+/g;

// Helper to recursively list files
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const allFiles = [...getFiles(PAGES_DIR), ...getFiles(COMPONENTS_DIR)];
const extractedStrings = new Set();

allFiles.forEach((filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Find strings inside JSX tags: >العربية<
  const jsxTextRegex = />([^<]*[\u0600-\u06FF]+[^<]*)</g;
  let match;
  while ((match = jsxTextRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (text && !text.startsWith('{') && !text.endsWith('}')) {
      extractedStrings.add(text);
    }
  }

  // Find strings in attributes: placeholder="بحث"
  const attrRegex = /(placeholder|label|title|description|headerText|text|heading|tooltip|message|value)="\s*([\u0600-\u06FF\s0-9%٬٫()\-+:]+)\s*"/g;
  while ((match = attrRegex.exec(content)) !== null) {
    extractedStrings.add(match[2].trim());
  }

  // Find string literals: 'عربي' or "عربي" in JS/TS code
  const stringLiteralRegex = /['"`]([\u0600-\u06FF\s0-9%٬٫()\-+:\.]+[\u0600-\u06FF]+[\u0600-\u06FF\s0-9%٬٫()\-+:\.]*)['"`]/g;
  while ((match = stringLiteralRegex.exec(content)) !== null) {
    extractedStrings.add(match[1].trim());
  }
});

const sorted = Array.from(extractedStrings).sort();
fs.mkdirSync('./apps/portal/src/i18n/scratch', { recursive: true });
fs.writeFileSync('./apps/portal/src/i18n/scratch/extracted.json', JSON.stringify(sorted, null, 2), 'utf-8');

console.log(`Extracted ${sorted.length} unique Arabic strings to apps/portal/src/i18n/scratch/extracted.json`);
