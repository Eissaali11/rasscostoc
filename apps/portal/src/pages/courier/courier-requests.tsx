import { useTranslation } from "@/lib/language";
import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { AddCourierRequestModal } from "@/components/add-courier-request-modal";
import { EditCourierExecutionModal } from "@/components/edit-courier-execution-modal";
import { motion } from "framer-motion";
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
  Phone,
  MoreVertical,
  Edit2,
  Trash2,
  FileInput,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useCourierRenderPerf } from "@/hooks/use-courier-render-perf";

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
  const { t } = useTranslation();
  if (!status)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6B7280] bg-[#F1F5F9] px-2.5 py-1 rounded-full border border-[#E2E8F0]">
        <Clock className="w-3 h-3" />
        {t("courier.verification_3")}
      </span>
    );

  const lower = status.toLowerCase();
  if (lower.includes("completed"))
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#18B2B0] bg-[#18B2B0]/12 px-2.5 py-1 rounded-full border border-[#18B2B0]/25">
        <CheckCircle2 className="w-3 h-3" />
        {t("courier.completed_5")}
      </span>
    );

  if (status === "Not Completed")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E05252] bg-[#E05252]/10 px-2.5 py-1 rounded-full border border-[#E05252]/25">
        <XCircle className="w-3 h-3" />
        {t("courier.completed_6")}
      </span>
    );

  if (status === "Customer Not Answering")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#4B5563] bg-[#4B5563]/10 px-2.5 py-1 rounded-full border border-[#4B5563]/20">
        <Phone className="w-3 h-3" />
        {t("courier.customer_no")}
      </span>
    );

  if (status === "In Progress")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B45309] bg-[#F4B740]/18 px-2.5 py-1 rounded-full border border-[#F4B740]/35">
        <Clock className="w-3 h-3" />
        {t("courier.item_15830")}
      </span>
    );

  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6B7280] bg-[#F8FAFC] px-2.5 py-1 rounded-full border border-[#E2E8F0]">
      <Clock className="w-3 h-3" />
      {status}
    </span>
  );
}

const PAGE_SIZE = 25;

