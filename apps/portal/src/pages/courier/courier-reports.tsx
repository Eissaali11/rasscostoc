import { useTranslation } from "@/lib/language";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useCourierRenderPerf } from "@/hooks/use-courier-render-perf";
import { motion } from "framer-motion";
import {
  Loader2,
  Download,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
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
  const { t } = useTranslation();
  if (!status)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6B7280] bg-[#F1F5F9] px-2.5 py-1 rounded-full border border-[#E2E8F0]">
        <Clock className="w-3 h-3" />
        {t('courier.submit')}
      </span>
    );

  if (status.toLowerCase().includes("completed"))
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#18B2B0] bg-[#18B2B0]/12 px-2.5 py-1 rounded-full border border-[#18B2B0]/25">
        <CheckCircle2 className="w-3 h-3" />
        {t('courier.completed_5')}
      </span>
    );

  if (status === "Not Completed")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E05252] bg-[#E05252]/10 px-2.5 py-1 rounded-full border border-[#E05252]/25">
        <XCircle className="w-3 h-3" />
        {t('courier.completed_6')}
      </span>
    );

  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B45309] bg-[#F4B740]/18 px-2.5 py-1 rounded-full border border-[#F4B740]/35">
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
  const { t, dir } = useTranslation();
  useCourierRenderPerf("reports");
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
    
    // Download authenticates via the httpOnly cookie on the GET navigation.
    return `/api/courier/requests/export?${params.toString()}`;
  };

  const total = data?.total || 0;
  const rows = data?.rows || [];

  return (
    <div dir={dir} className="rassco-page space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#2D3135] flex items-center gap-3">
            <span className="courier-icon-badge">
              <Filter className="w-5 h-5" />
            </span>
            {t('courier.operations')}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1.5 ps-14">
            {t('courier.filter_transactions_results_fi')}
          </p>
        </div>
        <div>
          <a
            href={getExportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="courier-btn-primary em-ripple"
          >
            <Download className="w-3.5 h-3.5" />
            {t('courier.export_report_count', { count: total })}
          </a>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="courier-panel courier-panel-static p-6 space-y-4"
      >
        <h3 className="text-sm font-bold text-[#18B2B0] flex items-center gap-2">
          <Filter className="w-4 h-4" />
          {t('courier.search')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">{t('courier.date_3')}</label>
            <input
              type="date"
              className="courier-input"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">{t('courier.date_4')}</label>
            <input
              type="date"
              className="courier-input"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">{t('courier.city')}</label>
            <select
              className="courier-input"
              value={filters.city}
              onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
            >
              <option value="">{t('courier.item_11212')}</option>
              {lookups?.cities.map((c) => (
                <option key={c.id} value={c.name_en}>
                  {c.name_en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">{t('courier.technician')}</label>
            <select
              className="courier-input"
              value={filters.technician}
              onChange={(e) => setFilters((f) => ({ ...f, technician: e.target.value }))}
            >
              <option value="">{t('courier.technicians')}</option>
              {lookups?.technicians.map((tech) => (
                <option key={tech.id} value={tech.name}>
                  {tech.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">{t('courier.status_3')}</label>
            <select
              className="courier-input"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">{t('courier.item_14331')}</option>
              <option value="Installation Completed - NL">{t('courier.completed_7')}</option>
              <option value="Not Completed">{t('courier.completed_6')}</option>
              <option value="Under Process">{t('courier.item_17482')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">{t('courier.type_sim')}</label>
            <select
              className="courier-input"
              value={filters.simType}
              onChange={(e) => setFilters((f) => ({ ...f, simType: e.target.value }))}
            >
              <option value="">{t('courier.item_14371')}</option>
              {lookups?.simTypes.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">{t('courier.item_21448')}</label>
            <select
              className="courier-input"
              value={filters.vendor}
              onChange={(e) => setFilters((f) => ({ ...f, vendor: e.target.value }))}
            >
              <option value="">{t('courier.item_14347')}</option>
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
              className="w-full courier-btn-secondary"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('courier.item_27084')}
            </button>
          </div>
        </div>
      </motion.div>

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
                <th>{t('courier.date_2')}</th>
                <th>TID</th>
                <th>{t('courier.city')}</th>
                <th>{t('courier.customer_1')}</th>
                <th>{t('courier.sales')}</th>
                <th>{t('courier.type_sim')}</th>
                <th>{t('courier.number_serial_1')}</th>
                <th className="text-center">{t('courier.status')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-[#6B7280]">
                    <Loader2 className="animate-spin w-5 h-5 inline-block me-2 text-[#18B2B0]" />
                    {t('courier.loading_operations')}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-[#6B7280]">
                    {t('courier.no_logs')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="text-[#4B5563]">{row.date || "—"}</td>
                    <td className="font-mono font-semibold text-[#18B2B0]">{row.tid || "—"}</td>
                    <td className="text-[#4B5563]">{row.city || "—"}</td>
                    <td className="font-semibold text-[#2D3135]">{row.customerName || "—"}</td>
                    <td className="text-[#4B5563]">{row.execution?.salesTechnician || "—"}</td>
                    <td className="text-[#4B5563]">{row.execution?.simType || "—"}</td>
                    <td className="font-mono text-xs text-[#6B7280]">{row.execution?.sn || "—"}</td>
                    <td className="text-center">
                      <StatusBadge status={row.execution?.installationStatus} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
