/**
 * One-shot: migrate courier legacy dark theme classes → RASSCO light design system.
 * UI-only class/string replacements; no business logic changes.
 */
import fs from "fs";
import path from "path";

const root = path.resolve("apps/portal/src");
const files = [
  "pages/courier/courier-raw-data.tsx",
  "pages/courier/courier-requests.tsx",
  "pages/courier/courier-pdf-upload.tsx",
  "pages/courier/courier-pdf-review.tsx",
  "pages/courier/courier-reports.tsx",
  "pages/courier/courier-export.tsx",
  "pages/courier/courier-request-detail.tsx",
  "components/add-courier-request-modal.tsx",
  "components/edit-courier-execution-modal.tsx",
];

/** Ordered: longer / more specific first */
const replacements = [
  // Dark shell / cards
  [/bg-\[#0f1c1c\]/g, "bg-white"],
  [/bg-\[#0b1717\]\/40/g, "bg-[#F8FAFC]"],
  [/bg-\[#0b1717\]/g, "bg-white"],
  [/bg-\[#142d2d\]/g, "bg-[#F8FAFC]"],
  [/bg-\[#1e3d3d\]/g, "bg-[#F1F5F9]"],
  [/bg-\[#1a3636\]/g, "bg-white"],
  [/bg-\[#102222\]\/50/g, "bg-[#F8FAFC]"],
  [/bg-\[#102222\]/g, "bg-[#F8FAFC]"],
  [/bg-\[#284b63\]/g, "bg-[#4B5563]"],
  [/bg-\[#3c6e71\]/g, "bg-[#18B2B0]"],

  // Borders
  [/border-slate-750/g, "border-[#E2E8F0]"],
  [/border-slate-700\/80/g, "border-[#E2E8F0]"],
  [/border-slate-700\/60/g, "border-[#E2E8F0]"],
  [/border-slate-700\/50/g, "border-[#E2E8F0]"],
  [/border-slate-700\/40/g, "border-[#E2E8F0]"],
  [/border-slate-700\/30/g, "border-[#E2E8F0]"],
  [/border-slate-700\/25/g, "border-[#E2E8F0]"],
  [/border-slate-700/g, "border-[#E2E8F0]"],
  [/border-slate-600/g, "border-[#E2E8F0]"],
  [/divide-slate-700\/30/g, "divide-[#E2E8F0]"],
  [/divide-slate-700/g, "divide-[#E2E8F0]"],

  // Slate backgrounds
  [/bg-slate-900\/40/g, "bg-[#F8FAFC]"],
  [/bg-slate-800\/60/g, "bg-white"],
  [/bg-slate-800\/50/g, "bg-[#F8FAFC]"],
  [/bg-slate-800\/40/g, "bg-white"],
  [/bg-slate-800\/20/g, "bg-[#F8FAFC]"],
  [/bg-slate-800\/10/g, "bg-[#F8FAFC]"],
  [/hover:bg-slate-800\/20/g, "hover:bg-[#18B2B0]/05"],
  [/hover:bg-slate-800\/40/g, "hover:bg-[#F1F5F9]"],
  [/hover:bg-slate-800/g, "hover:bg-[#F1F5F9]"],
  [/disabled:hover:bg-slate-800\/40/g, "disabled:hover:bg-white"],
  [/disabled:hover:bg-slate-800/g, "disabled:hover:bg-white"],
  [/bg-slate-800/g, "bg-[#F8FAFC]"],
  [/bg-slate-750/g, "bg-[#4B5563]"],
  [/hover:bg-slate-750/g, "hover:bg-[#374151]"],
  [/hover:bg-slate-700\/15/g, "hover:bg-[#18B2B0]/05"],
  [/hover:bg-slate-700\/10/g, "hover:bg-[#18B2B0]/05"],
  [/bg-slate-700\/50/g, "bg-[#E2E8F0]"],
  [/bg-slate-700\/40/g, "bg-[#F1F5F9]"],
  [/bg-slate-700\/30/g, "bg-[#F1F5F9]"],
  [/bg-slate-700\/15/g, "bg-[#F1F5F9]"],
  [/hover:bg-slate-700/g, "hover:bg-[#374151]"],
  [/hover:bg-slate-600/g, "hover:bg-[#374151]"],
  [/bg-slate-700/g, "bg-[#4B5563]"],
  [/bg-slate-600/g, "bg-[#6B7280]"],

  // Typography (dark → RASSCO text)
  [/text-slate-100/g, "text-[#2D3135]"],
  [/text-slate-200/g, "text-[#2D3135]"],
  [/text-slate-300/g, "text-[#4B5563]"],
  [/text-slate-400/g, "text-[#6B7280]"],
  [/text-slate-500/g, "text-[#6B7280]"],
  [/text-slate-600/g, "text-[#6B7280]"],
  [/placeholder-slate-600/g, "placeholder-[#9CA3AF]"],
  [/placeholder-slate-500/g, "placeholder-[#9CA3AF]"],
  [/hover:text-slate-200/g, "hover:text-[#2D3135]"],
  [/disabled:hover:text-slate-400/g, "disabled:hover:text-[#6B7280]"],

  // Headings that used white on dark shells
  [/tracking-tight text-white/g, "tracking-tight text-[#2D3135]"],
  [/font-bold text-white/g, "font-bold text-[#2D3135]"],
  [/font-extrabold text-white/g, "font-extrabold text-[#2D3135]"],

  // Emerald → RASSCO primary
  [/bg-emerald-600 hover:bg-emerald-700/g, "bg-[#18B2B0] hover:bg-[#149D9B]"],
  [/bg-emerald-700\/40/g, "bg-[#18B2B0]/15"],
  [/bg-emerald-700/g, "bg-[#149D9B]"],
  [/bg-emerald-600/g, "bg-[#18B2B0]"],
  [/bg-emerald-500\/15/g, "bg-[#18B2B0]/12"],
  [/bg-emerald-500/g, "bg-[#18B2B0]"],
  [/text-emerald-400/g, "text-[#18B2B0]"],
  [/text-emerald-300/g, "text-[#18B2B0]"],
  [/text-emerald-600/g, "text-[#18B2B0]"],
  [/border-emerald-500\/25/g, "border-[#18B2B0]/25"],
  [/border-emerald-500\/60/g, "border-[#18B2B0]"],
  [/focus:border-emerald-500\/60/g, "focus:border-[#18B2B0]"],
  [/shadow-emerald-500\/50/g, "shadow-[#18B2B0]/30"],
  [/shadow-emerald-500\/10/g, "shadow-[#18B2B0]/20"],
  [/shadow-lg shadow-emerald-500\/10/g, "shadow-lg shadow-[#18B2B0]/20"],

  // Cyan → primary
  [/text-cyan-400/g, "text-[#18B2B0]"],
  [/text-cyan-300/g, "text-[#18B2B0]"],
  [/bg-cyan-500\/5/g, "bg-[#18B2B0]/05"],
  [/bg-cyan-500\/10/g, "bg-[#18B2B0]/10"],
  [/bg-cyan-500/g, "bg-[#18B2B0]"],
  [/border-cyan-500\/30/g, "border-[#18B2B0]/30"],
  [/border-cyan-400\/80/g, "border-[#18B2B0]"],
  [/border-cyan-400/g, "border-[#18B2B0]"],
  [/hover:border-cyan-400/g, "hover:border-[#18B2B0]"],
  [/hover:bg-cyan-500\/5/g, "hover:bg-[#18B2B0]/05"],
  [/focus:border-cyan-400\/80/g, "focus:border-[#18B2B0]"],
  [/focus-within:border-cyan-400\/80/g, "focus-within:border-[#18B2B0]"],

  // Purple (PDF) → primary
  [/text-purple-400/g, "text-[#18B2B0]"],
  [/text-purple-300/g, "text-[#18B2B0]"],
  [/hover:text-purple-300/g, "hover:text-[#149D9B]"],
  [/bg-purple-600 hover:bg-purple-500/g, "bg-[#18B2B0] hover:bg-[#149D9B]"],
  [/bg-purple-600/g, "bg-[#18B2B0]"],
  [/bg-purple-500\/20/g, "bg-[#18B2B0]/15"],
  [/bg-purple-500\/10/g, "bg-[#18B2B0]/10"],
  [/bg-purple-500\/5/g, "bg-[#18B2B0]/05"],
  [/border-purple-500/g, "border-[#18B2B0]"],
  [/focus:border-purple-500/g, "focus:border-[#18B2B0]"],
  [/shadow-purple-900\/10/g, "shadow-[#18B2B0]/20"],
  [/hover:bg-purple-500\/20/g, "hover:bg-[#18B2B0]/15"],

  // Export card accent variants → RASSCO
  [/text-emerald-400 border-emerald-500\/30 hover:border-emerald-400 hover:bg-emerald-500\/5/g, "text-[#18B2B0] border-[#18B2B0]/30 hover:border-[#18B2B0] hover:bg-[#18B2B0]/05"],
  [/text-sky-400 border-sky-500\/30 hover:border-sky-400 hover:bg-sky-500\/5/g, "text-[#18B2B0] border-[#18B2B0]/30 hover:border-[#18B2B0] hover:bg-[#18B2B0]/05"],
  [/text-red-400 border-red-500\/30 hover:border-red-400 hover:bg-red-500\/5/g, "text-[#E05252] border-[#E05252]/30 hover:border-[#E05252] hover:bg-[#E05252]/05"],
  [/text-amber-400 border-amber-500\/30 hover:border-amber-400 hover:bg-amber-500\/5/g, "text-[#F4B740] border-[#F4B740]/30 hover:border-[#F4B740] hover:bg-[#F4B740]/05"],
  [/text-cyan-400 border-cyan-500\/30 hover:border-cyan-400 hover:bg-cyan-500\/5/g, "text-[#18B2B0] border-[#18B2B0]/30 hover:border-[#18B2B0] hover:bg-[#18B2B0]/05"],

  // Status semantic (keep meaning, lighten surfaces)
  [/text-red-400 bg-red-500\/15/g, "text-[#E05252] bg-[#E05252]/12"],
  [/border-red-500\/25/g, "border-[#E05252]/25"],
  [/text-amber-400 bg-amber-500\/15/g, "text-[#B45309] bg-[#F4B740]/18"],
  [/border-amber-500\/25/g, "border-[#F4B740]/35"],
  [/text-indigo-400 bg-indigo-500\/15/g, "text-[#4B5563] bg-[#4B5563]/10"],
  [/border-indigo-500\/25/g, "border-[#4B5563]/20"],
  [/text-emerald-400 bg-emerald-500\/15/g, "text-[#18B2B0] bg-[#18B2B0]/12"],

  // Page roots
  [/className="space-y-6 text-\[#2D3135\]/g, 'className="rassco-page space-y-6 text-[#2D3135]'],
  [/className="space-y-8 text-\[#2D3135\]/g, 'className="rassco-page space-y-8 text-[#2D3135]'],
];

let totalChanges = 0;
for (const rel of files) {
  const full = path.join(root, rel);
  let src = fs.readFileSync(full, "utf8");
  const before = src;
  for (const [re, to] of replacements) {
    src = src.replace(re, to);
  }
  // Preserve white text on primary buttons
  src = src.replace(
    /bg-\[#18B2B0\]([^\n"']*?)text-\[#2D3135\]/g,
    "bg-[#18B2B0]$1text-white"
  );
  src = src.replace(
    /bg-\[#149D9B\]([^\n"']*?)text-\[#2D3135\]/g,
    "bg-[#149D9B]$1text-white"
  );
  src = src.replace(
    /bg-\[#4B5563\]([^\n"']*?)text-\[#2D3135\]/g,
    "bg-[#4B5563]$1text-white"
  );
  // Phase circles: emerald text-slate-900 → white
  src = src.replace(/bg-\[#18B2B0\] text-slate-900/g, "bg-[#18B2B0] text-white");

  if (src !== before) {
    fs.writeFileSync(full, src);
    const delta = [...before].filter((c, i) => c !== src[i]).length;
    totalChanges++;
    console.log(`updated ${rel}`);
  } else {
    console.log(`unchanged ${rel}`);
  }
}
console.log(`done: ${totalChanges}/${files.length} files`);
