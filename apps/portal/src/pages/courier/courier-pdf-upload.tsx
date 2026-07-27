import { useTranslation } from "@/lib/language";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Search,
  ExternalLink,
  ThumbsUp,
} from "lucide-react";

interface PdfReportRow {
  id: number;
  fileName: string;
  status: string;
  overallConfidence: number | null;
  uploadedAt: string | null;
  uploadedByName: string | null;
  uploadedByTechnicianCode: string | null;
  uploadedByRegionId: string | null;
  uploadedByRegionName: string | null;
  requestId: number | null;
  requestRetailerName: string | null;
  requestMobile: string | null;
  requestTid: string | null;
  extractedJson: string | null;
}

interface LookupRegion {
  id: string;
  name: string;
}

interface LookupTechnician {
  id: string;
  code: string;
  name: string;
  technicianCode: string | null;
  regionId: string | null;
}

// نفس منطق toCards في صفحة المراجعة الكاملة (courier-pdf-review.tsx) لكن مبسّط لقراءة
// {sn, sim_serial, tid} فقط - كافٍ لبناء طلب /complete السريع من هذه الصفحة بدون
// فتح شاشة المراجعة الكاملة، ويدعم كلا شكلي extractedJson (مصفوفة devices أو حقل مفرد).
function extractDevicesForApprove(extractedJson: string | null): Array<{ sn: string; sim_serial: string; tid: string }> {
  if (!extractedJson) return [];
  let payload: any;
  try {
    payload = JSON.parse(extractedJson);
  } catch {
    return [];
  }
  const devices = payload?.devices;
  if (Array.isArray(devices) && devices.length > 0) {
    return devices
      .map((d: any) => ({ sn: d.sn ?? "", sim_serial: d.sim_serial ?? "", tid: d.tid ?? "" }))
      .filter((d: any) => d.sn || d.sim_serial || d.tid);
  }
  const sn = payload?.sn?.value ?? "";
  const sim = payload?.sim_serial?.value ?? "";
  const tid = payload?.tid?.value ?? "";
  if (!sn && !sim && !tid) return [];
  return [{ sn, sim_serial: sim, tid }];
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined)
    return <span className="text-[#6B7280] text-xs">—</span>;
  const color =
    value >= 80
      ? "text-[#18B2B0] bg-[#18B2B0]/12 border-[#18B2B0]/25"
      : value >= 50
      ? "text-[#B45309] bg-[#F4B740]/18 border-[#F4B740]/35"
      : "text-[#E05252] bg-[#E05252]/12 border-[#E05252]/25";
  return (
    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${color}`}>
      {value}%
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    applied: "text-[#18B2B0] bg-[#18B2B0]/12 border-[#18B2B0]/25",
    pending: "text-[#B45309] bg-[#F4B740]/18 border-[#F4B740]/35",
    manual_review: "text-[#8B5CF6] bg-[#8B5CF6]/12 border-[#8B5CF6]/25",
    failed: "text-[#E05252] bg-[#E05252]/10 border-[#E05252]/25",
  };
  const icons: Record<string, typeof CheckCircle2> = {
    applied: CheckCircle2,
    pending: Clock,
    manual_review: AlertCircle,
    failed: AlertCircle,
  };
  const Icon = icons[status] || FileText;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
        styles[status] || "text-[#6B7280] bg-[#F1F5F9] border-[#E2E8F0]"
      }`}
    >
      <Icon className="w-3 h-3" />
      {status === "manual_review" ? "Manual Review" : status}
    </span>
  );
}

