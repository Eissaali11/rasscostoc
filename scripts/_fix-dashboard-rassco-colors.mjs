import fs from "fs";

const p = "apps/portal/src/pages/dashboard.tsx";
let c = fs.readFileSync(p, "utf8");

const pairs = [
  ["#22d3ee", "#18B2B0"],
  ["#fb923c", "#5F6368"],
  ["#c084fc", "#F4B740"],
  ["#10b981", "#18B2B0"],
  ["#ef4444", "#E05252"],
  ["#f87171", "#E05252"],
  ["#f59e0b", "#F4B740"],
  ["bg-[#1a3636]/60", "bg-white"],
  ["bg-[#1a3636]", "bg-white"],
  ["bg-[#102222]/85", "bg-rassco-bg"],
  ["bg-[#102222]/40", "bg-rassco-bg"],
  ["hover:bg-[#1f3d3d]", "hover:bg-rassco-bg"],
  ["bg-slate-900/40", "bg-white"],
  ["bg-slate-900/60", "bg-rassco-bg"],
  ["bg-slate-950", "bg-rassco-bg"],
  ["bg-slate-800", "bg-rassco-bg"],
  ["border-slate-700/80", "border-rassco-border"],
  ["border-slate-700/60", "border-rassco-border"],
  ["border-slate-700/50", "border-rassco-border"],
  ["border-slate-700/40", "border-rassco-border"],
  ["border-slate-700/70", "border-rassco-border"],
  ["border-slate-700", "border-rassco-border"],
  ["border-slate-800", "border-rassco-border"],
  ["border-slate-600", "border-rassco-border"],
  ["text-purple-300", "text-rassco-gray"],
  ["text-purple-400", "text-rassco"],
  ["bg-purple-400", "bg-rassco-gray"],
  ["bg-purple-500/5", "bg-rassco/5"],
  ["bg-purple-500/10", "bg-rassco/10"],
  ["bg-purple-600", "bg-rassco-gray"],
  ["border-purple-400/30", "border-rassco/30"],
  ["border-purple-400/40", "border-rassco/40"],
  ["border-purple-500/30", "border-rassco/30"],
  ["hover:border-purple-400/40", "hover:border-rassco/40"],
  ["hover:border-purple-500/30", "hover:border-rassco/30"],
  ["hover:bg-purple-500/10", "hover:bg-rassco/10"],
  ["hover:shadow-purple-400/5", "hover:shadow-rassco/5"],
  ["[&>div]:bg-purple-400", "[&>div]:bg-rassco-gray"],
  ["text-orange-300", "text-rassco-warning"],
  ["text-orange-400", "text-rassco-warning"],
  ["bg-orange-400", "bg-rassco-warning"],
  ["bg-orange-500/5", "bg-rassco-warning/5"],
  ["bg-orange-500/10", "bg-rassco-warning/10"],
  ["bg-orange-500/20", "bg-rassco-warning/20"],
  ["border-orange-400/30", "border-rassco-warning/30"],
  ["border-orange-400/40", "border-rassco-warning/40"],
  ["border-orange-500/20", "border-rassco-warning/20"],
  ["hover:border-orange-400/40", "hover:border-rassco-warning/40"],
  ["hover:bg-orange-500/20", "hover:bg-rassco-warning/20"],
  ["hover:bg-orange-500/30", "hover:bg-rassco-warning/30"],
  ["hover:shadow-orange-400/5", "hover:shadow-rassco-warning/5"],
  ["[&>div]:bg-orange-400", "[&>div]:bg-rassco-warning"],
  ["text-rose-300", "text-rassco-danger"],
  ["text-rose-400", "text-rassco-danger"],
  ["bg-rose-400", "bg-rassco-danger"],
  ["bg-rose-500/5", "bg-rassco-danger/5"],
  ["bg-rose-500/10", "bg-rassco-danger/10"],
  ["bg-rose-500", "bg-rassco-danger"],
  ["border-rose-400/40", "border-rassco-danger/40"],
  ["border-rose-500/20", "border-rassco-danger/20"],
  ["hover:border-rose-400/40", "hover:border-rassco-danger/40"],
  ["hover:shadow-rose-400/5", "hover:shadow-rassco-danger/5"],
  ["[&>div]:bg-rose-500", "[&>div]:bg-rassco-danger"],
  ["text-cyan-300", "text-rassco"],
  ["text-cyan-400", "text-rassco"],
  ["bg-cyan-400/10", "bg-rassco/10"],
  ["bg-cyan-400", "bg-rassco"],
  ["bg-cyan-500/20", "bg-rassco/20"],
  ["border-cyan-400/30", "border-rassco/30"],
  ["border-cyan-400/40", "border-rassco/40"],
  ["hover:border-cyan-400/40", "hover:border-rassco/40"],
  ["hover:shadow-cyan-400/5", "hover:shadow-rassco/5"],
  ["to-cyan-300", "to-[#18B2B0]"],
  ["text-emerald-400", "text-rassco"],
  ["text-emerald-700", "text-rassco"],
  ["bg-emerald-500/15", "bg-rassco/15"],
  ["border-emerald-500/25", "border-rassco/25"],
  ["hover:border-emerald-500/50", "hover:border-rassco/50"],
  ["hover:bg-indigo-500/10", "hover:bg-rassco/10"],
  ["hover:border-indigo-500/30", "hover:border-rassco/30"],
  ["bg-indigo-600", "bg-rassco"],
  ["bg-red-600", "bg-rassco-danger"],
  ["text-slate-100", "text-rassco-text"],
  ["text-slate-200", "text-rassco-text"],
  ["text-slate-300", "text-rassco-gray"],
  ["text-slate-400", "text-rassco-muted"],
  ["text-white", "text-rassco-text"],
];

for (const [a, b] of pairs) c = c.split(a).join(b);

// Keep white text on colored badges / icon chips
c = c.replaceAll(
  'px-2 py-0.5 rounded-full bg-rassco-danger text-rassco-text text-[11px]',
  'px-2 py-0.5 rounded-full bg-rassco-danger text-white text-[11px]'
);
c = c.replaceAll(
  'bg-white/25 text-rassco-text border-white/30',
  'bg-white/25 text-white border-white/30'
);
c = c.replaceAll(
  'Icon className="w-5 h-5 text-rassco-text"',
  'Icon className="w-5 h-5 text-white"'
);

// Solid readable title (avoid broken gradient + clip on light surface)
c = c.replaceAll(
  'bg-gradient-to-r from-white via-slate-200 to-[#18B2B0] bg-clip-text text-transparent',
  'text-rassco-text'
);
c = c.replaceAll(
  'bg-gradient-to-r from-rassco-text via-rassco-text to-[#18B2B0] bg-clip-text text-transparent',
  'text-rassco-text'
);

fs.writeFileSync(p, c);
console.log("ok", p);
