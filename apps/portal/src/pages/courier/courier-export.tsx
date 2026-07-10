import { Link } from "wouter";
import {
  Download,
  Calendar,
  CheckCircle2,
  XCircle,
  Hourglass,
  Layers,
  Sliders
} from "lucide-react";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const QUICK_EXPORTS = [
  {
    label: "تصدير كافة السجلات",
    icon: Layers,
    params: new URLSearchParams(),
    color: "text-cyan-400 border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/5"
  },
  {
    label: "تصدير حركة اليوم فقط",
    icon: Calendar,
    params: new URLSearchParams({ dateFrom: todayIso(), dateTo: todayIso() }),
    color: "text-emerald-400 border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/5"
  },
  {
    label: "تصدير الطلبات المكتملة",
    icon: CheckCircle2,
    params: new URLSearchParams({ status: "Installation Completed - NL" }),
    color: "text-sky-400 border-sky-500/30 hover:border-sky-400 hover:bg-sky-500/5"
  },
  {
    label: "تصدير الطلبات غير المكتملة",
    icon: XCircle,
    params: new URLSearchParams({ status: "Not Completed" }),
    color: "text-red-400 border-red-500/30 hover:border-red-400 hover:bg-red-500/5"
  },
  {
    label: "تصدير المعاملات تحت الإجراء",
    icon: Hourglass,
    params: new URLSearchParams({ status: "Under Process" }),
    color: "text-amber-400 border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/5"
  }
];

export default function CourierExportPage() {
  const getExportUrl = (params: URLSearchParams) => {
    const token = localStorage.getItem("auth-token") || "";
    params.set("token", token);
    return `/api/courier/requests/export?${params.toString()}`;
  };

  return (
    <div dir="rtl" className="space-y-6 text-slate-100 max-w-4xl">
      {/* Header */}
      <div className="border-b border-slate-700/60 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Download className="w-6 h-6 text-cyan-400" />
          تصدير جداول Excel
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          بوابتك لتصدير تقارير التسليم والمعالجة الميدانية في صيغ معيارية جاهزة للتحليل الفوري.
        </p>
      </div>

      {/* Grid options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUICK_EXPORTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <a
              key={idx}
              href={getExportUrl(item.params)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-4 p-5 bg-[#1a3636] border rounded-2xl shadow-lg transition-all duration-200 ${item.color}`}
            >
              <div className="p-3 bg-slate-900/40 rounded-xl">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <span className="font-semibold text-white block">{item.label}</span>
                <span className="text-xs text-slate-400 mt-0.5 block">ملف Excel (.xlsx) منسق ومبوب</span>
              </div>
            </a>
          );
        })}

        <Link
          href="/courier/reports"
          className="flex items-center gap-4 p-5 bg-[#1a3636] border border-slate-700/60 hover:border-cyan-400 hover:bg-cyan-500/5 rounded-2xl shadow-lg transition-all duration-200 text-cyan-400"
        >
          <div className="p-3 bg-slate-900/40 rounded-xl">
            <Sliders className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <span className="font-semibold text-white block">فلترة وتخصيص متقدم</span>
            <span className="text-xs text-slate-400 mt-0.5 block">انتقل إلى محرك التقارير المتقدم لتحديد فلاتر دقيقة</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
