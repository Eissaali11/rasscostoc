import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { AddCourierRequestModal } from "@/components/add-courier-request-modal";
import { EditCourierExecutionModal } from "@/components/edit-courier-execution-modal";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Download,
  AlertCircle,
  X,
  Phone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Execution {
  id: number;
  requestId: number;
  installationStatus: string | null;
  salesTechnician: string | null;
  sn: string | null;
  simSerial: string | null;
  deliveryDate: string | null;
}

interface RequestRow {
  id: number;
  date: string | null;
  tid: string | null;
  terminalId: string | null;
  customerName: string | null;
  city: string | null;
  tecName: string | null;
  execution: Execution | null;
}

interface ListResponse {
  rows: RequestRow[];
  total: number;
}

interface ImportSummary {
  totalRows: number;
  importedCount: number;
  rejectedCount: number;
  skippedCount: number;
  rejected: Array<{ rowNumber: number; data: any; error?: string }>;
  skipped: Array<{ rowNumber: number; data: any; error?: string }>;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-700/40 px-2.5 py-1 rounded-full">
        <Clock className="w-3 h-3" />
        بانتظار التحقق
      </span>
    );

  const lower = status.toLowerCase();
  if (lower.includes("completed"))
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

  if (status === "Customer Not Answering")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 bg-indigo-500/15 px-2.5 py-1 rounded-full border border-indigo-500/25">
        <Phone className="w-3 h-3" />
        العميل لا يرد
      </span>
    );

  if (status === "In Progress")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/25">
        <Clock className="w-3 h-3" />
        تحت الإجراء
      </span>
    );

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-700/15 px-2.5 py-1 rounded-full border border-slate-700/25">
      <Clock className="w-3 h-3" />
      {status}
    </span>
  );
}

const PAGE_SIZE = 25;

