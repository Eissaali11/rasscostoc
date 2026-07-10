import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  FileSpreadsheet
} from "lucide-react";

interface RequestRow {
  id: number;
  date: string | null;
  tid: string | null;
  city: string | null;
  customerName: string | null;
  execution: {
    salesTechnician: string | null;
    simType: string | null;
    sn: string | null;
    installationStatus: string | null;
  } | null;
}

interface ListResponse {
  rows: RequestRow[];
  total: number;
}

interface LookupsResponse {
  cities: Array<{ id: number; name_en: string; name_ar: string }>;
  technicians: Array<{ id: number; name: string; code: string }>;
  simTypes: Array<{ id: number; name: string }>;
  vendorTypes: Array<{ id: number; name: string }>;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-700/40 px-2.5 py-1 rounded-full">
        <Clock className="w-3 h-3" />
        بانتظار الإدخال
      </span>
    );

  if (status.toLowerCase().includes("completed"))
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/25">
        <CheckCircle2 className="w-3 h-3" />
        مكتمل
      </span>
    );

  if (status === "Not Completed")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-500/15 px-2.5 py-1 rounded-full border border-red-500/25">
        <XCircle className="w-3 h-3" />
        غير مكتمل
      </span>
    );

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/25">
      <Clock className="w-3 h-3" />
      {status}
    </span>
  );
}

const EMPTY_FILTERS = {
  dateFrom: "",
  dateTo: "",
  city: "",
  technician: "",
  status: "",
  simType: "",
  vendor: ""
};

export default function CourierReportsPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const { data: lookups } = useQuery<LookupsResponse>({
    queryKey: ["/api/courier/lookups"],
    queryFn: () => apiRequest("GET", "/api/courier/lookups").then((r) => r.json())
  });

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["/api/courier/requests/filtered", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.city) params.set("city", filters.city);
      if (filters.technician) params.set("technician", filters.technician);
      if (filters.status) params.set("status", filters.status);
      if (filters.simType) params.set("simType", filters.simType);
      if (filters.vendor) params.set("vendor", filters.vendor);
      params.set("pageSize", "200"); // Retrieve a larger batch for reports
      return apiRequest("GET", `/api/courier/requests?${params.toString()}`).then((r) => r.json());
    }
  });

  const getExportUrl = () => {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.city) params.set("city", filters.city);
    if (filters.technician) params.set("technician", filters.technician);
    if (filters.status) params.set("status", filters.status);
    if (filters.simType) params.set("simType", filters.simType);
    if (filters.vendor) params.set("vendor", filters.vendor);
    
    const token = localStorage.getItem("auth-token") || "";
    return `/api/courier/requests/export?${params.toString()}&token=${encodeURIComponent(token)}`;
  };

  const total = data?.total || 0;
  const rows = data?.rows || [];

  return (
    <div dir="rtl" className="space-y-6 text-slate-100">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Filter className="w-6 h-6 text-cyan-400" />
            تقارير العمليات الميدانية
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            تصفية متقدمة لكافة الحركات والتركيبات وتصدير النتائج مباشرة إلى ملف Excel.
          </p>
        </div>
        <div>
          <a
            href={getExportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 text-slate-950 rounded-xl text-sm font-bold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/10"
          >
            <Download className="w-4 h-4" />
            تصدير التقرير المفلتر ({total})
          </a>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-[#1a3636] border border-slate-700/60 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          خيارات البحث والتصفية
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">من تاريخ</label>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/80"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">إلى تاريخ</label>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/80"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">المدينة</label>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/80"
              value={filters.city}
              onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
            >
              <option value="">كل المدن</option>
              {lookups?.cities.map((c) => (
                <option key={c.id} value={c.name_en}>
                  {c.name_en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">الفني</label>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/80"
              value={filters.technician}
              onChange={(e) => setFilters((f) => ({ ...f, technician: e.target.value }))}
            >
              <option value="">كل الفنيين</option>
              {lookups?.technicians.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">حالة التركيب</label>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/80"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">كل الحالات</option>
              <option value="Installation Completed - NL">مكتمل - نيوليب</option>
              <option value="Not Completed">غير مكتمل</option>
              <option value="Under Process">تحت المعالجة</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">نوع الشريحة</label>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/80"
              value={filters.simType}
              onChange={(e) => setFilters((f) => ({ ...f, simType: e.target.value }))}
            >
              <option value="">كل الأنواع</option>
              {lookups?.simTypes.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">الشركة المصنعة (Vendor)</label>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/80"
              value={filters.vendor}
              onChange={(e) => setFilters((f) => ({ ...f, vendor: e.target.value }))}
            >
              <option value="">كل الشركات</option>
              {lookups?.vendorTypes.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-600 bg-slate-800/40 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-800 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة تعيين الفلاتر
            </button>
          </div>
        </div>
      </div>

      {/* Results grid */}
      <div className="bg-[#1a3636] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#102222] text-slate-300 border-b border-slate-700/60 sticky top-0 z-10">
              <tr>
                <th className="p-4 font-semibold">التاريخ</th>
                <th className="p-4 font-semibold">TID</th>
                <th className="p-4 font-semibold">المدينة</th>
                <th className="p-4 font-semibold">العميل</th>
                <th className="p-4 font-semibold">فني المبيعات</th>
                <th className="p-4 font-semibold">نوع الشريحة</th>
                <th className="p-4 font-semibold">الرقم التسلسلي (SN)</th>
                <th className="p-4 font-semibold text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                      جاري تحميل تقارير العمليات الميدانية...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500">
                    لا يوجد أي سجلات مطابقة للفلاتر المحددة.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 whitespace-nowrap">{row.date || "—"}</td>
                    <td className="p-4 font-mono text-cyan-400 whitespace-nowrap">{row.tid || "—"}</td>
                    <td className="p-4 whitespace-nowrap">{row.city || "—"}</td>
                    <td className="p-4 whitespace-nowrap font-medium text-slate-200">{row.customerName || "—"}</td>
                    <td className="p-4 whitespace-nowrap">{row.execution?.salesTechnician || "—"}</td>
                    <td className="p-4 whitespace-nowrap">{row.execution?.simType || "—"}</td>
                    <td className="p-4 font-mono text-xs whitespace-nowrap">{row.execution?.sn || "—"}</td>
                    <td className="p-4 whitespace-nowrap text-center">
                      <StatusBadge status={row.execution?.installationStatus} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
