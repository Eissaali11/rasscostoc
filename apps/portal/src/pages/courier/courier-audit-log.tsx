import { useTranslation } from "@/lib/language";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { Loader2, History, User } from "lucide-react";

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

const RASSCO = {
  primary: "#18B2B0",
  gray: "#6B7280",
  danger: "#E05252",
  success: "#149D9B",
};

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
    },
  });

  const total = data?.total || 0;
  const rows = data?.rows || [];

  const actionLabel = (action: string) => {
    if (action === "create") return { label: t("courier.add"), color: RASSCO.success };
    if (action === "delete") return { label: t("courier.delete"), color: RASSCO.danger };
    return { label: t("courier.edit"), color: RASSCO.primary };
  };

  return (
    <div dir={dir} className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#2D3135] flex items-center gap-2">
            <span
              className="size-10 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${RASSCO.primary}18`, color: RASSCO.primary }}
            >
              <History className="w-5 h-5" />
            </span>
            {t("courier.log")}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">{t("courier.log_inventory_level")}</p>
        </div>
        <select
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          className="rounded-xl border border-[rgba(24,178,176,0.18)] bg-white/90 px-4 py-2.5 text-sm text-[#2D3135] outline-none focus:border-[#18B2B0] focus:ring-2 focus:ring-[#18B2B0]/20"
        >
          <option value="">{t("courier.item_17549")}</option>
          <option value="requests">{t("courier.data")}</option>
          <option value="executions">{t("courier.data_verification")}</option>
        </select>
      </motion.div>

      <div className="text-sm font-semibold text-[#6B7280]">{t("courier.audit_moves_summary", { total })}</div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rassco-glass overflow-hidden"
      >
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm text-right">
            <thead className="sticky top-0 z-10 bg-[rgba(248,250,251,0.95)] backdrop-blur border-b border-[rgba(24,178,176,0.12)] text-[#6B7280]">
              <tr>
                <th className="p-4 font-semibold">{t("courier.item_11155")}</th>
                <th className="p-4 font-semibold">{t("courier.user")}</th>
                <th className="p-4 font-semibold">{t("courier.table")}</th>
                <th className="p-4 font-semibold">{t("courier.number_log")}</th>
                <th className="p-4 font-semibold">{t("courier.operation")}</th>
                <th className="p-4 font-semibold">{t("courier.item_7966")}</th>
                <th className="p-4 font-semibold">{t("courier.value")}</th>
                <th className="p-4 font-semibold">{t("courier.value_1")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(24,178,176,0.08)] text-[#2D3135]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-[#6B7280]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: RASSCO.primary }} />
                      {t("courier.loading_logs")}
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-[#6B7280]">
                    {t("courier.no_transactions")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const action = actionLabel(row.action);
                  return (
                    <tr key={row.id} className="hover:bg-[rgba(24,178,176,0.04)] transition-colors">
                      <td className="p-4 whitespace-nowrap text-xs text-[#6B7280]">{row.changedAt || "—"}</td>
                      <td className="p-4 whitespace-nowrap font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#6B7280]" />
                          {row.changedByName || t("courier.system")}
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap font-mono text-xs">{row.tableName}</td>
                      <td className="p-4 whitespace-nowrap font-mono">#{row.recordId}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-semibold" style={{ color: action.color }}>
                          {action.label}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap font-mono text-xs text-[#6B7280]">{row.fieldName || "—"}</td>
                      <td className="p-4 max-w-[160px] truncate font-mono text-xs text-[#6B7280]" title={row.oldValue ?? ""}>
                        {row.oldValue ?? "—"}
                      </td>
                      <td
                        className="p-4 max-w-[160px] truncate font-mono text-xs font-semibold"
                        style={{ color: RASSCO.primary }}
                        title={row.newValue ?? ""}
                      >
                        {row.newValue ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
