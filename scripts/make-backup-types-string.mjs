import fs from 'fs';
const path = 'apps/portal/src/pages/backup-management.tsx';
let content = fs.readFileSync(path, 'utf-8');
content = content.replace(/"محلي" \| "سحابي"/g, 'string');
content = content.replace(/"سحابي"/g, 'string');
content = content.replace(/"محلي"/g, 'string');
fs.writeFileSync(path, content, 'utf-8');
console.log('Modified backup-management.tsx types');
