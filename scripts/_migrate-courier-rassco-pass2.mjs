import fs from "fs";

const files = [
  "apps/portal/src/pages/courier/courier-raw-data.tsx",
  "apps/portal/src/pages/courier/courier-requests.tsx",
  "apps/portal/src/pages/courier/courier-pdf-upload.tsx",
  "apps/portal/src/pages/courier/courier-pdf-review.tsx",
  "apps/portal/src/pages/courier/courier-reports.tsx",
  "apps/portal/src/pages/courier/courier-export.tsx",
  "apps/portal/src/pages/courier/courier-request-detail.tsx",
  "apps/portal/src/components/add-courier-request-modal.tsx",
  "apps/portal/src/components/edit-courier-execution-modal.tsx",
];

const reps = [
  [/text-slate-950/g, "text-white"],
  [/hover:bg-cyan-400/g, "hover:bg-[#149D9B]"],
  [/shadow-cyan-500\/10/g, "shadow-[#18B2B0]/20"],
  [/text-emerald-450\/70/g, "text-[#18B2B0]/70"],
  [/text-emerald-450/g, "text-[#18B2B0]"],
  [/text-emerald-500\/80/g, "text-[#18B2B0]/80"],
  [/border-emerald-500\/40/g, "border-[#18B2B0]/40"],
  [/border-emerald-500\/20/g, "border-[#18B2B0]/25"],
  [/border-emerald-700\/40/g, "border-[#18B2B0]/30"],
  [/border-emerald-500\/30/g, "border-[#18B2B0]/30"],
  [/hover:border-emerald-400/g, "hover:border-[#18B2B0]"],
  [/divide-slate-800/g, "divide-[#E2E8F0]"],
  [/hover:bg-\[#1f3a4d\]/g, "hover:bg-[#374151]"],
  [/hover:bg-\[#2d5355\]/g, "hover:bg-[#149D9B]"],
  [/hover:bg-\[#18B2B0\]\/5(?!\d)/g, "hover:bg-[#18B2B0]/05"],
  [/font-semibold text-white block/g, "font-semibold text-[#2D3135] block"],
  [/hover:bg-\[#F1F5F9\] hover:text-white/g, "hover:bg-[#F1F5F9] hover:text-[#2D3135]"],
];

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  const before = s;
  for (const [re, to] of reps) s = s.replace(re, to);
  if (s !== before) {
    fs.writeFileSync(f, s);
    console.log("fixed", f);
  } else {
    console.log("ok", f);
  }
}
