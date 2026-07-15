const fs = require('fs');

const files = [
  'apps/portal/src/components/sidebar.tsx',
  'apps/portal/src/components/dashboard/Navbar.tsx',
  'apps/portal/src/pages/landing.tsx',
];

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const before = (s.match(/setLanguage/g) || []).length;
  s = s.replace(/\bsetLanguage\b/g, 'changeLanguage');
  // avoid changing setLanguageState in provider - not in these files
  fs.writeFileSync(f, s);
  const after = (s.match(/setLanguage/g) || []).length;
  const change = (s.match(/changeLanguage/g) || []).length;
  console.log(f, { before, after, changeLanguage: change });
}
