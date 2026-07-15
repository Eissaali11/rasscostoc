import fs from "fs";
const p = "apps/portal/src/pages/dashboard.tsx";
let c = fs.readFileSync(p, "utf8");
c = c.split('backgroundColor: "#1e293b", borderColor: "#475569", borderRadius: "12px", color: "#f8fafc"').join(
  'backgroundColor: "#FFFFFF", borderColor: "#E6E8EC", borderRadius: "12px", color: "#2D3135"'
);
c = c.split('backgroundColor: "#142d2d", borderColor: "#334155", borderRadius: "10px"').join(
  'backgroundColor: "#FFFFFF", borderColor: "#E6E8EC", borderRadius: "10px", color: "#2D3135"'
);
c = c.split('stroke="#334155"').join('stroke="#DADDE1"');
c = c.split('stroke="#64748b"').join('stroke="#7C838B"');
c = c.split('stroke="#94a3b8"').join('stroke="#7C838B"');
c = c.split('itemStyle={{ color: "#f8fafc" }}').join('itemStyle={{ color: "#2D3135" }}');
c = c.split('itemStyle={{ color: "#e2e8f0" }}').join('itemStyle={{ color: "#2D3135" }}');
fs.writeFileSync(p, c);
console.log("tooltips fixed");