export default function CourierRequestsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("status") || "";
  });
  const [reason, setReason] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("reason") || "";
  });
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (reason) params.set("reason", reason);
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["/api/courier/requests", q, status, reason, page],
    queryFn: () =>
      apiRequest("GET", `/api/courier/requests?${params.toString()}`).then((r) => r.json()),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearch = useCallback((val: string) => {
    setQ(val);
    setPage(1);
  }, []);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportSummary(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("auth-token");
      const res = await fetch("/api/courier/requests/import", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const result = await res.json();
      if (res.ok) {
        setImportSummary(result);
        toast({
          title: "تم الاستيراد بنجاح",
          description: `تمت معالجة ${result.totalRows} صفاً: استيراد ${result.importedCount}، تخطي ${result.skippedCount} مكررين.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/courier/requests"] });
      } else {
        toast({
          title: "فشل الاستيراد",
          description: result.error || "حدث خطأ أثناء معالجة ملف إكسل.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "خطأ",
        description: "تعذر الاتصال بالخادم للاستيراد.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExportExcel = () => {
    const exportParams = new URLSearchParams();
    if (q) exportParams.set("q", q);
    if (status) exportParams.set("status", status);

    const token = localStorage.getItem("auth-token") || "";
    // Trigger download by opening raw export link with auth token query if needed,
    // or standard location redirection.
    window.open(`/api/courier/requests/export?${exportParams.toString()}&token=${token}`);
  };

  return (
    <div dir="rtl" className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            شاشة التحقق وإغلاق الطلبات
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            إجمالي الحالات بانتظار المراجعة والتحقق: <span className="text-slate-200 font-medium">{total}</span> طلب
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportExcel}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="bg-[#284b63] hover:bg-[#1f3a4d] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            {importing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            استيراد إكسل
          </button>
          <button
            onClick={handleExportExcel}
            className="bg-[#3c6e71] hover:bg-[#2d5355] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            تصدير إكسل
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
          >
            + إضافة طلب جديد
          </button>
        </div>
      </div>

      {/* Import Summary Results Panel */}
      {importSummary && (
        <div className="bg-[#1a3636] border border-slate-700/50 rounded-xl p-4 space-y-3 relative">
          <button
            onClick={() => setImportSummary(null)}
            className="absolute top-3 left-3 text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            ملخص تقرير استيراد ملف الإكسل
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#142d2d] rounded-lg p-2.5 border border-slate-700/30">
              <div className="text-slate-400">إجمالي الأسطر المقروءة</div>
              <div className="text-lg font-bold text-slate-200 mt-0.5">{importSummary.totalRows}</div>
            </div>
            <div className="bg-emerald-500/10 rounded-lg p-2.5 border border-emerald-500/20">
              <div className="text-emerald-400">تم استيرادها بنجاح</div>
              <div className="text-lg font-bold text-emerald-300 mt-0.5">{importSummary.importedCount}</div>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-2.5 border border-amber-500/20">
              <div className="text-amber-400">تم تخطيها (مكررة TID)</div>
              <div className="text-lg font-bold text-amber-300 mt-0.5">{importSummary.skippedCount}</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-2.5 border border-red-500/20">
              <div className="text-red-400">تم رفضها (أخطاء بنية)</div>
              <div className="text-lg font-bold text-red-300 mt-0.5">{importSummary.rejectedCount}</div>
            </div>
          </div>

          {(importSummary.skipped.length > 0 || importSummary.rejected.length > 0) && (
            <div className="mt-3 text-xs max-h-40 overflow-y-auto space-y-1.5 border-t border-slate-700/30 pt-3">
              {importSummary.skipped.map((s, idx) => (
                <div key={`s-${idx}`} className="text-amber-400 flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>السطر {s.rowNumber}: {s.error || `TID ${s.data.tid} مكرر مسبقاً`}</span>
                </div>
              ))}
              {importSummary.rejected.map((r, idx) => (
                <div key={`r-${idx}`} className="text-red-400 flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>السطر {r.rowNumber}: {r.error || "بيانات TID أو Terminal ID مفقودة"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="البحث بـ TID، اسم العميل، رقم الحادثة أو السيريال (SN/SIM)..."
              className="w-full bg-[#1a3636] border border-slate-700/50 rounded-lg pr-10 pl-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-emerald-500/60"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="bg-[#1a3636] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/60"
          >
            <option value="">جميع الحالات (الكل)</option>
            <option value="pending">بانتظار التحقق</option>
            <option value="Installation Completed">مكتمل</option>
            <option value="Not Completed">غير مكتمل</option>
            <option value="Customer Not Answering">العميل لا يرد</option>
            <option value="In Progress">تحت الإجراء</option>
          </select>
        </div>

        {(status || reason || q) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">الفلاتر النشطة:</span>
            {status && (
              <span className="bg-emerald-500/15 text-emerald-450 border border-emerald-500/20 px-2 py-1 rounded-md flex items-center gap-1.5">
                الحالة: {status === "pending" ? "بانتظار التحقق" : status}
                <button onClick={() => { setStatus(""); setPage(1); }} className="hover:text-emerald-300 font-bold ml-1 cursor-pointer">×</button>
              </span>
            )}
            {reason && (
              <span className="bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-1 rounded-md flex items-center gap-1.5">
                سبب الفشل: {reason}
                <button onClick={() => { setReason(""); setPage(1); }} className="hover:text-red-300 font-bold ml-1 cursor-pointer">×</button>
              </span>
            )}
            {q && (
              <span className="bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-md flex items-center gap-1.5">
                البحث: {q}
                <button onClick={() => { setQ(""); setPage(1); }} className="hover:text-blue-300 font-bold ml-1 cursor-pointer">×</button>
              </span>
            )}
            <button
              onClick={() => { setStatus(""); setReason(""); setQ(""); setPage(1); }}
              className="text-slate-400 hover:text-slate-200 underline font-medium cursor-pointer text-xs"
            >
              مسح الكل
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#1a3636] border border-slate-700/50 rounded-xl overflow-hidden shadow">
        <div className="overflow-x-auto max-h-[58vh]">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-[#142d2d] text-slate-400 sticky top-0 z-10">
              <tr>
                {["#", "التاريخ", "TID", "Terminal ID", "العميل", "المدينة", "الفني", "الحالة", "إجراء"].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-start font-semibold border-b border-slate-700/50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-500">
                    <Loader2 className="animate-spin w-5 h-5 inline-block mr-2" />
                    جاري التحميل...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-500">
                    لا توجد نتائج
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`hover:bg-slate-700/20 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-800/10"}`}
                  >
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.id}</td>
                    <td className="px-4 py-3 text-slate-300">{r.date || "—"}</td>
                    <td className="px-4 py-3 font-mono text-emerald-400">{r.tid || "—"}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{r.terminalId || "—"}</td>
                    <td className="px-4 py-3 text-slate-200">{r.customerName || "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{r.city || "—"}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {r.execution?.salesTechnician || r.tecName || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.execution?.installationStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedRequestId(r.id);
                          setIsEditModalOpen(true);
                        }}
                        className="text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        {(!r.execution || !r.execution.installationStatus) ? "إدخال البيانات" : "تعديل بيانات التحقق"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          صفحة {page} من {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
      <AddCourierRequestModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSuccess={(id) => {
          setSelectedRequestId(id);
          setIsEditModalOpen(true);
        }}
      />
      <EditCourierExecutionModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        requestId={selectedRequestId}
      />
    </div>
  );
}
