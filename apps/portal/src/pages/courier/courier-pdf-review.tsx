import { useTranslation } from "@/lib/language";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  Search,
  Loader2,
  ArrowRight,
  Sparkles,
  Link2,
  Plus,
  RefreshCw,
  XCircle,
  Send,
  MessageSquare,
  ShieldAlert,
  User,
  MapPin,
  Calendar,
  Clock,
  FileText,
  Building2,
  CreditCard,
  Barcode,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type MatchStatus = "matched" | "needs_review" | "unknown";

type DeviceCard = {
  device_index: number;
  sn: string;
  sim_serial: string;
  tid: string;
  merchant: string;
  confidence: number;
  match: {
    technician_name: string | null;
    technician_code: string | null;
    status: MatchStatus;
    confidence: number | null;
  };
  lookupLoading?: boolean;
  lookupMessage?: string | null;
};

type ExtractedPayload = {
  devices?: Array<{
    device_index?: number;
    sn?: string | null;
    sim_serial?: string | null;
    tid?: string | null;
    merchant?: string | null;
    confidence?: number;
    match?: DeviceCard["match"];
  }>;
  date?: { value?: string | null; confidence?: number };
  time?: { value?: string | null; confidence?: number };
  sn?: { value?: string | null; confidence?: number };
  sim_serial?: { value?: string | null; confidence?: number };
  tid?: { value?: string | null; confidence?: number };
  retailer_name?: { value?: string | null; confidence?: number };
  extraction_source?: string;
};

interface PdfReportDetail {
  id: number;
  fileName: string;
  status: string;
  overallConfidence: number | null;
  requestId: number | null;
  uploadedBy?: string | null;
  technicianName?: string | null;
  technicianCode?: string | null;
  region?: string | null;
  createdAt?: string | null;
  extractedJson: ExtractedPayload;
}

interface SearchResult {
  id: number;
  tid: string | null;
  terminalId: string | null;
  customerName: string | null;
}

interface SerialLookupResult {
  found: boolean;
  message?: string;
  technician?: {
    fullName: string;
    username: string;
    technicianCode: string | null;
  } | null;
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
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      {value}%
    </span>
  );
}

function MatchBadge({ status }: { status: MatchStatus }) {
  if (status === "matched") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#18B2B0] bg-[#18B2B0]/12 border border-[#18B2B0]/25 px-2.5 py-1 rounded-full">
        <CheckCircle2 className="w-3.5 h-3.5" />
        مطابقة ناجحة
      </span>
    );
  }
  if (status === "needs_review") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B45309] bg-[#F4B740]/18 border border-[#F4B740]/35 px-2.5 py-1 rounded-full">
        <AlertCircle className="w-3.5 h-3.5" />
        تحتاج مراجعة
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6B7280] bg-[#F1F5F9] border border-[#E2E8F0] px-2.5 py-1 rounded-full">
      غير معروف
    </span>
  );
}

function StatusTag({ status }: { status: string }) {
  if (status === "applied") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#18B2B0] bg-[#18B2B0]/15 border border-[#18B2B0]/30 px-3 py-1 rounded-full">
        <CheckCircle2 className="w-4 h-4" />
        مُعتمد ومُطبَّق
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E05252] bg-[#E05252]/15 border border-[#E05252]/30 px-3 py-1 rounded-full">
        <XCircle className="w-4 h-4" />
        مرتجع / مراجعة الفني
      </span>
    );
  }
  if (status === "manual_review") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B45309] bg-[#F4B740]/20 border border-[#F4B740]/40 px-3 py-1 rounded-full">
        <AlertCircle className="w-4 h-4" />
        بانتظار المراجعة الإدارية
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6B7280] bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-1 rounded-full">
      قيد المعالجة
    </span>
  );
}

