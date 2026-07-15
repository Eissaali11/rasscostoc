import { useTranslation } from "@/lib/language";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";

interface PdfReportRow {
  id: number;
  fileName: string;
  status: string;
  overallConfidence: number | null;
  uploadedAt: string | null;
  uploadedByName: string | null;
  requestId: number | null;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery<PdfReportRow[]>({
    queryKey: ["/api/courier/pdf"],
    queryFn: () => apiRequest("GET", "/api/courier/pdf").then((r) => r.json()),
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
        queryClient.invalidateQueries({ queryKey: ["/api/courier/pdf"] });
        navigate(`/courier/pdf/${data.id}`);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div dir={dir} className="rassco-page space-y-6 max-w-5xl">
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
      >
        <h2 className="text-sm font-bold text-[#6B7280] uppercase tracking-wide mb-3">
          {t('courier.reports_2')}
        </h2>
        <div className="courier-panel courier-panel-static">
          <div className="courier-table-wrap">
            <table className="courier-table">
              <thead>
                <tr>
                  {[t('courier.name_file'), t('courier.item_15940'), t('courier.date_2'), t('courier.item_19035'), t('courier.status'), ""].map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-[#6B7280]">
                      <Loader2 className="animate-spin w-5 h-5 inline-block me-2 text-[#18B2B0]" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-[#6B7280]">
                      {t('courier.no_3')}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-semibold text-[#2D3135]">{r.fileName}</td>
                      <td className="text-[#6B7280]">{r.uploadedByName || "—"}</td>
                      <td className="text-[#6B7280]">
                        {r.uploadedAt ? new Date(r.uploadedAt).toLocaleString("ar-SA") : "—"}
                      </td>
                      <td>
                        <ConfidenceBadge value={r.overallConfidence} />
                      </td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td>
                        <Link
                          href={`/courier/pdf/${r.id}`}
                          className="courier-action-chip"
                        >
                          {t('courier.review_2')}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
