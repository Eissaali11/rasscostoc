import { useTranslation } from "@/lib/language";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
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
  Download
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
  YAxis
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

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-[#1a3636] border border-slate-700/50 rounded-xl p-5 flex items-center gap-4 shadow transition-all duration-300 ${
        onClick
          ? "cursor-pointer hover:border-emerald-500/50 hover:bg-[#1f3d3d] hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-0.5"
          : ""
      }`}
    >
      <div className={`p-3 rounded-lg ${color} shadow-inner`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-450 mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
      </div>
    </div>
  );
}

const COLORS = {
  completed: "#10b981",    // Emerald
  notCompleted: "#ef4444", // Red
  inProgress: "#f59e0b",   // Amber
};

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
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="animate-spin w-6 h-6 mr-2" />
        <span>{t('courier.loading')}</span>
      </div>
    );
  }

  const completed = stats?.statuses?.["Installation Completed - NL"] || stats?.statuses?.["Installation Completed"] || 0;
  const notCompleted = stats?.statuses?.["Not Completed"] || 0;
  const inProgress = (stats?.totalRequests || 0) - completed - notCompleted;

  const topFailures = Object.entries(stats?.failures || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const completionRate = stats?.totalRequests
    ? Math.round((completed / stats.totalRequests) * 100)
    : 0;

  // Data for Donut Chart (Pie Chart)
  const donutData = [
    { name: t('courier.completed_5'), value: completed, color: COLORS.completed, statusKey: "Installation Completed" },
    { name: t('courier.completed_6'), value: notCompleted, color: COLORS.notCompleted, statusKey: "Not Completed" },
    { name: t('courier.pending_1'), value: inProgress > 0 ? inProgress : 0, color: COLORS.inProgress, statusKey: "pending" },
  ].filter(d => d.value > 0);

  // Data for Failures Bar Chart
  const barData = topFailures.map(([reason, count]) => ({
    name: reason.replace(/_/g, " "),
    count,
    reasonKey: reason
  }));

  const handleChartClick = (state: any) => {
    if (state && state.activePayload && state.activePayload.length > 0) {
      const clickedData = state.activePayload[0].payload;
      if (clickedData.statusKey) {
        setLocation(`/courier/requests?status=${encodeURIComponent(clickedData.statusKey)}`);
      } else if (clickedData.reasonKey) {
        setLocation(`/courier/requests?reason=${encodeURIComponent(clickedData.reasonKey)}`);
      }
    }
  };

  return (
    <div dir={dir} className="space-y-6 p-1 text-slate-200">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-100">{t('courier.dashboard_delivery')}</h1>
        <span className="bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-500/30">
          Courier Module
        </span>
      </div>

      {/* Quick Access Shortcuts */}
      <div className="bg-[#1a3636]/60 border border-slate-700/40 rounded-2xl p-4 shadow-lg space-y-3">
        <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
          {t('courier.text')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { label: t('courier.raw_data'), path: "/courier/raw-data", icon: Database, color: "hover:bg-blue-500/10 hover:border-blue-500/30 text-slate-300" },
            { label: t('courier.requests'), path: "/courier/requests", icon: ClipboardCheck, color: "hover:bg-emerald-500/10 hover:border-emerald-500/30 text-slate-350" },
            { label: t('courier.pdf_reports'), path: "/courier/pdf", icon: FileText, color: "hover:bg-purple-500/10 hover:border-purple-500/30 text-slate-300" },
            { label: t('courier.reports'), path: "/courier/reports", icon: BarChart3, color: "hover:bg-indigo-500/10 hover:border-indigo-500/30 text-slate-350" },
            { label: t('courier.export_excel'), path: "/courier/export", icon: Download, color: "hover:bg-amber-500/10 hover:border-amber-500/30 text-slate-300" },
          ].map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                onClick={() => setLocation(btn.path)}
                className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold bg-[#102222]/85 border border-slate-750/70 text-slate-200 transition-all duration-300 cursor-pointer hover:-translate-y-0.5 shadow-sm hover:shadow ${btn.color}`}
              >
                <Icon className="w-4 h-4 text-slate-400" />
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          label={t('courier.total_requests_1')}
          value={stats?.totalRequests ?? "—"}
          icon={BarChart2}
          color="bg-blue-600"
          onClick={() => setLocation("/courier/requests")}
        />
        <StatCard
          label={t('courier.completed_3')}
          value={completed}
          icon={PackageCheck}
          color="bg-emerald-600"
          onClick={() => setLocation("/courier/requests?status=Installation Completed")}
        />
        <StatCard
          label={t('courier.completed_4')}
          value={notCompleted}
          icon={XCircle}
          color="bg-red-600"
          onClick={() => setLocation("/courier/requests?status=Not Completed")}
        />
        <StatCard
          label={t('courier.pending')}
          value={inProgress}
          icon={Timer}
          color="bg-amber-600"
          onClick={() => setLocation("/courier/requests?status=pending")}
        />
        <StatCard
          label={t('courier.item_19351')}
          value={aiStats?.totalProcessed ?? "—"}
          icon={FileText}
          color="bg-purple-600"
        />
        <StatCard
          label={t('courier.item_22364')}
          value={aiStats?.totalApplied ?? "—"}
          icon={PackageCheck}
          color="bg-cyan-600"
        />
        <StatCard
          label={t('courier.item_27036')}
          value={aiStats?.averageConfidence ? `${aiStats.averageConfidence}%` : "—"}
          icon={TrendingUp}
          color="bg-indigo-600"
        />
        <StatCard
          label={t('courier.rate')}
          value={`${completionRate}%`}
          icon={TrendingUp}
          color="bg-teal-600"
        />
      </div>

      {/* Visual Analytics Section */}
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* Donut Chart: Completion Status */}
        <div className="bg-[#1a3636] border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-100">{t('courier.requests_1')}</h2>
            <p className="text-xs text-slate-400 mt-1">{t('courier.item_95772')}</p>
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
                  onClick={(data) => setLocation(`/courier/requests?status=${encodeURIComponent(data.statusKey)}`)}
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} className="focus:outline-none hover:opacity-90" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#142d2d", borderColor: "#334155", borderRadius: "10px", textAlign: "right" }}
                  itemStyle={{ color: "#e2e8f0" }}
                  formatter={(value: any, name: any) => [t('courier.request_6', { var_0: value }), name]}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Label inside Donut */}
            <div className="absolute text-center pointer-events-none">
              <span className="text-[10px] text-slate-400 block font-semibold">{t('courier.total_requests')}</span>
              <span className="text-2xl font-black text-white block mt-0.5">{stats?.totalRequests || 0}</span>
            </div>
          </div>

          {/* Legend Grid */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-700/40">
            {donutData.map((d) => (
              <button
                key={d.name}
                onClick={() => setLocation(`/courier/requests?status=${encodeURIComponent(d.statusKey)}`)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl bg-[#102222]/40 border border-slate-800 hover:border-slate-650 transition-colors text-center cursor-pointer"
              >
                <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: d.color }}></span>
                <span className="text-[10px] text-slate-350 font-bold">{d.name}</span>
                <span className="text-xs font-black text-slate-100">{d.value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bar Chart: Failure Reasons */}
        <div className="bg-[#1a3636] border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-100 font-sans">{t('courier.fail_2')}</h2>
            <p className="text-xs text-slate-400 mt-1">{t('courier.item_97347')}</p>
          </div>

          <div className="h-64 mt-4">
            {barData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                <AlertCircle className="w-8 h-8 text-slate-600" />
                <span className="text-xs">{t('courier.no_fail')}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  onClick={handleChartClick}
                >
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={9}
                    tickLine={false}
                    width={100}
                    axisLine={false}
                    tickFormatter={(val) => val.length > 15 ? `${val.substring(0, 15)}...` : val}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#142d2d", borderColor: "#334155", borderRadius: "10px", textAlign: "right" }}
                    itemStyle={{ color: "#e2e8f0" }}
                    formatter={(value: any) => [t('courier.duplicate_1', { var_0: value }), t('courier.item_15883')]}
                  />
                  <Bar dataKey="count" fill="#ef4444" radius={[0, 6, 6, 0]} cursor="pointer">
                    {barData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index % 2 === 0 ? "#ef4444" : "#f87171"}
                        className="hover:opacity-90"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Simple list info */}
          <div className="mt-4 pt-4 border-t border-slate-700/40 text-xs text-slate-400 flex items-center justify-between">
            <span>{t('courier.total_fail')}</span>
            <span className="text-slate-200 font-bold">
              {t('courier.count_status', { count: Object.values(stats?.failures || {}).reduce((s, v) => s + v, 0) })}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
