import { useTranslation } from "@/lib/language";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  BrainCircuit,
  Loader2,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";

interface RecentReport {
  id: number;
  fileName: string;
  status: string;
  overallConfidence: number | null;
  uploadedAt: string;
  uploadedByName: string | null;
}

interface Stats {
  total: number;
  applied: number;
  pending: number;
  failed: number;
  avgConfidence: number | null;
  recent: RecentReport[];
}

function ConfidenceBadge({ value }: { value: number | null }) {
  const { t } = useTranslation();
  if (value === null) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F3F4F6] text-[#6B7280] border border-[#E6E8EC]">
        {t("courier.item_6373")}
      </span>
    );
  }

  const pct = Math.round(value * 100);
  let color = "bg-[#E05252]/10 text-[#E05252] border-[#E05252]/25";
  if (pct >= 90) {
    color = "bg-[#18B2B0]/12 text-[#18B2B0] border-[#18B2B0]/25";
  } else if (pct >= 70) {
    color = "bg-[#F4B740]/15 text-[#B8860B] border-[#F4B740]/35";
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      {t("courier.count_1", { count: pct })}
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  delay = 0,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rassco-glass p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[#6B7280]">{label}</span>
        <div
          className="size-10 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-3xl font-extrabold text-[#2D3135] mt-3 tracking-tight">{value}</div>
    </motion.div>
  );
}

export default function CourierAiMonitorPage() {
  const { t, dir } = useTranslation();
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/courier/ai-monitor/stats"],
    queryFn: () => apiRequest("GET", "/api/courier/ai-monitor/stats").then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="rassco-page flex items-center justify-center p-20 text-[#6B7280]">
        <Loader2 className="w-6 h-6 animate-spin text-[#18B2B0] me-2" />
        {t("courier.loading_data_monitor")}
      </div>
    );
  }

  const total = stats?.total || 0;
  const applied = stats?.applied || 0;
  const pending = stats?.pending || 0;
  const failed = stats?.failed || 0;
  const avgConf = stats?.avgConfidence || 0;
  const recent = stats?.recent || [];

  return (
    <div dir={dir} className="rassco-page space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rassco-glass rassco-glass-static p-6"
      >
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#2D3135] flex items-center gap-3">
          <span className="size-11 rounded-2xl bg-[#18B2B0]/12 text-[#18B2B0] flex items-center justify-center">
            <BrainCircuit className="w-6 h-6" />
          </span>
          {t("courier.monitor")}
        </h1>
        <p className="text-sm text-[#6B7280] mt-2 font-medium">{t("courier.data_invoices")}</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label={t("courier.files")} value={total} icon={FileText} accent="#18B2B0" delay={0.05} />
        <KpiCard label={t("courier.completed")} value={applied} icon={CheckCircle} accent="#18B2B0" delay={0.1} />
        <KpiCard label={t("courier.review")} value={pending} icon={Clock} accent="#F4B740" delay={0.15} />
        <KpiCard label={t("courier.fail")} value={failed} icon={AlertTriangle} accent="#E05252" delay={0.2} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rassco-glass rassco-glass-static p-5 max-w-sm flex items-center justify-between"
      >
        <div>
          <span className="text-xs text-[#6B7280] block mb-2 font-semibold">{t("courier.item_43029")}</span>
          <ConfidenceBadge value={avgConf} />
        </div>
        <BrainCircuit className="w-12 h-12 text-[#18B2B0]/20" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="space-y-3"
      >
        <h2 className="text-base font-bold text-[#2D3135]">{t("courier.files_1")}</h2>
        <div className="rassco-glass rassco-glass-static overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#F3F4F6] text-[#6B7280] border-b border-[#E6E8EC]">
                <tr>
                  <th className="p-4 font-bold">{t("courier.name_file")}</th>
                  <th className="p-4 font-bold">{t("courier.item_9514")}</th>
                  <th className="p-4 font-bold">{t("courier.date")}</th>
                  <th className="p-4 font-bold">{t("courier.item_14315")}</th>
                  <th className="p-4 font-bold">{t("courier.status")}</th>
                  <th className="p-4 font-bold">{t("courier.item_11061")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EC] text-[#2D3135]">
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#6B7280] font-medium">
                      {t("courier.no")}
                    </td>
                  </tr>
                ) : (
                  recent.map((rep) => (
                    <tr key={rep.id} className="hover:bg-[#18B2B0]/05 transition-colors">
                      <td className="p-4 font-semibold">{rep.fileName}</td>
                      <td className="p-4 text-[#6B7280]">{rep.uploadedByName || t("courier.item_14438")}</td>
                      <td className="p-4 text-xs text-[#6B7280]">{rep.uploadedAt || "—"}</td>
                      <td className="p-4">
                        <ConfidenceBadge value={rep.overallConfidence} />
                      </td>
                      <td className="p-4 capitalize font-semibold">
                        {rep.status === "applied" ? (
                          <span className="text-[#18B2B0]">{t("courier.completed_1")}</span>
                        ) : rep.status === "failed" ? (
                          <span className="text-[#E05252]">{t("courier.fail_1")}</span>
                        ) : (
                          <span className="text-[#B8860B]">{t("courier.review_1")}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/courier/pdf/${rep.id}`}
                          className="inline-flex items-center gap-1 text-xs text-[#18B2B0] hover:text-[#149D9B] transition-colors font-bold"
                        >
                          {t("courier.review_report")}
                          <ChevronLeft className="w-3.5 h-3.5" />
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
