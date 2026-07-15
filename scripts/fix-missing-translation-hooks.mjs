import fs from 'fs';
import path from 'path';

const PAGES_DIR = 'apps/portal/src/pages';
const COMPONENTS_DIR = 'apps/portal/src/components';
const FEATURES_DIR = 'apps/portal/src/features';

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

function injectTranslationHook(content) {
  if (content.includes('const { t } = useTranslation();') || content.includes('const { t } = useTranslation(') || content.includes('useLanguage(')) {
    return content;
  }

  // Try finding export default function ... {
  const defaultFuncMatch = content.match(/export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{/);
  if (defaultFuncMatch) {
    const idx = defaultFuncMatch.index + defaultFuncMatch[0].length;
    return content.slice(0, idx) + '\n  const { t } = useTranslation();' + content.slice(idx);
  }

  // Try finding export function ... {
  const funcMatch = content.match(/export\s+function\s+\w+\s*\([^)]*\)\s*\{/);
  if (funcMatch) {
    const idx = funcMatch.index + funcMatch[0].length;
    return content.slice(0, idx) + '\n  const { t } = useTranslation();' + content.slice(idx);
  }

  // Try finding export default function ... (multi-line)
  const defaultFuncMatchMultiLine = content.match(/export\s+default\s+function\s+\w+[\s\S]*?\{/);
  if (defaultFuncMatchMultiLine) {
    const idx = defaultFuncMatchMultiLine.index + defaultFuncMatchMultiLine[0].length;
    return content.slice(0, idx) + '\n  const { t } = useTranslation();' + content.slice(idx);
  }

  // Try finding first const ... = ... => {
  const arrowMatch = content.match(/const\s+\w+\s*=\s*[\s\S]*?=>\s*\{/);
  if (arrowMatch) {
    const idx = arrowMatch.index + arrowMatch[0].length;
    return content.slice(0, idx) + '\n  const { t } = useTranslation();' + content.slice(idx);
  }

  return content;
}

const allFiles = [...getFiles(PAGES_DIR), ...getFiles(COMPONENTS_DIR), ...getFiles(FEATURES_DIR)];

allFiles.forEach((filePath) => {
  if (filePath.endsWith('.d.ts') || filePath.includes('i18n')) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Match t(' or t(" or t(`
  const hasTranslationCall = /\bt\(['"`]|\bt\(\s*[a-zA-Z]/.test(content);
  if (hasTranslationCall) {
    // Check if useTranslation is imported
    if (!content.includes('useTranslation') && !content.includes('useLanguage')) {
      content = `import { useTranslation } from "@/lib/language";\n` + content;
      modified = true;
    }

    // Check if the hook is injected
    const newContent = injectTranslationHook(content);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`Fixed translation hook/import in: ${filePath}`);
    }
  }
});