function toCards(payload: ExtractedPayload | undefined): DeviceCard[] {
  const devices = payload?.devices;
  if (Array.isArray(devices) && devices.length > 0) {
    return devices
      .map((d, i) => ({
        device_index: d.device_index ?? i + 1,
        sn: d.sn ?? "",
        sim_serial: d.sim_serial ?? "",
        tid: d.tid ?? "",
        merchant: d.merchant ?? "",
        confidence: d.confidence ?? 0,
        match: d.match ?? {
          technician_name: null,
          technician_code: null,
          status: "unknown" as MatchStatus,
          confidence: null,
        },
      }))
      .filter((d) => d.sn || d.sim_serial || d.tid || d.merchant);
  }

  const sn = payload?.sn?.value ?? "";
  const sim = payload?.sim_serial?.value ?? "";
  const tid = payload?.tid?.value ?? "";
  const merchant = payload?.retailer_name?.value ?? "";
  if (!sn && !sim && !tid && !merchant) return [];

  return [
    {
      device_index: 1,
      sn,
      sim_serial: sim,
      tid,
      merchant,
      confidence: payload?.sn?.confidence ?? 0,
      match: {
        technician_name: null,
        technician_code: null,
        status: "unknown",
        confidence: null,
      },
    },
  ];
}

export default function CourierPdfReviewPage() {
  const { t, dir } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [cards, setCards] = useState<DeviceCard[]>([]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [time, setTime] = useState("");
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<SearchResult[]>([]);
  const [linkedRequestId, setLinkedRequestId] = useState<number | null>(null);
  const [linkedRequestTid, setLinkedRequestTid] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [reextracting, setReextracting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Rejection Dialog State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReasonCategory, setRejectReasonCategory] = useState("UNCLEAR_PHOTO");
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const { data: report, isLoading, error } = useQuery<PdfReportDetail>({
    queryKey: [`/api/courier/pdf/${id}`],
    queryFn: () =>
      apiRequest("GET", `/api/courier/pdf/${id}`).then((r) => r.json()),
  });

  const matchedCount = useMemo(
    () => cards.filter((c) => c.match.status === "matched").length,
    [cards],
  );

  useEffect(() => {
    if (!report) return;
    setLinkedRequestId(report.requestId);
    setCards(toCards(report.extractedJson));
    setDeliveryDate(report.extractedJson?.date?.value ?? "");
    setTime(report.extractedJson?.time?.value ?? "");
  }, [report]);

  useEffect(() => {
    if (!linkQuery) {
      setLinkResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/courier/requests?q=${encodeURIComponent(linkQuery)}&pageSize=5`,
        );
        const data = await res.json();
        setLinkResults(data.rows || []);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [linkQuery]);

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

  useEffect(() => {
    if (!report?.id) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      setPreviewError(null);
      try {
        const token = localStorage.getItem("auth-token");
        const res = await fetch(`/api/courier/pdf/${report.id}?raw=1`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`preview ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (err: any) {
        if (!cancelled) setPreviewError(err?.message || "فشل تحميل المعاينة");
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [report?.id]);

  const updateCard = (index: number, patch: Partial<DeviceCard>) => {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  };

  const lookupSerial = async (index: number) => {
    const card = cards[index];
    const sn = card?.sn?.trim();
    if (!sn) return;
    updateCard(index, { lookupLoading: true, lookupMessage: null });
    try {
      const res = await apiRequest("POST", "/api/courier/serial-lookup", { sn });
      const data: SerialLookupResult = await res.json();
      if (data.found && data.technician) {
        updateCard(index, {
          lookupLoading: false,
          lookupMessage: `الفني: ${data.technician.fullName} (${data.technician.username})`,
          match: {
            technician_name: data.technician.fullName,
            technician_code: data.technician.username,
            status: "matched",
            confidence: 100,
          },
        });
      } else {
        updateCard(index, {
          lookupLoading: false,
          lookupMessage: data.message || "الجهاز غير مخصص أو غير موجود في العهدة",
          match: {
            technician_name: null,
            technician_code: null,
            status: "needs_review",
            confidence: 0,
          },
        });
      }
    } catch (err: any) {
      updateCard(index, {
        lookupLoading: false,
        lookupMessage: "تعذر التحقق من المخزون",
      });
    }
  };

  const addDeviceCard = () => {
    setCards((prev) => [
      ...prev,
      {
        device_index: prev.length + 1,
        sn: "",
        sim_serial: "",
        tid: "",
        merchant: "",
        confidence: 100,
        match: {
          technician_name: null,
          technician_code: null,
          status: "unknown",
          confidence: null,
        },
      },
    ]);
  };

  const removeDeviceCard = (index: number) => {
    setCards((prev) => prev.filter((_, i) => i !== index));
  };

  const handleComplete = async () => {
    if (!report || !linkedRequestId) return;
    setCompleting(true);
    try {
      const body = {
        request_id: linkedRequestId,
        devices: cards.map((c, i) => ({
          device_index: i + 1,
          sn: c.sn.trim(),
          sim_serial: c.sim_serial.trim(),
          tid: c.tid.trim(),
          merchant: c.merchant.trim(),
        })),
        deliveryDate: deliveryDate || null,
        time: time || null,
      };

      const res = await apiRequest(
        "POST",
        `/api/courier/pdf/${report.id}/complete`,
        body,
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "فشل إكمال التقرير");
      }

      toast({
        title: "تم الاعتماد وتطبيق البيانات بنجاح ✅",
        description: "تم تحديث سجل السحب والمخزون وإرسال إشعار الاعتماد للفني عبر تيليجرام.",
      });

      await queryClient.invalidateQueries({ queryKey: [`/api/courier/pdf/${id}`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/courier/pdf"] });
      navigate("/courier/pdf");
    } catch (err: any) {
      toast({
        title: "خطأ أثناء الاعتماد",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!report) return;
    setRejecting(true);
    try {
      const res = await apiRequest("POST", `/api/courier/pdf/${report.id}/reject`, {
        reasonCategory: rejectReasonCategory,
        notes: rejectNotes,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "فشل إرجاع التقرير");
      }

      toast({
        title: "تم إرجاع التقرير للفني ⚠️",
        description: "تم إرسال إشعار التنبيه والتفاصيل المحددة إلى دردشة التليجرام الخاصة بالفني.",
      });

      setRejectModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: [`/api/courier/pdf/${id}`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/courier/pdf"] });
      navigate("/courier/pdf");
    } catch (err: any) {
      toast({
        title: "خطأ أثناء عملية الإرجاع",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setRejecting(false);
    }
  };

  const handleReextract = async () => {
    if (!report) return;
    setReextracting(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/courier/pdf/${report.id}/reextract`,
      );
      if (!res.ok) throw new Error("فشل إعادة الاستخراج");
      const updated = await res.json();

      toast({
        title: "تمت إعادة الاستخراج بالذكاء الاصطناعي ✨",
        description: `تم تحديد ${updated.devices?.length || 0} أجهزة بثقة ${Math.round(updated.overallConfidence || 0)}%.`,
      });

      setCards(toCards(updated.extractedJson));
      setLinkedRequestId(updated.requestId || report.requestId);
      await queryClient.invalidateQueries({ queryKey: [`/api/courier/pdf/${id}`] });
    } catch (err: any) {
      toast({
        title: "خطأ الاستخراج",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setReextracting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#18B2B0]" />
        <p className="text-sm font-medium text-[#6B7280]">جارٍ تحميل تفاصيل التقرير والبيانات المستخرجة…</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6 text-center max-w-lg mx-auto bg-white rounded-2xl border border-red-200 shadow-sm my-12">
        <AlertCircle className="w-10 h-10 text-[#E05252] mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#2D3135]">تعذر تحميل التقرير</h3>
        <p className="text-xs text-[#6B7280] mt-1">قد يكون الملف غير موجود أو تم حذفه من السيرفر.</p>
        <button
          onClick={() => navigate("/courier/pdf")}
          className="mt-4 px-4 py-2 text-xs font-bold text-white bg-[#18B2B0] rounded-xl hover:bg-[#159A98] transition-colors"
        >
          العودة لقائمة التقارير
        </button>
      </div>
    );
  }

  const isApplied = report.status === "applied";

  return (
    <div className="w-full px-4 sm:px-8 py-6 space-y-6 font-sans bg-[#F8FAFC]/50 min-h-screen" dir={dir}>
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-[rgba(24,178,176,0.18)] shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/courier/pdf")}
            className="p-2 text-[#6B7280] hover:text-[#18B2B0] hover:bg-[#18B2B0]/10 rounded-xl transition-colors"
            title="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#2D3135] font-cairo">
                مراجعة وتدقيق تقرير التركيب #{report.id}
              </h1>
              <StatusTag status={report.status} />
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5 dir-ltr text-end sm:text-start font-mono">
              {report.fileName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReextract}
            disabled={reextracting || isApplied}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#18B2B0] bg-[#18B2B0]/10 hover:bg-[#18B2B0]/20 rounded-xl transition-colors disabled:opacity-50"
          >
            {reextracting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            إعادة الاستخراج بالذكاء الاصطناعي
          </button>

          {!isApplied && (
            <button
              onClick={() => setRejectModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#E05252] bg-[#E05252]/10 hover:bg-[#E05252]/20 rounded-xl transition-colors border border-[#E05252]/20"
            >
              <XCircle className="w-4 h-4" />
              إرجاع للفني وإرسال إشعار
            </button>
          )}
        </div>
      </div>

      {/* Technician & Source Metadata Glass Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-[rgba(24,178,176,0.16)] flex items-center gap-3">
          <div className="p-3 bg-[#18B2B0]/10 text-[#18B2B0] rounded-xl">
            <User className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-[#6B7280]">الفني المسؤول</span>
            <p className="text-xs font-bold text-[#2D3135] mt-0.5">
              {report.technicianName || "فني ميداني (تليجرام)"}
            </p>
            {report.technicianCode && (
              <span className="text-[10px] text-[#18B2B0] font-mono">@{report.technicianCode}</span>
            )}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-[rgba(24,178,176,0.16)] flex items-center gap-3">
          <div className="p-3 bg-[#18B2B0]/10 text-[#18B2B0] rounded-xl">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-[#6B7280]">المنطقة / المدينة</span>
            <p className="text-xs font-bold text-[#2D3135] mt-0.5">
              {report.region || "الرياض - الوسطى"}
            </p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-[rgba(24,178,176,0.16)] flex items-center gap-3">
          <div className="p-3 bg-[#18B2B0]/10 text-[#18B2B0] rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-[#6B7280]">نسبة دقة الاستخراج</span>
            <div className="mt-0.5">
              <ConfidenceBadge value={report.overallConfidence} />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-[rgba(24,178,176,0.16)] flex items-center gap-3">
          <div className="p-3 bg-[#18B2B0]/10 text-[#18B2B0] rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-[#6B7280]">حالة مطابقة الأجهزة</span>
            <p className="text-xs font-bold text-[#2D3135] mt-0.5">
              {matchedCount} من أصل {cards.length} جهاز مطابق
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Left PDF Preview, Right Editable Device Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PDF / Image Preview Column (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-[rgba(24,178,176,0.18)] shadow-sm sticky top-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#2D3135] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#18B2B0]" />
                المستند الأصلي المرفوع
              </span>
              <a
                href={`/api/courier/pdf/${report.id}?raw=1`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-[#18B2B0] hover:underline flex items-center gap-1"
              >
                <Link2 className="w-3.5 h-3.5" />
                فتح في نافذة كاملة
              </a>
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl overflow-hidden min-h-[500px] flex items-center justify-center relative">
              {previewUrl ? (
                report.fileName.toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[580px] border-none"
                    title="PDF Preview"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Document Proof"
                    className="max-h-[580px] w-full object-contain p-2"
                  />
                )
              ) : previewError ? (
                <div className="p-4 text-center">
                  <AlertCircle className="w-8 h-8 text-[#E05252] mx-auto mb-2" />
                  <p className="text-xs text-[#E05252]">{previewError}</p>
                </div>
              ) : (
                <Loader2 className="w-8 h-8 animate-spin text-[#18B2B0]" />
              )}
            </div>
          </div>
        </div>

        {/* Editable Cards Column (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-[rgba(24,178,176,0.18)]">
            <div>
              <h2 className="text-sm font-bold text-[#2D3135]">
                بيانات الأجهزة والشرائح ({cards.length})
              </h2>
              <p className="text-[11px] text-[#6B7280]">
                يمكنك التعديل مباشرة في الحقول أدناه قبل إكمال الاعتماد.
              </p>
            </div>
            {!isApplied && (
              <button
                onClick={addDeviceCard}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#18B2B0] bg-[#18B2B0]/10 hover:bg-[#18B2B0]/20 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                إضافة جهاز
              </button>
            )}
          </div>

          {/* Cards List */}
          <div className="space-y-4">
            {cards.map((card, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-[rgba(24,178,176,0.18)] shadow-sm space-y-4 relative"
              >
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#18B2B0] text-white text-xs font-bold flex items-center justify-center font-mono">
                      #{card.device_index}
                    </span>
                    <h3 className="text-xs font-bold text-[#2D3135]">
                      بيانات الجهاز / الشريحة
                    </h3>
                    <ConfidenceBadge value={card.confidence} />
                  </div>
                  <div className="flex items-center gap-2">
                    <MatchBadge status={card.match.status} />
                    {!isApplied && cards.length > 1 && (
                      <button
                        onClick={() => removeDeviceCard(idx)}
                        className="text-[#E05252] hover:bg-red-50 p-1 rounded-lg transition-colors"
                        title="حذف الجهاز"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* S/N Input */}
                  <div>
                    <label className="text-[11px] font-bold text-[#4B5563] mb-1 flex items-center gap-1">
                      <Barcode className="w-3.5 h-3.5 text-[#18B2B0]" />
                      الرقم التسلسلي للجهاز (S/N)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={card.sn}
                        onChange={(e) => updateCard(idx, { sn: e.target.value })}
                        disabled={isApplied}
                        placeholder="مثال: 95012345678"
                        className="w-full text-xs font-mono px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#18B2B0] text-[#2D3135] disabled:opacity-60"
                      />
                      <button
                        onClick={() => lookupSerial(idx)}
                        disabled={card.lookupLoading || !card.sn.trim()}
                        className="px-2.5 py-1.5 text-xs font-bold text-[#18B2B0] bg-[#18B2B0]/10 hover:bg-[#18B2B0]/20 rounded-xl transition-colors shrink-0 disabled:opacity-50"
                        title="التحقق من العهدة"
                      >
                        {card.lookupLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* SIM Serial Input */}
                  <div>
                    <label className="text-[11px] font-bold text-[#4B5563] mb-1 flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-[#18B2B0]" />
                      رقم الشريحة (SIM ICCID)
                    </label>
                    <input
                      type="text"
                      value={card.sim_serial}
                      onChange={(e) => updateCard(idx, { sim_serial: e.target.value })}
                      disabled={isApplied}
                      placeholder="مثال: 899660123456789"
                      className="w-full text-xs font-mono px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#18B2B0] text-[#2D3135] disabled:opacity-60"
                    />
                  </div>

                  {/* TID Input */}
                  <div>
                    <label className="text-[11px] font-bold text-[#4B5563] mb-1 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-[#18B2B0]" />
                      رقم العميل / Terminal ID (TID)
                    </label>
                    <input
                      type="text"
                      value={card.tid}
                      onChange={(e) => updateCard(idx, { tid: e.target.value })}
                      disabled={isApplied}
                      placeholder="مثال: 15805012"
                      className="w-full text-xs font-mono px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#18B2B0] text-[#2D3135] disabled:opacity-60"
                    />
                  </div>

                  {/* Merchant Name Input */}
                  <div>
                    <label className="text-[11px] font-bold text-[#4B5563] mb-1 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-[#18B2B0]" />
                      اسم المتجر / العميل
                    </label>
                    <input
                      type="text"
                      value={card.merchant}
                      onChange={(e) => updateCard(idx, { merchant: e.target.value })}
                      disabled={isApplied}
                      placeholder="اسم المتجر"
                      className="w-full text-xs px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#18B2B0] text-[#2D3135] disabled:opacity-60"
                    />
                  </div>
                </div>

                {card.lookupMessage && (
                  <p className="text-[11px] text-[#18B2B0] font-medium bg-[#18B2B0]/10 px-3 py-1.5 rounded-lg">
                    {card.lookupMessage}
                  </p>
                )}
              </motion.div>
            ))}
          </div>

          {/* Linking Request & Action Bar */}
          <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-[rgba(24,178,176,0.18)] shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[#2D3135] border-b border-[#F1F5F9] pb-2">
              ربط الطلب والتطبيق المباشر
            </h3>

            {linkedRequestId ? (
              <div className="flex items-center justify-between p-3 bg-[#18B2B0]/10 border border-[#18B2B0]/25 rounded-xl">
                <div>
                  <span className="text-[10px] text-[#6B7280]">مرتبط بالطلب:</span>
                  <p className="text-xs font-bold text-[#18B2B0]">
                    طلب #{linkedRequestId} {linkedRequestTid ? `(${linkedRequestTid})` : ""}
                  </p>
                </div>
                {!isApplied && (
                  <button
                    onClick={() => {
                      setLinkedRequestId(null);
                      setLinkedRequestTid(null);
                    }}
                    className="text-xs font-bold text-[#E05252] hover:underline"
                  >
                    تغيير الربط
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#6B7280]">
                  البحث عن رقم طلب للربط به:
                </label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <input
                    value={linkQuery}
                    onChange={(e) => setLinkQuery(e.target.value)}
                    placeholder="ابحث برقم الطلب، اسم المتجر، أو رقم الهاتف…"
                    className="w-full text-xs pr-9 pl-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#18B2B0]"
                  />
                </div>

                {linkQuery && linkResults.length > 0 && (
                  <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-lg divide-y divide-[#F1F5F9] max-h-48 overflow-y-auto">
                    {linkResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setLinkedRequestId(r.id);
                          setLinkedRequestTid(r.tid || `ID: ${r.id}`);
                          setLinkQuery("");
                        }}
                        className="w-full text-start p-2.5 hover:bg-[#18B2B0]/10 flex flex-col gap-0.5 transition-colors"
                      >
                        <span className="text-xs font-bold text-[#2D3135]">
                          {r.customerName || "عميل"} (طلب #{r.id})
                        </span>
                        <span className="text-[10px] text-[#6B7280] font-mono">
                          TID: {r.tid} | Terminal: {r.terminalId}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {!isApplied && (
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={handleComplete}
                  disabled={completing || !linkedRequestId}
                  className="w-full sm:flex-1 py-3 px-4 text-xs font-bold text-white bg-[#18B2B0] hover:bg-[#159A98] rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {completing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  إكمال جميع الأجهزة والاعتماد ✅
                </button>

                <button
                  onClick={() => setRejectModalOpen(true)}
                  className="w-full sm:w-auto py-3 px-4 text-xs font-bold text-[#E05252] bg-[#E05252]/10 hover:bg-[#E05252]/20 border border-[#E05252]/25 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  إرجاع للفني ⚠️
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Rejection Modal */}
      <AnimatePresence>
        {rejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-[rgba(24,178,176,0.18)] p-6 space-y-4 relative font-sans"
            >
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2 text-[#E05252]">
                  <ShieldAlert className="w-5 h-5" />
                  <h3 className="text-sm font-bold text-[#2D3135]">
                    إرجاع تقرير التركيب للمراجعة (تليجرام)
                  </h3>
                </div>
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="text-[#6B7280] hover:text-[#2D3135] p-1 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-[#6B7280] leading-relaxed">
                سيؤدي هذا الإجراء إلى تحديث حالة التقرير إلى <strong className="text-[#E05252]">مرتجع</strong> وإرسال إشعار فوري للفني عبر دردشة التليجرام يتضمن سبب المشكلة وملاحظتك المباشرة.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#4B5563] block mb-1">
                    السبب الرئيسي للإرجاع:
                  </label>
                  <select
                    value={rejectReasonCategory}
                    onChange={(e) => setRejectReasonCategory(e.target.value)}
                    className="w-full text-xs p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#18B2B0] text-[#2D3135]"
                  >
                    <option value="UNCLEAR_PHOTO">📸 صورة المستند/الملصق غير واضحة</option>
                    <option value="SERIAL_MISMATCH">🔢 الرقم التسلسلي للجهاز غير مطابق للعهدة</option>
                    <option value="SIM_MISMATCH">💳 رقم الشريحة (SIM) غير مطابق</option>
                    <option value="MERCHANT_TID_MISMATCH">🏬 بيانات التاجر أو TID غير مطابقة</option>
                    <option value="OTHER">❓ سبب آخر (موضح بالملاحظات)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4B5563] block mb-1">
                    📝 ملاحظة المشرف المباشرة للفني:
                  </label>
                  <textarea
                    rows={3}
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="اكتب التوضيح المباشر للفني (مثال: الرقم التسلسلي الأخير مغطى، يرجى إعادة التصوير)..."
                    className="w-full text-xs p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#18B2B0] text-[#2D3135]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#6B7280] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={rejecting}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#E05252] hover:bg-[#C93F3F] rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {rejecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  إرسال الإشعار وإرجاع التقرير
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
