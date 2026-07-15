import fs from 'fs';
import path from 'path';

const PAGES_DIR = './apps/portal/src/pages';
const COMPONENTS_DIR = './apps/portal/src/components';

const arabicRegex = /[\u0600-\u06FF]+/g;

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

const allFiles = [...getFiles(PAGES_DIR), ...getFiles(COMPONENTS_DIR)];

allFiles.forEach((filePath) => {
  if (filePath.includes('i18n')) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    
    // Ignore lines that already use t() translation calls
    if (line.includes('t(')) return;

    if (arabicRegex.test(line)) {
      console.log(`${filePath}:${idx + 1}: ${line.trim()}`);
    }
  });
});
