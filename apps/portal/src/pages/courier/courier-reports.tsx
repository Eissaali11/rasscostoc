import { useTranslation } from "@/lib/language";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  FileSpreadsheet
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
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6B7280] bg-[#F1F5F9] px-2.5 py-1 rounded-full">
        <Clock className="w-3 h-3" />
        {t('courier.submit')}
      </span>
    );

  if (status.toLowerCase().includes("completed"))
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#18B2B0] bg-[#18B2B0]/12 px-2.5 py-1 rounded-full border border-[#18B2B0]/25">
        <CheckCircle2 className="w-3 h-3" />
        {t('courier.completed_5')}
      </span>
    );

  if (status === "Not Completed")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#E05252] bg-[#E05252]/12 px-2.5 py-1 rounded-full border border-[#E05252]/25">
        <XCircle className="w-3 h-3" />
        {t('courier.completed_6')}
      </span>
    );

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#B45309] bg-[#F4B740]/18 px-2.5 py-1 rounded-full border border-[#F4B740]/35">
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
    
    const token = localStorage.getItem("auth-token") || "";
    return `/api/courier/requests/export?${params.toString()}&token=${encodeURIComponent(token)}`;
  };

  const total = data?.total || 0;
  const rows = data?.rows || [];

  return (
    <div dir={dir} className="rassco-page space-y-6 text-[#2D3135]">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#2D3135] flex items-center gap-2">
            <Filter className="w-6 h-6 text-[#18B2B0]" />
            {t('courier.operations')}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {t('courier.filter_transactions_results_fi')}
          </p>
        </div>
        <div>
          <a
            href={getExportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#18B2B0] text-white rounded-xl text-sm font-bold hover:bg-[#149D9B] transition-colors shadow-lg shadow-[#18B2B0]/20"
          >
            <Download className="w-4 h-4" />
            {t('courier.export_report_count', { count: total })}
          </a>
        </div>
      </div>

      {/* Filter panel */}
      <div className="rassco-glass border border-[#E2E8F0] rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-semibold text-[#18B2B0] flex items-center gap-2">
          <Filter className="w-4 h-4" />
          {t('courier.search')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">{t('courier.date_3')}</label>
            <input
              type="date"
              className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#2D3135] focus:outline-none focus:border-[#18B2B0]"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">{t('courier.date_4')}</label>
            <input
              type="date"
              className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#2D3135] focus:outline-none focus:border-[#18B2B0]"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">{t('courier.city')}</label>
            <select
              className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#2D3135] focus:outline-none focus:border-[#18B2B0]"
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
            <label className="block text-xs font-medium text-[#6B7280] mb-1">{t('courier.technician')}</label>
            <select
              className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#2D3135] focus:outline-none focus:border-[#18B2B0]"
              value={filters.technician}
              onChange={(e) => setFilters((f) => ({ ...f, technician: e.target.value }))}
            >
              <option value="">{t('courier.technicians')}</option>
              {lookups?.technicians.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">{t('courier.status_3')}</label>
            <select
              className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#2D3135] focus:outline-none focus:border-[#18B2B0]"
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
            <label className="block text-xs font-medium text-[#6B7280] mb-1">{t('courier.type_sim')}</label>
            <select
              className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#2D3135] focus:outline-none focus:border-[#18B2B0]"
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
            <label className="block text-xs font-medium text-[#6B7280] mb-1">{t('courier.item_21448')}</label>
            <select
              className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#2D3135] focus:outline-none focus:border-[#18B2B0]"
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
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border border-[#E2E8F0] bg-white text-[#4B5563] rounded-xl text-sm font-semibold hover:bg-[#F1F5F9] hover:text-[#2D3135] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t('courier.item_27084')}
            </button>
          </div>
        </div>
      </div>

      {/* Results grid */}
      <div className="rassco-glass border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#F8FAFC] text-[#4B5563] border-b border-[#E2E8F0] sticky top-0 z-10">
              <tr>
                <th className="p-4 font-semibold">{t('courier.date_2')}</th>
                <th className="p-4 font-semibold">TID</th>
                <th className="p-4 font-semibold">{t('courier.city')}</th>
                <th className="p-4 font-semibold">{t('courier.customer_1')}</th>
                <th className="p-4 font-semibold">{t('courier.sales')}</th>
                <th className="p-4 font-semibold">{t('courier.type_sim')}</th>
                <th className="p-4 font-semibold">{t('courier.number_serial_1')}</th>
                <th className="p-4 font-semibold text-center">{t('courier.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-[#4B5563]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-[#6B7280]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-[#18B2B0]" />
                      {t('courier.loading_operations')}
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-[#6B7280]">
                    {t('courier.no_logs')}
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="p-4 whitespace-nowrap">{row.date || "—"}</td>
                    <td className="p-4 font-mono text-[#18B2B0] whitespace-nowrap">{row.tid || "—"}</td>
                    <td className="p-4 whitespace-nowrap">{row.city || "—"}</td>
                    <td className="p-4 whitespace-nowrap font-medium text-[#2D3135]">{row.customerName || "—"}</td>
                    <td className="p-4 whitespace-nowrap">{row.execution?.salesTechnician || "—"}</td>
                    <td className="p-4 whitespace-nowrap">{row.execution?.simType || "—"}</td>
                    <td className="p-4 font-mono text-xs whitespace-nowrap">{row.execution?.sn || "—"}</td>
                    <td className="p-4 whitespace-nowrap text-center">
                      <StatusBadge status={row.execution?.installationStatus} />
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
