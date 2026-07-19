import { useTranslation } from "@/lib/language";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
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
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#18B2B0] bg-[#18B2B0]/12 border border-[#18B2B0]/25 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" />
        مطابقة ناجحة
      </span>
    );
  }
  if (status === "needs_review") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B45309] bg-[#F4B740]/18 border border-[#F4B740]/35 px-2 py-0.5 rounded-full">
        <AlertCircle className="w-3 h-3" />
        تحتاج مراجعة
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6B7280] bg-[#F1F5F9] border border-[#E2E8F0] px-2 py-0.5 rounded-full">
      غير معروف
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
        const res = await fetch(`/api/courier/pdf/${report.id}?raw=1`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`preview ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setPreviewUrl(null);
          setPreviewError(
            "تعذّر تحميل معاينة المستند. تأكد أن الخادم المحلي يعمل على المنفذ 3001 ثم أعد تحميل الصفحة.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [report?.id]);

  const deviceCount = cards.length;

  const updateCard = (index: number, patch: Partial<DeviceCard>) => {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  async function lookupSerial(cardIndex: number, kind: "sn" | "sim_serial") {
    const card = cards[cardIndex];
    if (!card) return;
    const serial = (kind === "sn" ? card.sn : card.sim_serial).trim();
    if (!serial) {
      toast({
        title: t("courier.alert"),
        description: "أدخل الرقم أولًا ثم ابحث",
        variant: "destructive",
      });
      return;
    }

    updateCard(cardIndex, { lookupLoading: true, lookupMessage: null });
    try {
      const res = await apiRequest("POST", "/api/courier/serial-lookup", { sn: serial });
      const data: SerialLookupResult = await res.json();

      if (kind === "sn") {
        if (data.found && data.technician) {
          updateCard(cardIndex, {
            lookupLoading: false,
            lookupMessage: data.message ?? null,
            match: {
              technician_name: data.technician.fullName,
              technician_code:
                data.technician.technicianCode ?? data.technician.username,
              status: "matched",
              confidence: 95,
            },
          });
        } else {
          updateCard(cardIndex, {
            lookupLoading: false,
            lookupMessage: data.message ?? "لم يُعثر على فني في العهدة",
            match: {
              technician_name: null,
              technician_code: null,
              status: "needs_review",
              confidence: null,
            },
          });
        }
      } else {
        updateCard(cardIndex, {
          lookupLoading: false,
          lookupMessage:
            data.message ?? (data.found ? "الشريحة موجودة" : "الشريحة غير موجودة"),
        });
      }
    } catch {
      updateCard(cardIndex, { lookupLoading: false, lookupMessage: "فشل البحث" });
      toast({
        title: "تعذّر البحث",
        description: `فشل البحث عن الرقم: ${serial}`,
        variant: "destructive",
      });
    }
  }

  function addEmptyDevice() {
    setCards((prev) => [
      ...prev,
      {
        device_index: prev.length + 1,
        sn: "",
        sim_serial: "",
        tid: "",
        merchant: "",
        confidence: 0,
        match: {
          technician_name: null,
          technician_code: null,
          status: "unknown",
          confidence: null,
        },
      },
    ]);
  }

  async function handleReextract() {
    if (!id) return;
    setReextracting(true);
    try {
      const res = await apiRequest("POST", `/api/courier/pdf/${id}/reextract`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "فشل إعادة الاستخراج");
      }
      const nextCards = toCards(data.extractedJson || data.fields || { devices: data.devices });
      setCards(nextCards);
      if (data.fields?.date?.value || data.extractedJson?.date?.value) {
        setDeliveryDate(
          data.extractedJson?.date?.value ?? data.fields?.date?.value ?? "",
        );
      }
      if (data.fields?.time?.value || data.extractedJson?.time?.value) {
        setTime(data.extractedJson?.time?.value ?? data.fields?.time?.value ?? "");
      }
      await queryClient.invalidateQueries({ queryKey: [`/api/courier/pdf/${id}`] });
      if (nextCards.length) {
        toast({
          title: "تم الاستخراج بالذكاء الاصطناعي",
          description: `تم اكتشاف ${nextCards.length} جهازًا عبر Vision`,
        });
      } else {
        toast({
          title: "لم يُعثر على أجهزة",
          description:
            data.visionError ||
            "تأكد من تفعيل المفتاح في إعدادات الذكاء الاصطناعي وأن الملف واضح",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: t("messages.error"),
        description: err instanceof Error ? err.message : "فشل إعادة الاستخراج",
        variant: "destructive",
      });
    } finally {
      setReextracting(false);
    }
  }

  async function handleComplete() {
    if (!linkedRequestId) {
      toast({
        title: t("courier.alert"),
        description: t("courier.report"),
        variant: "destructive",
      });
      return;
    }
    if (cards.length === 0) {
      toast({
        title: t("courier.alert"),
        description: "لا توجد أجهزة. أضف جهازًا يدويًا أو أعد رفع ملف قابل للاستخراج.",
        variant: "destructive",
      });
      return;
    }
    setCompleting(true);
    try {
      const res = await apiRequest("POST", `/api/courier/pdf/${id}/complete`, {
        request_id: linkedRequestId,
        devices: cards.map((c) => ({
          sn: c.sn || null,
          sim_serial: c.sim_serial || null,
          tid: c.tid || null,
          technician_code: c.match.technician_code,
          sales_technician: c.match.technician_name,
        })),
        deliveryDate: deliveryDate || null,
        time: time || null,
        paperRoll: "Yes",
      });

      if (res.ok) {
        toast({
          title: t("courier.completed_successfully"),
          description: t("courier.completed_report_data_successf"),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/courier/pdf"] });
        navigate(`/courier/requests/${linkedRequestId}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: t("courier.error"),
          description: data.error || data.message || t("courier.fail_report"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("courier.error"),
        description: t("courier.error_send_data"),
        variant: "destructive",
      });
    } finally {
      setCompleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[#6B7280]">
        <Loader2 className="w-8 h-8 animate-spin text-[#18B2B0] mb-2" />
        <p className="text-sm">{t("courier.loading_report_data")}</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[#6B7280]">
        <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
        <p className="text-sm">{t("courier.fail_loading_details_report")}</p>
      </div>
    );
  }

  const isImage = /\.(png|jpe?g|webp)$/i.test(report.fileName);

  return (
    <div dir={dir} className="rassco-page space-y-6 max-w-7xl mx-auto pb-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <button
          onClick={() => navigate("/courier/pdf")}
          className="flex items-center gap-1 text-xs font-semibold text-[#6B7280] hover:text-[#18B2B0] transition-colors mb-3"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          {t("courier.item_25514")}
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#2D3135] flex items-center gap-3">
          <span className="courier-icon-badge">
            <Sparkles className="w-5 h-5" />
          </span>
          {t("courier.review_document_data_images")}
        </h1>
        <p className="text-sm text-[#6B7280] mt-1.5 ps-14">
          {t("courier.file_1")}{" "}
          <span className="font-mono text-[#18B2B0] font-semibold">{report.fileName}</span>
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 courier-panel courier-panel-static flex flex-col">
          <div className="bg-[#F8FAFC] px-4 py-3 border-b border-[rgba(24,178,176,0.16)] flex items-center justify-between">
            <span className="text-xs font-bold text-[#4B5563]">{t("courier.document")}</span>
            <ConfidenceBadge value={report.overallConfidence} />
          </div>
          {previewError ? (
            <div className="w-full h-[650px] bg-[#F8FAFC] flex flex-col items-center justify-center gap-2 p-6 text-center">
              <AlertCircle className="w-8 h-8 text-[#E05252]" />
              <p className="text-sm text-[#E05252] font-semibold">{previewError}</p>
            </div>
          ) : !previewUrl ? (
            <div className="w-full h-[650px] bg-[#F8FAFC] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#18B2B0]" />
            </div>
          ) : isImage ? (
            <div className="w-full h-[650px] bg-[#F8FAFC] flex items-center justify-center overflow-auto p-4">
              <img
                src={previewUrl}
                alt={t("courier.document_1")}
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>
          ) : (
            <iframe src={previewUrl} className="w-full h-[650px] bg-[#F8FAFC]" title="PDF preview" />
          )}
        </div>

        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="courier-panel courier-panel-static p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#18B2B0]">
              {deviceCount > 0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  تم اكتشاف {deviceCount} جهازًا
                  <span className="text-xs font-semibold text-[#6B7280]">
                    · مطابقة: {matchedCount}/{deviceCount}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-[#B45309]" />
                  <span className="text-[#B45309]">
                    لم يُستخرج أي جهاز تلقائيًا (الملف قد يكون صورة ممسوحة بدون نص)
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReextract}
                disabled={reextracting}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#18B2B0] hover:underline disabled:opacity-50"
              >
                {reextracting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                استخراج بالذكاء الاصطناعي
              </button>
              <button
                type="button"
                onClick={addEmptyDevice}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#18B2B0] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة جهاز
              </button>
            </div>
          </div>

          {deviceCount === 0 ? (
            <div className="courier-panel courier-panel-static p-5 text-sm text-[#6B7280] leading-relaxed space-y-2">
              <p>
                لم تُستخرج أجهزة من طبقة النص. إذا كان الملف ممسوحًا ضوئيًا، اضغط «استخراج بالذكاء الاصطناعي»
                بعد تفعيل المفتاح من صفحة إعدادات الذكاء الاصطناعي.
              </p>
              <p>أو أضف الأجهزة يدويًا بزر «إضافة جهاز»، ثم ابحث عن الفني وأكمل الطلب.</p>
            </div>
          ) : null}

          {cards.map((card, index) => (
            <div key={`${card.device_index}-${index}`} className="courier-panel courier-panel-static p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#2D3135]">الجهاز {card.device_index}</h2>
                <div className="flex items-center gap-2">
                  <ConfidenceBadge value={card.confidence} />
                  <MatchBadge status={card.match.status} />
                </div>
              </div>

              {(
                [
                  ["sn", "الرقم التسلسلي", card.sn],
                  ["sim_serial", "الشريحة", card.sim_serial],
                  ["tid", "TID", card.tid],
                ] as const
              ).map(([key, label, value]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-semibold text-[#4B5563]">{label}</label>
                  <div className="flex gap-2">
                    <input
                      dir="ltr"
                      className="courier-input font-mono flex-1"
                      value={value}
                      onChange={(e) =>
                        updateCard(index, { [key]: e.target.value } as Partial<DeviceCard>)
                      }
                    />
                    {(key === "sn" || key === "sim_serial") && (
                      <button
                        type="button"
                        className="courier-btn-secondary px-3 shrink-0"
                        disabled={card.lookupLoading}
                        onClick={() => lookupSerial(index, key)}
                        title="بحث ومطابقة العهدة"
                      >
                        {card.lookupLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="rounded-xl bg-[#F8FAFC] border border-[rgba(24,178,176,0.16)] p-3 text-sm space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-xs font-semibold text-[#6B7280]">الفني</span>
                  <span className="font-bold text-[#2D3135]">
                    {card.match.technician_name || "غير معروف"}
                  </span>
                </div>
                {card.lookupMessage ? (
                  <p className="text-[11px] text-[#6B7280]">{card.lookupMessage}</p>
                ) : (
                  <p className="text-[11px] text-[#6B7280]">
                    اضغط أيقونة البحث بجانب الرقم التسلسلي لإظهار الفني من العهدة.
                  </p>
                )}
              </div>
            </div>
          ))}

          <div className="courier-panel courier-panel-static p-5 space-y-4">
            <h2 className="text-sm font-bold text-[#4B5563] border-b border-[rgba(24,178,176,0.16)] pb-2 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-[#18B2B0]" />
              {t("courier.item_35123")}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#4B5563]">تاريخ التنفيذ</label>
                <input
                  className="courier-input"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#4B5563]">الوقت</label>
                <input
                  className="courier-input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="HH:MM"
                />
              </div>
            </div>

            {linkedRequestId ? (
              <div className="space-y-3">
                <div className="bg-[#18B2B0]/10 border border-[#18B2B0]/25 text-[#18B2B0] rounded-xl p-3 text-sm flex flex-col gap-1">
                  <span className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {t("courier.linked_to_tid", {
                      tid: linkedRequestTid || t("courier.loading"),
                    })}
                  </span>
                  <span className="text-xs text-[#18B2B0]/80 font-mono">
                    {t("courier.request_count", { count: linkedRequestId })}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setLinkedRequestId(null);
                    setLinkedRequestTid(null);
                  }}
                  className="w-full text-xs font-bold text-[#E05252] hover:text-[#C93F3F] bg-[#E05252]/10 hover:bg-[#E05252]/15 py-2 rounded-xl transition-colors border border-[#E05252]/25"
                >
                  {t("courier.request")}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] leading-relaxed">{t("courier.request_data")}</p>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <input
                    value={linkQuery}
                    onChange={(e) => setLinkQuery(e.target.value)}
                    placeholder={t("courier.mobile_name_customer_1")}
                    className="courier-input pr-10"
                  />
                </div>
                {linkQuery && (
                  <div className="bg-[#F8FAFC] border border-[rgba(24,178,176,0.16)] rounded-xl divide-y divide-[rgba(226,232,240,0.9)] overflow-hidden max-h-60 overflow-y-auto">
                    {linkResults.length === 0 ? (
                      <div className="p-3 text-xs text-[#6B7280] text-center">{t("courier.no_results")}</div>
                    ) : (
                      linkResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            setLinkedRequestId(r.id);
                            setLinkedRequestTid(r.tid || `ID: ${r.id}`);
                          }}
                          className="w-full text-start p-2.5 hover:bg-[#18B2B0]/05 flex flex-col gap-0.5 transition-colors"
                        >
                          <span className="text-xs font-bold text-[#2D3135]">
                            {r.customerName || t("courier.customer")}
                          </span>
                          <span className="text-[10px] text-[#6B7280] font-mono">
                            TID: {r.tid} | Terminal ID: {r.terminalId}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleComplete}
              disabled={completing || !linkedRequestId || report.status === "applied"}
              className="w-full courier-btn-primary em-ripple disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {completing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جارٍ الإكمال…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  إكمال جميع الأجهزة
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
