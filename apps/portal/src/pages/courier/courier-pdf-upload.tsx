import { useTranslation } from "@/lib/language";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
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

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    applied: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25",
    pending: "text-amber-400 bg-amber-500/15 border-amber-500/25",
    failed: "text-red-400 bg-red-500/15 border-red-500/25",
  };
  const icons: Record<string, typeof CheckCircle2> = {
    applied: CheckCircle2,
    pending: Clock,
    failed: AlertCircle,
  };
  const Icon = icons[status] || FileText;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${
        styles[status] || "text-slate-400 bg-slate-700/30 border-slate-700"
      }`}
    >
      <Icon className="w-3 h-3" />
      {status}
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
    <div dir={dir} className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          {t('courier.documents_data_images')}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {t('courier.report_system_data')}
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleUpload(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-14 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          dragOver
            ? "border-purple-500 bg-purple-500/10"
            : "border-slate-700/60 hover:border-slate-600 bg-[#1a3636] hover:bg-[#1e3d3d]"
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
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-3" />
            <p className="text-slate-300 font-medium">{t('courier.file_2')}</p>
          </>
        ) : (
          <>
            <UploadCloud className="w-10 h-10 text-slate-500 mb-3" />
            <p className="text-slate-200 font-medium">{t('courier.file_image')}</p>
            <p className="text-xs text-slate-500 mt-1">
              {t('courier.date_1')}
            </p>
          </>
        )}
      </div>

      {/* Recent Uploads */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          {t('courier.reports_2')}
        </h2>
        <div className="bg-[#1a3636] border border-slate-700/50 rounded-xl overflow-hidden shadow">
          <table className="w-full text-sm">
            <thead className="bg-[#142d2d] text-slate-400 border-b border-slate-700/50">
              <tr>
                {[t('courier.name_file'), t('courier.item_15940'), t('courier.date_2'), t('courier.item_19035'), t('courier.status'), ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-start font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <Loader2 className="animate-spin w-5 h-5 inline-block" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    {t('courier.no_3')}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-700/10 transition-colors">
                    <td className="px-4 py-3 text-slate-200 font-medium">{r.fileName}</td>
                    <td className="px-4 py-3 text-slate-400">{r.uploadedByName || "—"}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {r.uploadedAt ? new Date(r.uploadedAt).toLocaleString("ar-SA") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge value={r.overallConfidence} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/courier/pdf/${r.id}`}
                        className="text-xs font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded-lg transition-colors"
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
    </div>
  );
}
