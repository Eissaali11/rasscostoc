import { useTranslation } from "@/lib/language";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  History,
  FileSpreadsheet,
  Clock,
  User,
  Activity
} from "lucide-react";

interface AuditRow {
  id: number;
  tableName: string;
  recordId: number;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  action: string;
  changedByName: string | null;
  changedAt: string;
}

interface ListResponse {
  rows: AuditRow[];
  total: number;
}

export default function CourierAuditLogPage() {
  const { t, dir } = useTranslation();
  const [tableFilter, setTableFilter] = useState("");

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["/api/courier/audit-log", tableFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (tableFilter) params.set("table", tableFilter);
      params.set("pageSize", "100");
      return apiRequest("GET", `/api/courier/audit-log?${params.toString()}`).then((r) => r.json());
    }
  });

  const total = data?.total || 0;
  const rows = data?.rows || [];

  return (
    <div dir={dir} className="space-y-6 text-slate-100">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <History className="w-6 h-6 text-cyan-400" />
            {t('courier.log')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {t('courier.log_inventory_level')}
          </p>
        </div>
        <div>
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/80"
          >
            <option value="">{t('courier.item_17549')}</option>
            <option value="requests">{t('courier.data')}</option>
            <option value="executions">{t('courier.data_verification')}</option>
          </select>
        </div>
      </div>

      <div className="text-sm text-slate-450">
        {t('courier.audit_moves_summary', { total })}
      </div>

      {/* Audit table */}
      <div className="bg-[#1a3636] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#102222] text-slate-300 border-b border-slate-700/60 sticky top-0 z-10">
              <tr>
                <th className="p-4 font-semibold">{t('courier.item_11155')}</th>
                <th className="p-4 font-semibold">{t('courier.user')}</th>
                <th className="p-4 font-semibold">{t('courier.table')}</th>
                <th className="p-4 font-semibold">{t('courier.number_log')}</th>
                <th className="p-4 font-semibold">{t('courier.operation')}</th>
                <th className="p-4 font-semibold">{t('courier.item_7966')}</th>
                <th className="p-4 font-semibold">{t('courier.value')}</th>
                <th className="p-4 font-semibold">{t('courier.value_1')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                      {t('courier.loading_logs')}
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500">
                    {t('courier.no_transactions')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 whitespace-nowrap text-xs text-slate-400">{row.changedAt || "—"}</td>
                    <td className="p-4 whitespace-nowrap font-medium text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {row.changedByName || t('courier.system')}
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono text-xs">{row.tableName}</td>
                    <td className="p-4 whitespace-nowrap font-mono">#{row.recordId}</td>
                    <td className="p-4 whitespace-nowrap">
                      {row.action === "create" ? (
                        <span className="text-emerald-400 font-semibold">{t('courier.add')}</span>
                      ) : row.action === "delete" ? (
                        <span className="text-red-400 font-semibold">{t('courier.delete')}</span>
                      ) : (
                        <span className="text-cyan-400 font-semibold">{t('courier.edit')}</span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono text-xs text-slate-400">{row.fieldName || "—"}</td>
                    <td className="p-4 max-w-[160px] truncate font-mono text-xs" title={row.oldValue ?? ""}>
                      {row.oldValue ?? "—"}
                    </td>
                    <td className="p-4 max-w-[160px] truncate font-mono text-xs text-cyan-300" title={row.newValue ?? ""}>
                      {row.newValue ?? "—"}
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