export default function CourierPdfUploadPage() {
  const { t, dir } = useTranslation();
  const [, navigate] = useLocation();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [regionFilter, setRegionFilter] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // بحث مؤجّل (debounce) بنفس أسلوب حقل البحث عن الطلب في صفحة المراجعة الكاملة
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: lookups } = useQuery<{ regions?: LookupRegion[]; technicians?: LookupTechnician[] }>({
    queryKey: ["/api/courier/lookups"],
    queryFn: () => apiRequest("GET", "/api/courier/lookups").then((r) => r.json()),
  });
  const regions = lookups?.regions ?? [];
  const technicians = lookups?.technicians ?? [];

  const listUrl = (() => {
    const params = new URLSearchParams();
    if (regionFilter) params.set("region", regionFilter);
    if (technicianFilter) params.set("technician", technicianFilter);
    if (search) params.set("q", search);
    const qs = params.toString();
    return qs ? `/api/courier/pdf?${qs}` : "/api/courier/pdf";
  })();

  const { data: rows = [], isLoading } = useQuery<PdfReportRow[]>({
    queryKey: [listUrl],
    queryFn: () => apiRequest("GET", listUrl).then((r) => r.json()),
  });

  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const token = localStorage.getItem("auth-token");
      const res = await fetch("/api/courier/pdf/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: [listUrl] });
        navigate(`/courier/pdf/${data.id}`);
      }
    } finally {
      setUploading(false);
    }
  }

  // معاينة الملف الأصلي في تبويب جديد - يمر عبر fetch بهيدر Authorization يدويًا (بدل
  // رابط <a href> مباشر) لأن مصادقة المنصّة تعتمد Bearer token مخزّن في localStorage
  // وليس كوكي جلسة، فرابط تصفّح مباشر لن يحمل التوكن.
  async function openReportFile(id: number) {
    try {
      const token = localStorage.getItem("auth-token");
      const res = await fetch(`/api/courier/pdf/${id}?raw=1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`preview ${res.status}`);
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch {
      toast({ title: "تعذّر فتح الملف", description: "تأكد من صلاحية الوصول وحاول مجددًا", variant: "destructive" });
    }
  }

  // موافقة سريعة: تُطبّق بيانات الاستخراج الحالية مباشرة عبر /complete دون فتح شاشة
  // المراجعة الكاملة - تظهر فقط للتقارير المطابقة لطلب فعلي وبثقة استخراج عالية
  async function quickApprove(row: PdfReportRow) {
    if (!row.requestId) return;
    const devices = extractDevicesForApprove(row.extractedJson);
    if (devices.length === 0) {
      toast({ title: "لا توجد أجهزة", description: "افتح المراجعة الكاملة لإدخال الأجهزة يدويًا", variant: "destructive" });
      return;
    }
    setApprovingId(row.id);
    try {
      // apiRequest يرمي استثناءً تلقائيًا لو الرد ليس 2xx (برسالة الخادم نفسها)
      await apiRequest("POST", `/api/courier/pdf/${row.id}/complete`, {
        request_id: row.requestId,
        devices: devices.map((d) => ({
          sn: d.sn || null,
          sim_serial: d.sim_serial || null,
          tid: d.tid || null,
          technician_code: row.uploadedByTechnicianCode,
          sales_technician: row.uploadedByName,
        })),
        deliveryDate: null,
        time: null,
        paperRoll: "Yes",
      });
      toast({ title: "تمت الموافقة", description: `تقرير #${row.id} طُبِّق على الطلب #${row.requestId}` });
      queryClient.invalidateQueries({ queryKey: [listUrl] });
    } catch (e) {
      toast({ title: "تعذّرت الموافقة", description: e instanceof Error ? e.message : "خطأ غير متوقع", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div dir={dir} className="rassco-page space-y-6 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-2xl font-extrabold tracking-tight text-[#2D3135] flex items-center gap-3">
          <span className="courier-icon-badge">
            <FileText className="w-5 h-5" />
          </span>
          {t('courier.documents_data_images')}
        </h1>
        <p className="text-sm text-[#6B7280] mt-1.5 ps-14">
          {t('courier.report_system_data')}
        </p>
      </motion.div>

      {/* Drop Zone */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleUpload(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`courier-panel courier-panel-static !border-2 !border-dashed p-14 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          dragOver
            ? "!border-[#18B2B0] bg-[#18B2B0]/08"
            : "!border-[rgba(24,178,176,0.28)] hover:!border-[#18B2B0] hover:bg-[#18B2B0]/04"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        {uploading ? (
          <>
            <Loader2 className="w-10 h-10 text-[#18B2B0] animate-spin mb-3" />
            <p className="text-[#4B5563] font-semibold">{t('courier.file_2')}</p>
          </>
        ) : (
          <>
            <div className="courier-icon-badge mb-3 w-14 h-14 rounded-2xl">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="text-[#2D3135] font-bold">{t('courier.file_image')}</p>
            <p className="text-xs text-[#6B7280] mt-1.5">
              {t('courier.date_1')}
            </p>
          </>
        )}
      </motion.div>

      {/* Recent Uploads */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#6B7280] uppercase tracking-wide">
            {t('courier.reports_2')}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="courier-input !w-auto text-xs"
            >
              <option value="">كل المناطق</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <select
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
              className="courier-input !w-auto text-xs"
            >
              <option value="">كل الفنيين</option>
              {technicians.map((tec) => (
                <option key={tec.id} value={tec.id}>{tec.name}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ابحث برقم الجهاز أو رقم الطلب"
                className="courier-input !w-56 text-xs ps-8"
              />
            </div>
          </div>
        </div>

        <div className="courier-panel courier-panel-static">
          <div className="courier-table-wrap">
            <table className="courier-table">
              <thead>
                <tr>
                  {[t('courier.name_file'), "الفني / المنطقة", t('courier.date_2'), "الطلب المطابق", t('courier.item_19035'), t('courier.status'), ""].map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-[#6B7280]">
                      <Loader2 className="animate-spin w-5 h-5 inline-block me-2 text-[#18B2B0]" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-[#6B7280]">
                      {t('courier.no_3')}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const canQuickApprove =
                      r.status !== "applied" &&
                      !!r.requestId &&
                      (r.overallConfidence ?? 0) >= 80;
                    return (
                      <tr key={r.id}>
                        <td className="font-semibold text-[#2D3135]">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[160px]">{r.fileName}</span>
                            <button
                              type="button"
                              onClick={() => openReportFile(r.id)}
                              title="فتح الملف الأصلي"
                              className="text-[#18B2B0] shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="text-[#6B7280]">
                          {r.uploadedByName || "—"}
                          <br />
                          <span className="text-[11px] text-[#9CA3AF]">{r.uploadedByRegionName || "—"}</span>
                        </td>
                        <td className="text-[#6B7280]">
                          {r.uploadedAt ? new Date(r.uploadedAt).toLocaleString("ar-SA") : "—"}
                        </td>
                        <td className="text-[#6B7280] text-xs">
                          {r.requestId ? (r.requestRetailerName || `#${r.requestId}`) : "—"}
                        </td>
                        <td>
                          <ConfidenceBadge value={r.overallConfidence} />
                        </td>
                        <td>
                          <StatusPill status={r.status} />
                        </td>
                        <td>
                          {canQuickApprove ? (
                            <button
                              type="button"
                              onClick={() => quickApprove(r)}
                              disabled={approvingId === r.id}
                              className="courier-action-chip inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              {approvingId === r.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ThumbsUp className="w-3.5 h-3.5" />
                              )}
                              موافقة
                            </button>
                          ) : (
                            <Link href={`/courier/pdf/${r.id}`} className="courier-action-chip">
                              {t('courier.review_2')}
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
