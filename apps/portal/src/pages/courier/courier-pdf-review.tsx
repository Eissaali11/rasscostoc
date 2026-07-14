import { useTranslation } from "@/lib/language";
import { useEffect, useState } from "react";
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

export default function CourierPdfReviewPage() {
  const { t, dir } = useTranslation();
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
        title: t('courier.alert'),
        description: t('courier.report'),
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
          title: t('courier.completed_successfully'),
          description: t('courier.completed_report_data_successf'),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/courier/pdf"] });
        navigate(`/courier/requests/${linkedRequestId}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: t('courier.error'),
          description: data.error || t('courier.fail_report'),
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: t('courier.error'),
        description: t('courier.error_send_data'),
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  }

  const getFieldLabel = (key: string) => {
    const labels: Record<string, string> = {
      sn: t('courier.number_serial_8'),
      sim_serial: t('courier.number_serial_9'),
      time: t('courier.time_1'),
      date: t('courier.date_7'),
    };
    return labels[key] || key;
  };

  const getAuthToken = () => {
    return localStorage.getItem("auth-token");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[#6B7280]">
        <Loader2 className="w-8 h-8 animate-spin text-[#18B2B0] mb-2" />
        <p className="text-sm">{t('courier.loading_report_data')}</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[#6B7280]">
        <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
        <p className="text-sm">{t('courier.fail_loading_details_report')}</p>
      </div>
    );
  }

  // Generate bearer token for iframe request
  const pdfUrl = `/api/courier/pdf/${report.id}?raw=1&token=${getAuthToken() || ""}`;

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
          {t('courier.item_25514')}
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#2D3135] flex items-center gap-3">
          <span className="courier-icon-badge">
            <Sparkles className="w-5 h-5" />
          </span>
          {t('courier.review_document_data_images')}
        </h1>
        <p className="text-sm text-[#6B7280] mt-1.5 ps-14">
          {t('courier.file_1')} <span className="font-mono text-[#18B2B0] font-semibold">{report.fileName}</span>
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PDF/Image Preview Frame */}
        <div className="lg:col-span-6 courier-panel courier-panel-static flex flex-col">
          <div className="bg-[#F8FAFC] px-4 py-3 border-b border-[rgba(24,178,176,0.16)] flex items-center justify-between">
            <span className="text-xs font-bold text-[#4B5563]">{t('courier.document')}</span>
          </div>
          {report.fileName.toLowerCase().match(/\.(png|jpe?g|webp)$/) ? (
            <div className="w-full h-[650px] bg-[#F8FAFC] flex items-center justify-center overflow-auto p-4">
              <img
                src={pdfUrl}
                alt={t('courier.document_1')}
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>
          ) : (
            <iframe
              src={pdfUrl}
              className="w-full h-[650px] bg-[#F8FAFC]"
              title="PDF preview"
            />
          )}
        </div>

        {/* OCR Extracted Fields */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="courier-panel courier-panel-static p-5 space-y-4">
            <h2 className="text-sm font-bold text-[#4B5563] border-b border-[rgba(24,178,176,0.16)] pb-2">
              {t('courier.item_36640')}
            </h2>
            {Object.entries(report.extractedJson || {}).map(([key, field]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#4B5563]">
                    {getFieldLabel(key)}
                  </label>
                  <ConfidenceBadge value={field.confidence} />
                </div>
                <input
                  dir="ltr"
                  className="courier-input font-mono"
                  value={editable[key] ?? ""}
                  onChange={(e) =>
                    setEditable((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div className="pt-2 border-t border-[rgba(24,178,176,0.16)] flex items-center justify-between text-xs text-[#6B7280]">
              <span className="font-semibold">{t('courier.rate_total')}</span>
              <ConfidenceBadge value={report.overallConfidence} />
            </div>
          </div>
        </div>

        {/* Link to Request & Actions */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="courier-panel courier-panel-static p-5 flex flex-col gap-4 flex-1">
            <h2 className="text-sm font-bold text-[#4B5563] border-b border-[rgba(24,178,176,0.16)] pb-2 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-[#18B2B0]" />
              {t('courier.item_35123')}
            </h2>

            {linkedRequestId ? (
              <div className="space-y-3">
                <div className="bg-[#18B2B0]/10 border border-[#18B2B0]/25 text-[#18B2B0] rounded-xl p-3 text-sm flex flex-col gap-1">
                  <span className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {t('courier.linked_to_tid', { tid: linkedRequestTid || t('courier.loading') })}
                  </span>
                  <span className="text-xs text-[#18B2B0]/80 font-mono">
                    {t('courier.request_count', { count: linkedRequestId })}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setLinkedRequestId(null);
                    setLinkedRequestTid(null);
                  }}
                  className="w-full text-xs font-bold text-[#E05252] hover:text-[#C93F3F] bg-[#E05252]/10 hover:bg-[#E05252]/15 py-2 rounded-xl transition-colors border border-[#E05252]/25"
                >
                  {t('courier.request')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  {t('courier.request_data')}
                </p>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <input
                    value={linkQuery}
                    onChange={(e) => setLinkQuery(e.target.value)}
                    placeholder={t('courier.mobile_name_customer_1')}
                    className="courier-input pr-10"
                  />
                </div>

                {linkQuery && (
                  <div className="bg-[#F8FAFC] border border-[rgba(24,178,176,0.16)] rounded-xl divide-y divide-[rgba(226,232,240,0.9)] overflow-hidden max-h-60 overflow-y-auto">
                    {linkResults.length === 0 ? (
                      <div className="p-3 text-xs text-[#6B7280] text-center">
                        {t('courier.no_results')}
                      </div>
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
                            {r.customerName || t('courier.customer')}
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

            <div className="mt-auto pt-4 border-t border-[rgba(24,178,176,0.16)] space-y-3">
              <button
                onClick={handleApply}
                disabled={applying || !linkedRequestId}
                className="w-full courier-btn-primary em-ripple disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {applying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('courier.data_2')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t('courier.item_30270')}
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
