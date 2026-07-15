import { useTranslation } from "@/lib/language";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  PackageCheck,
  XCircle,
  Timer,
  BarChart2,
  TrendingUp,
  FileText,
  Loader2,
  AlertCircle,
  Database,
  ClipboardCheck,
  BarChart3,
  Download,
  Zap,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

interface DashboardStats {
  totalRequests: number;
  statuses: Record<string, number>;
  failures: Record<string, number>;
}

interface AiMonitorStats {
  totalProcessed: number;
  totalApplied: number;
  averageConfidence: number;
}

const RASSCO = {
  primary: "#18B2B0",
  gray: "#6B7280",
  warning: "#F4B740",
  danger: "#E05252",
  light: "#DADDE1",
};

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  onClick,
  delay = 0,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  onClick?: () => void;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={`courier-stat-card ${onClick ? "cursor-pointer" : ""}`}
    >
      <div
        className="courier-stat-card-icon"
        style={{ backgroundColor: `${accent}18`, color: accent }}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#6B7280] mb-1 truncate">{label}</p>
        <p className="text-2xl font-extrabold text-[#2D3135] tracking-tight">{value}</p>
      </div>
    </motion.div>
  );
}

export default function CourierDashboardPage() {
  const { t, dir } = useTranslation();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/courier/dashboard/stats"],
    queryFn: () => apiRequest("GET", "/api/courier/dashboard/stats").then((r) => r.json()),
  });

  const { data: aiStats, isLoading: aiLoading } = useQuery<AiMonitorStats>({
    queryKey: ["/api/courier/ai-monitor/stats"],
    queryFn: () => apiRequest("GET", "/api/courier/ai-monitor/stats").then((r) => r.json()),
  });

  if (statsLoading || aiLoading) {
    return (
      <div className="rassco-page flex items-center justify-center h-64 text-[#6B7280]">
        <Loader2 className="animate-spin w-6 h-6 me-2 text-[#18B2B0]" />
        <span className="font-medium">{t("courier.loading")}</span>
      </div>
    );
  }

  const completed =
    stats?.statuses?.["Installation Completed - NL"] ||
    stats?.statuses?.["Installation Completed"] ||
    0;
  const notCompleted = stats?.statuses?.["Not Completed"] || 0;
  const inProgress = (stats?.totalRequests || 0) - completed - notCompleted;

  const topFailures = Object.entries(stats?.failures || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const completionRate = stats?.totalRequests
    ? Math.round((completed / stats.totalRequests) * 100)
    : 0;

  const donutData = [
    {
      name: t("courier.completed_5"),
      value: completed,
      color: RASSCO.primary,
      statusKey: "Installation Completed",
    },
    {
      name: t("courier.completed_6"),
      value: notCompleted,
      color: RASSCO.danger,
      statusKey: "Not Completed",
    },
    {
      name: t("courier.pending_1"),
      value: inProgress > 0 ? inProgress : 0,
      color: RASSCO.warning,
      statusKey: "pending",
    },
  ].filter((d) => d.value > 0);

  const barData = topFailures.map(([reason, count]) => ({
    name: reason.replace(/_/g, " "),
    count,
    reasonKey: reason,
  }));

  const handleChartClick = (state: any) => {
    if (state?.activePayload?.length > 0) {
      const clickedData = state.activePayload[0].payload;
      if (clickedData.statusKey) {
        setLocation(`/courier/requests?status=${encodeURIComponent(clickedData.statusKey)}`);
      } else if (clickedData.reasonKey) {
        setLocation(`/courier/requests?reason=${encodeURIComponent(clickedData.reasonKey)}`);
      }
    }
  };

  const quickLinks = [
    { label: t("courier.raw_data"), path: "/courier/raw-data", icon: Database },
    { label: t("courier.requests"), path: "/courier/requests", icon: ClipboardCheck },
    { label: t("courier.pdf_reports"), path: "/courier/pdf", icon: FileText },
    { label: t("courier.reports"), path: "/courier/reports", icon: BarChart3 },
    { label: t("courier.export_excel"), path: "/courier/export", icon: Download },
  ];

  return (
    <div dir={dir} className="rassco-page space-y-6 p-1">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-3"
      >
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#2D3135] tracking-tight">
          {t("courier.dashboard_delivery")}
        </h1>
        <span className="bg-[#18B2B0]/12 text-[#18B2B0] text-xs font-bold px-3 py-1.5 rounded-full border border-[#18B2B0]/25">
          Courier Module
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="courier-panel courier-panel-static p-5 space-y-3"
      >
        <h2 className="text-xs font-bold text-[#18B2B0] uppercase tracking-wide flex items-center gap-1.5">
          <Zap className="w-4 h-4" />
          {t("courier.text")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {quickLinks.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                type="button"
                onClick={() => setLocation(btn.path)}
                className="courier-quick-link"
              >
                <Icon className="w-4 h-4 text-[#18B2B0]" />
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          label={t("courier.total_requests_1")}
          value={stats?.totalRequests ?? "—"}
          icon={BarChart2}
          accent={RASSCO.primary}
          delay={0.05}
          onClick={() => setLocation("/courier/requests")}
        />
        <StatCard
          label={t("courier.completed_3")}
          value={completed}
          icon={PackageCheck}
          accent={RASSCO.primary}
          delay={0.08}
          onClick={() => setLocation("/courier/requests?status=Installation Completed")}
        />
        <StatCard
          label={t("courier.completed_4")}
          value={notCompleted}
          icon={XCircle}
          accent={RASSCO.danger}
          delay={0.11}
          onClick={() => setLocation("/courier/requests?status=Not Completed")}
        />
        <StatCard
          label={t("courier.pending")}
          value={inProgress}
          icon={Timer}
          accent={RASSCO.warning}
          delay={0.14}
          onClick={() => setLocation("/courier/requests?status=pending")}
        />
        <StatCard
          label={t("courier.item_19351")}
          value={aiStats?.totalProcessed ?? "—"}
          icon={FileText}
          accent={RASSCO.gray}
          delay={0.17}
        />
        <StatCard
          label={t("courier.item_22364")}
          value={aiStats?.totalApplied ?? "—"}
          icon={PackageCheck}
          accent={RASSCO.primary}
          delay={0.2}
        />
        <StatCard
          label={t("courier.item_27036")}
          value={aiStats?.averageConfidence ? `${aiStats.averageConfidence}%` : "—"}
          icon={TrendingUp}
          accent={RASSCO.gray}
          delay={0.23}
        />
        <StatCard
          label={t("courier.rate")}
          value={`${completionRate}%`}
          icon={TrendingUp}
          accent={RASSCO.primary}
          delay={0.26}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="courier-panel courier-panel-static p-6 flex flex-col"
        >
          <div>
            <h2 className="text-base font-bold text-[#2D3135]">{t("courier.requests_1")}</h2>
            <p className="text-xs text-[#6B7280] mt-1 font-medium">{t("courier.item_95772")}</p>
          </div>

          <div className="h-64 mt-4 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  cursor="pointer"
                  onClick={(data) =>
                    setLocation(`/courier/requests?status=${encodeURIComponent(data.statusKey)}`)
                  }
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} className="focus:outline-none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "#E6E8EC",
                    borderRadius: "12px",
                    textAlign: "right",
                    color: "#2D3135",
                  }}
                  itemStyle={{ color: "#2D3135" }}
                  formatter={(value: any, name: any) => [
                    t("courier.request_6", { var_0: value }),
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center pointer-events-none">
              <span className="text-[10px] text-[#6B7280] block font-semibold">
                {t("courier.total_requests")}
              </span>
              <span className="text-2xl font-black text-[#2D3135] block mt-0.5">
                {stats?.totalRequests || 0}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[rgba(24,178,176,0.12)]">
            {donutData.map((d) => (
              <button
                key={d.name}
                type="button"
                onClick={() =>
                  setLocation(`/courier/requests?status=${encodeURIComponent(d.statusKey)}`)
                }
                className="flex flex-col items-center gap-1 p-2 rounded-2xl bg-white/60 border border-[rgba(24,178,176,0.1)] hover:border-[#18B2B0] transition-colors text-center"
              >
                <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: d.color }} />
                <span className="text-[10px] text-[#6B7280] font-bold">{d.name}</span>
                <span className="text-xs font-black text-[#2D3135]">{d.value}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="courier-panel courier-panel-static p-6 flex flex-col"
        >
          <div>
            <h2 className="text-base font-bold text-[#2D3135]">{t("courier.fail_2")}</h2>
            <p className="text-xs text-[#6B7280] mt-1 font-medium">{t("courier.item_97347")}</p>
          </div>

          <div className="h-64 mt-4">
            {barData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#6B7280] gap-2">
                <AlertCircle className="w-8 h-8 text-[#DADDE1]" />
                <span className="text-xs font-medium">{t("courier.no_fail")}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  onClick={handleChartClick}
                >
                  <XAxis type="number" stroke="#6B7280" fontSize={10} tickLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#6B7280"
                    fontSize={9}
                    tickLine={false}
                    width={100}
                    axisLine={false}
                    tickFormatter={(val) => (val.length > 15 ? `${val.substring(0, 15)}...` : val)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#E6E8EC",
                      borderRadius: "12px",
                      textAlign: "right",
                      color: "#2D3135",
                    }}
                    itemStyle={{ color: "#2D3135" }}
                    formatter={(value: any) => [
                      t("courier.duplicate_1", { var_0: value }),
                      t("courier.item_15883"),
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} cursor="pointer">
                    {barData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index % 2 === 0 ? RASSCO.danger : "#F07171"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-[rgba(24,178,176,0.12)] text-xs text-[#6B7280] flex items-center justify-between font-medium">
            <span>{t("courier.total_fail")}</span>
            <span className="text-[#2D3135] font-bold">
              {t("courier.count_status", {
                count: Object.values(stats?.failures || {}).reduce((s, v) => s + v, 0),
              })}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
