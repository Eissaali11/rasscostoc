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
    <div dir="rtl" className="space-y-6 text-slate-100">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <History className="w-6 h-6 text-cyan-400" />
            سجل الرقابة والتدقيق (Audit Trail)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            سجل زمني متكامل لكافة العمليات، الحذف، التعديلات وتحديثات المخزون على مستوى الحقول.
          </p>
        </div>
        <div>
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400/80"
          >
            <option value="">جميع الجداول</option>
            <option value="requests">البيانات الخام (Requests)</option>
            <option value="executions">بيانات التحقق (Executions)</option>
          </select>
        </div>
      </div>

      <div className="text-sm text-slate-450">
        تم تسجيل <span className="font-semibold text-cyan-400">{total}</span> حركة نظام وتعديل.
      </div>

      {/* Audit table */}
      <div className="bg-[#1a3636] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#102222] text-slate-300 border-b border-slate-700/60 sticky top-0 z-10">
              <tr>
                <th className="p-4 font-semibold">التوقيت</th>
                <th className="p-4 font-semibold">المستخدم</th>
                <th className="p-4 font-semibold">الجدول</th>
                <th className="p-4 font-semibold">رقم السجل</th>
                <th className="p-4 font-semibold">العملية</th>
                <th className="p-4 font-semibold">الحقل</th>
                <th className="p-4 font-semibold">القيمة السابقة</th>
                <th className="p-4 font-semibold">القيمة الجديدة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                      جاري تحميل سجلات التدقيق والرقابة...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500">
                    لا يوجد أي حركات مسجلة بالفلاتر المحددة.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 whitespace-nowrap text-xs text-slate-400">{row.changedAt || "—"}</td>
                    <td className="p-4 whitespace-nowrap font-medium text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {row.changedByName || "نظام التلقائي"}
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap font-mono text-xs">{row.tableName}</td>
                    <td className="p-4 whitespace-nowrap font-mono">#{row.recordId}</td>
                    <td className="p-4 whitespace-nowrap">
                      {row.action === "create" ? (
                        <span className="text-emerald-400 font-semibold">إضافة (Create)</span>
                      ) : row.action === "delete" ? (
                        <span className="text-red-400 font-semibold">حذف (Delete)</span>
                      ) : (
                        <span className="text-cyan-400 font-semibold">تعديل (Update)</span>
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