export default function CourierRequestsPage() {
  const { t, dir } = useTranslation();
  const { toast } = useToast();
  useCourierRenderPerf("verification");
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

  const handleDeleteRequest = async (id: number) => {
    if (!confirm(t("courier.delete_request"))) return;
    try {
      await apiRequest("DELETE", `/api/courier/requests/${id}`);
      toast({
        title: t("courier.completed_delete_successfully"),
        description: t("courier.completed_scan_request_system"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/requests"] });
    } catch {
      toast({
        title: t("courier.fail_delete"),
        variant: "destructive",
      });
    }
  };

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
          title: t('courier.completed_import_successfully'),
          description: t('courier.import_3', { var_0: result.totalRows, var_1: result.importedCount, var_2: result.skippedCount }),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/courier/requests"] });
      } else {
        toast({
          title: t('courier.fail_import'),
          description: result.error || t('courier.error_file'),
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: t('courier.error'),
        description: t('courier.item_42983'),
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
    <div dir={dir} className="rassco-page space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#2D3135] flex items-center gap-3">
            <span className="courier-icon-badge">
              <Package className="w-5 h-5" />
            </span>
            {t("courier.verification_requests")}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1.5 ps-14">
            {t("courier.total_review_with_count", { total })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleImportExcel}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="courier-btn-secondary"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {t("courier.import_4")}
          </button>
          <button onClick={handleExportExcel} className="courier-btn-secondary">
            <Download className="w-3.5 h-3.5" />
            {t("courier.export_2")}
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="courier-btn-primary em-ripple">
            {t("courier.add_request_new_2")}
          </button>
        </div>
      </motion.div>

      {importSummary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="courier-panel courier-panel-static p-5 space-y-3 relative"
        >
          <button
            onClick={() => setImportSummary(null)}
            className="absolute top-3 left-3 text-[#6B7280] hover:text-[#2D3135]"
          >
            <X className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-bold text-[#18B2B0] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {t("courier.report_import_file")}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl p-3 border border-[rgba(24,178,176,0.16)] bg-[#F8FAFC]">
              <div className="text-[#6B7280] font-semibold">{t("courier.total")}</div>
              <div className="text-lg font-extrabold text-[#2D3135] mt-1">{importSummary.totalRows}</div>
            </div>
            <div className="rounded-xl p-3 border border-[#18B2B0]/25 bg-[#18B2B0]/08">
              <div className="text-[#18B2B0] font-semibold">{t("courier.completed_successfully_1")}</div>
              <div className="text-lg font-extrabold text-[#18B2B0] mt-1">{importSummary.importedCount}</div>
            </div>
            <div className="rounded-xl p-3 border border-[#F4B740]/35 bg-[#F4B740]/12">
              <div className="text-[#B45309] font-semibold">{t("courier.completed_8")}</div>
              <div className="text-lg font-extrabold text-[#B45309] mt-1">{importSummary.skippedCount}</div>
            </div>
            <div className="rounded-xl p-3 border border-[#E05252]/25 bg-[#E05252]/08">
              <div className="text-[#E05252] font-semibold">{t("courier.completed_9")}</div>
              <div className="text-lg font-extrabold text-[#E05252] mt-1">{importSummary.rejectedCount}</div>
            </div>
          </div>

          {(importSummary.skipped.length > 0 || importSummary.rejected.length > 0) && (
            <div className="mt-2 text-xs max-h-40 overflow-y-auto space-y-1.5 border-t border-[rgba(24,178,176,0.14)] pt-3">
              {importSummary.skipped.map((s, idx) => (
                <div key={`s-${idx}`} className="text-[#B45309] flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    {t("courier.item_7942")}
                    {s.rowNumber}: {s.error || t("courier.duplicate_3", { var_0: s.data.tid })}
                  </span>
                </div>
              ))}
              {importSummary.rejected.map((r, idx) => (
                <div key={`r-${idx}`} className="text-[#E05252] flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    {t("courier.item_7942")}
                    {r.rowNumber}: {r.error || t("courier.data_5")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="courier-toolbar"
      >
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            value={q}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("courier.search_name_number_serial_1")}
            className="courier-input pr-10"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="courier-input max-w-[220px]"
        >
          <option value="">{t("courier.all")}</option>
          <option value="pending">{t("courier.verification_3")}</option>
          <option value="Installation Completed">{t("courier.completed_5")}</option>
          <option value="Not Completed">{t("courier.completed_6")}</option>
          <option value="Customer Not Answering">{t("courier.customer_no")}</option>
          <option value="In Progress">{t("courier.item_15830")}</option>
        </select>
      </motion.div>

      {(status || reason || q) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#6B7280] font-semibold">{t("courier.active")}</span>
          {status && (
            <span className="bg-[#18B2B0]/12 text-[#18B2B0] border border-[#18B2B0]/25 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-bold">
              {t("courier.status_filter_label", {
                status: status === "pending" ? t("courier.verification_3") : status,
              })}
              <button
                onClick={() => {
                  setStatus("");
                  setPage(1);
                }}
                className="hover:text-[#149D9B] font-bold cursor-pointer"
              >
                ×
              </button>
            </span>
          )}
          {reason && (
            <span className="bg-[#E05252]/10 text-[#E05252] border border-[#E05252]/25 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-bold">
              {t("courier.reason_failed_count", { count: reason })}
              <button
                onClick={() => {
                  setReason("");
                  setPage(1);
                }}
                className="font-bold cursor-pointer"
              >
                ×
              </button>
            </span>
          )}
          {q && (
            <span className="bg-[#18B2B0]/10 text-[#18B2B0] border border-[#18B2B0]/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-bold">
              {t("courier.search_count", { count: q })}
              <button
                onClick={() => {
                  setQ("");
                  setPage(1);
                }}
                className="font-bold cursor-pointer"
              >
                ×
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setStatus("");
              setReason("");
              setQ("");
              setPage(1);
            }}
            className="text-[#6B7280] hover:text-[#18B2B0] underline font-semibold cursor-pointer text-xs"
          >
            {t("courier.scan_all")}
          </button>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="courier-panel courier-panel-static"
      >
        <div className="courier-table-wrap">
          <table className="courier-table whitespace-nowrap">
            <thead>
              <tr>
                {[
                  "#",
                  t("courier.date_2"),
                  "TID",
                  "Terminal ID",
                  t("courier.customer_1"),
                  t("courier.city"),
                  t("courier.technician"),
                  t("courier.status"),
                  t("courier.item_7882"),
                ].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-[#6B7280]">
                    <Loader2 className="animate-spin w-5 h-5 inline-block me-2 text-[#18B2B0]" />
                    {t("courier.loading_ellipsis")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-[#6B7280]">
                    {t("courier.no_results_1")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-[#6B7280] text-xs font-semibold">{r.id}</td>
                    <td className="text-[#4B5563]">{r.date || "—"}</td>
                    <td className="font-mono font-semibold text-[#18B2B0]">{r.tid || "—"}</td>
                    <td className="font-mono text-[#4B5563]">{r.terminalId || "—"}</td>
                    <td className="font-semibold text-[#2D3135]">{r.customerName || "—"}</td>
                    <td className="text-[#4B5563]">{r.city || "—"}</td>
                    <td className="text-[#4B5563]">{r.execution?.salesTechnician || r.tecName || "—"}</td>
                    <td>
                      <StatusBadge status={r.execution?.installationStatus} />
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="courier-actions-trigger"
                            aria-label={t("courier.item_7882")}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="courier-actions-menu"
                        >
                          <DropdownMenuItem
                            className="courier-actions-item"
                            onClick={() => {
                              setSelectedRequestId(r.id);
                              setIsEditModalOpen(true);
                            }}
                          >
                            {!r.execution || !r.execution.installationStatus ? (
                              <FileInput className="w-4 h-4" />
                            ) : (
                              <Edit2 className="w-4 h-4" />
                            )}
                            {!r.execution || !r.execution.installationStatus
                              ? t("courier.submit_data")
                              : t("courier.edit_data_verification")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="courier-actions-item courier-actions-item-danger"
                            onClick={() => handleDeleteRequest(r.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            {t("courier.delete_3")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className="flex items-center justify-between text-sm text-[#6B7280]">
        <span className="font-semibold">{t("courier.page_of", { page, totalPages })}</span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="p-2 rounded-xl border border-[rgba(24,178,176,0.18)] bg-white hover:border-[#18B2B0] hover:text-[#18B2B0] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="p-2 rounded-xl border border-[rgba(24,178,176,0.18)] bg-white hover:border-[#18B2B0] hover:text-[#18B2B0] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
