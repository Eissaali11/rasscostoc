import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  BrainCircuit,
  Loader2,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronLeft
} from "lucide-react";

interface RecentReport {
  id: number;
  fileName: string;
  status: string;
  overallConfidence: number | null;
  uploadedAt: string;
  uploadedByName: string | null;
}

interface Stats {
  total: number;
  applied: number;
  pending: number;
  failed: number;
  avgConfidence: number | null;
  recent: RecentReport[];
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
        بدون
      </span>
    );
  }

  const pct = Math.round(value * 100);
  let color = "bg-red-500/15 text-red-400 border-red-500/30";
  if (pct >= 90) {
    color = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  } else if (pct >= 70) {
    color = "bg-amber-500/15 text-amber-400 border-amber-500/30";
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      {pct}% ثقة
    </span>
  );
}

export default function CourierAiMonitorPage() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/courier/ai-monitor/stats"],
    queryFn: () => apiRequest("GET", "/api/courier/ai-monitor/stats").then((r) => r.json())
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400 ml-2" />
        جاري تحميل بيانات مراقبة الذكاء الاصطناعي...
      </div>
    );
  }

  const total = stats?.total || 0;
  const applied = stats?.applied || 0;
  const pending = stats?.pending || 0;
  const failed = stats?.failed || 0;
  const avgConf = stats?.avgConfidence || 0;
  const recent = stats?.recent || [];

  return (
    <div dir="rtl" className="space-y-6 text-slate-100">
      {/* Title */}
      <div className="border-b border-slate-700/60 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-cyan-400" />
          مراقبة وتدقيق الذكاء الاصطناعي (AI Monitor)
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          أداء ومؤشرات استخراج البيانات التلقائية عبر خوارزميات OCR وقراءة الفواتير.
        </p>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a3636] border border-slate-700/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">الملفات المعالجة</span>
            <FileText className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{total}</div>
        </div>

        <div className="bg-[#1a3636] border border-slate-700/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">تم التطبيق والمطابقة</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{applied}</div>
        </div>

        <div className="bg-[#1a3636] border border-slate-700/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">بانتظار المراجعة البشرية</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">{pending}</div>
        </div>

        <div className="bg-[#1a3636] border border-slate-700/60 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">فشل الاستخراج</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400 mt-2">{failed}</div>
        </div>
      </div>

      {/* Avg confidence card */}
      <div className="bg-[#1a3636] border border-slate-700/60 rounded-2xl p-5 shadow-lg max-w-xs flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400 block mb-1">متوسط نسبة ثقة الذكاء الاصطناعي</span>
          <ConfidenceBadge value={avgConf} />
        </div>
        <BrainCircuit className="w-10 h-10 text-cyan-450 opacity-20" />
      </div>

      {/* Recent Files Table */}
      <div className="space-y-3">
        <h2 className="text-md font-semibold text-slate-200">أحدث الملفات المرفوعة</h2>
        <div className="bg-[#1a3636] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#102222] text-slate-300 border-b border-slate-700/60">
                <tr>
                  <th className="p-4 font-semibold">اسم الملف</th>
                  <th className="p-4 font-semibold">بواسطة</th>
                  <th className="p-4 font-semibold">تاريخ الرفع</th>
                  <th className="p-4 font-semibold">نسبة الثقة</th>
                  <th className="p-4 font-semibold">الحالة</th>
                  <th className="p-4 font-semibold">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      لا يوجد أي تقارير PDF حديثة.
                    </td>
                  </tr>
                ) : (
                  recent.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 font-medium text-slate-200">{rep.fileName}</td>
                      <td className="p-4">{rep.uploadedByName || "فني ميداني"}</td>
                      <td className="p-4 text-xs text-slate-400">{rep.uploadedAt || "—"}</td>
                      <td className="p-4">
                        <ConfidenceBadge value={rep.overallConfidence} />
                      </td>
                      <td className="p-4 capitalize">
                        {rep.status === "applied" ? (
                          <span className="text-emerald-400 font-semibold">تم التطبيق</span>
                        ) : rep.status === "failed" ? (
                          <span className="text-red-400 font-semibold">فشل</span>
                        ) : (
                          <span className="text-amber-400 font-semibold">بانتظار المراجعة</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/courier/pdf/${rep.id}`}
                          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-semibold"
                        >
                          مراجعة التقرير
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
