import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Search,
  Loader2,
  ArrowRight,
  Sparkles,
  Link2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExtractedField {
  value: string | null;
  confidence: number;
}

interface PdfReportDetail {
  id: number;
  fileName: string;
  status: string;
  overallConfidence: number | null;
  requestId: number | null;
  extractedJson: Record<string, ExtractedField>;
}

interface SearchResult {
  id: number;
  tid: string | null;
  terminalId: string | null;
  customerName: string | null;
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined)
    return <span className="text-slate-500 text-xs">—</span>;
  const color =
    value >= 80
      ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/25"
      : value >= 50
      ? "text-amber-400 bg-amber-500/15 border-amber-500/25"
      : "text-red-400 bg-red-500/15 border-red-500/25";
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {value}%
    </span>
  );
}

export default function CourierPdfReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editable, setEditable] = useState<Record<string, string>>({});
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<SearchResult[]>([]);
  const [linkedRequestId, setLinkedRequestId] = useState<number | null>(null);
  const [linkedRequestTid, setLinkedRequestTid] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // Fetch report details
  const { data: report, isLoading, error } = useQuery<PdfReportDetail>({
    queryKey: [`/api/courier/pdf/${id}`],
    queryFn: () =>
      apiRequest("GET", `/api/courier/pdf/${id}`).then((r) => r.json()),
  });

  // Populate form fields once report is loaded
  useEffect(() => {
    if (report) {
      setLinkedRequestId(report.requestId);
      const init: Record<string, string> = {};
      for (const [key, field] of Object.entries(report.extractedJson || {})) {
        init[key] = field.value || "";
      }
      setEditable(init);
    }
  }, [report]);

  // Search requests to link
  useEffect(() => {
    if (!linkQuery) {
      setLinkResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/courier/requests?q=${encodeURIComponent(linkQuery)}&pageSize=5`
        );
        const data = await res.json();
        setLinkResults(data.rows || []);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [linkQuery]);

  // Fetch linked request TID for better UI if already linked
  useEffect(() => {
    if (linkedRequestId) {
      apiRequest("GET", `/api/courier/requests/${linkedRequestId}`)
        .then((res) => res.json())
        .then((data) => setLinkedRequestTid(data.tid || `ID: ${data.id}`))
        .catch(() => setLinkedRequestTid(`ID: ${linkedRequestId}`));
    } else {
      setLinkedRequestTid(null);
    }
  }, [linkedRequestId]);

  async function handleApply() {
    if (!linkedRequestId) {
      toast({
        title: "تنبيه",
        description: "يرجى ربط هذا التقرير بطلب أولاً.",
        variant: "destructive",
      });
      return;
    }
    setApplying(true);
    try {
      const fields = {
        sn: editable.sn || null,
        simSerial: editable.sim_serial || null,
        time: editable.time || null,
        deliveryDate: editable.date || null,
        installationStatus: "Installation Completed - NL", // default to completed on pdf apply
      };

      const confidence: Record<string, number> = {};
      for (const [key, field] of Object.entries(report?.extractedJson || {})) {
        confidence[key] = field.confidence;
      }

      const res = await apiRequest("POST", `/api/courier/pdf/${id}/apply`, {
        request_id: linkedRequestId,
        fields,
        confidence,
      });

      if (res.ok) {
        toast({
          title: "تم بنجاح",
          description: "تم تفريغ تقرير الـ PDF وتحديث بيانات التنفيذ بنجاح.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/courier/pdf"] });
        navigate(`/courier/requests/${linkedRequestId}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "خطأ",
          description: data.error || "فشل تطبيق التقرير.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إرسال البيانات.",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  }

  const getFieldLabel = (key: string) => {
    const labels: Record<string, string> = {
      sn: "رقم السيريال (SN)",
      sim_serial: "الرقم التسلسلي للشريحة (SIM Serial)",
      time: "الوقت (Time)",
      date: "التاريخ (Date)",
    };
    return labels[key] || key;
  };

  const getAuthToken = () => {
    return localStorage.getItem("auth-token");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-2" />
        <p className="text-sm">جاري تحميل تقرير الـ PDF واستخراج البيانات...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
        <p className="text-sm">فشل تحميل تفاصيل التقرير.</p>
      </div>
    );
  }

  // Generate bearer token for iframe request
  const pdfUrl = `/api/courier/pdf/${report.id}?raw=1&token=${getAuthToken() || ""}`;

  return (
    <div dir="rtl" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate("/courier/pdf")}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-2"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            العودة لصفحة الرفع
          </button>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            مراجعة المستند واستخراج البيانات الذكي (PDF / صور)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            ملف: <span className="font-mono text-purple-300">{report.fileName}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PDF/Image Preview Frame */}
        <div className="lg:col-span-6 bg-[#1a3636] border border-slate-700/50 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="bg-[#142d2d] px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">معاينة المستند الأصلي</span>
          </div>
          {report.fileName.toLowerCase().match(/\.(png|jpe?g|webp)$/) ? (
            <div className="w-full h-[650px] bg-slate-800 flex items-center justify-center overflow-auto p-4">
              <img
                src={pdfUrl}
                alt="معاينة المستند"
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>
          ) : (
            <iframe
              src={pdfUrl}
              className="w-full h-[650px] bg-slate-800"
              title="PDF preview"
            />
          )}
        </div>

        {/* OCR Extracted Fields */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-[#1a3636] border border-slate-700/50 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 border-b border-slate-700/30 pb-2">
              الحقول المستخرجة تلقائياً
            </h2>
            {Object.entries(report.extractedJson || {}).map(([key, field]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    {getFieldLabel(key)}
                  </label>
                  <ConfidenceBadge value={field.confidence} />
                </div>
                <input
                  dir="ltr"
                  className="w-full rounded-lg bg-[#142d2d] border border-slate-700/80 px-3 py-2 text-sm text-slate-100 font-mono focus:border-purple-500 focus:outline-none"
                  value={editable[key] ?? ""}
                  onChange={(e) =>
                    setEditable((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div className="pt-2 border-t border-slate-700/30 flex items-center justify-between text-xs text-slate-400">
              <span>معدل الثقة الإجمالي:</span>
              <ConfidenceBadge value={report.overallConfidence} />
            </div>
          </div>
        </div>

        {/* Link to Request & Actions */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-[#1a3636] border border-slate-700/50 rounded-xl p-5 shadow-sm flex flex-col gap-4 flex-1">
            <h2 className="text-sm font-semibold text-slate-300 border-b border-slate-700/30 pb-2 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-purple-400" />
              الربط بطلب العمل الميداني
            </h2>

            {linkedRequestId ? (
              <div className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-sm flex flex-col gap-1">
                  <span className="font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    مرتبط بـ TID: {linkedRequestTid || "جاري التحميل..."}
                  </span>
                  <span className="text-xs text-emerald-500/80 font-mono">
                    معرف الطلب: #{linkedRequestId}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setLinkedRequestId(null);
                    setLinkedRequestTid(null);
                  }}
                  className="w-full text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 py-2 rounded-lg transition-colors border border-rose-500/20"
                >
                  تغيير الطلب المرتبط
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  ابحث عن الطلب المناسب لمطابقته وتفريغ البيانات المستخرجة فيه.
                </p>
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    value={linkQuery}
                    onChange={(e) => setLinkQuery(e.target.value)}
                    placeholder="ابحث برقم TID، الجوال أو اسم العميل..."
                    className="w-full rounded-lg bg-[#142d2d] border border-slate-700/80 pr-9 pl-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                {linkQuery && (
                  <div className="bg-[#142d2d] border border-slate-700/50 rounded-lg divide-y divide-slate-700/30 overflow-hidden max-h-60 overflow-y-auto">
                    {linkResults.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 text-center">
                        لا توجد نتائج مطابقة
                      </div>
                    ) : (
                      linkResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            setLinkedRequestId(r.id);
                            setLinkedRequestTid(r.tid || `ID: ${r.id}`);
                          }}
                          className="w-full text-start p-2.5 hover:bg-slate-700/15 flex flex-col gap-0.5 transition-colors"
                        >
                          <span className="text-xs font-semibold text-slate-200">
                            {r.customerName || "عميل غير معروف"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            TID: {r.tid} | Terminal ID: {r.terminalId}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-slate-700/30 space-y-3">
              <button
                onClick={handleApply}
                disabled={applying || !linkedRequestId}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-purple-900/10"
              >
                {applying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري تطبيق البيانات...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    اعتماد وتحديث التنفيذ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
