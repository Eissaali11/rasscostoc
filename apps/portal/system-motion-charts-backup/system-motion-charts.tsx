import {useTranslation}from "@/lib/language";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  CircleDot,
  GitBranch,
  LineChart as LineChartIcon,
  Shapes,
} from "lucide-react";
import {MotionCard}from "@/components/motion/motion-card";
import {chartAnim}from "@/lib/motion";
import {rassco}from "@/lib/rassco-tokens";

type TrendPeriod = "daily" | "weekly" | "monthly";

type ChartView = "lines" | "bars" | "rings" | "flow";

type TrendPoint = {
  name: string;
  fixed: number;
  moving: number;
  central: number;
};

type CategoryPoint = {
  name: string;
  value: number;
  color: string;
};

type TransferLike = { status: string };
type RequestLike = { status: string };
type TxLike = { type: string; quantity: number };
type WarehouseLike = { id: string; name: string; totalItems: number };
type TechLike = { id: string; name: string; fixed: number; moving: number; total: number };

const tooltipStyle = {
  backgroundColor: "#FFFFFF",
  borderColor: "#18B2B0",
  borderRadius: "12px",
  color: "#2D3135",
  direction: "rtl" as const,
  borderWidth: 1,
};

const trendPeriodOptions: Array<{ value: TrendPeriod; label: string }> = [
  { value: "monthly", label: t('common.item_6390') },
  { value: "weekly", label: t('common.item_9545') },
  { value: "daily", label: t('common.item_6433') },
];

const viewTabs: Array<{ value: ChartView; label: string; icon: typeof LineChartIcon }> = [
  { value: "lines", label: t('common.item_15958'), icon: LineChartIcon },
  { value: "bars", label: t('common.item_7929'), icon: BarChart3 },
  { value: "rings", label: t('common.item_7925_1'), icon: CircleDot },
  { value: "flow", label: t('common.transaction_system'), icon: GitBranch },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ar-SA").format(Math.round(value));
}

function percentage(value: number, max: number): number {
  if (!max || max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

type Props = {
  trendChartData: TrendPoint[];
  trendPeriod: TrendPeriod;
  onTrendPeriodChange: (period: TrendPeriod) => void;
  categoryData: CategoryPoint[];
  totals: { fixed: number; moving: number; central: number; total: number };
  warehouses: WarehouseLike[];
  transfers: TransferLike[];
  requests: RequestLike[];
  recentTransactions?: TxLike[];
  topTechnicians: TechLike[];
  courierCompleted?: number;
  courierNotCompleted?: number;
  courierInProgress?: number;
  todayTransactions?: number;
  pendingActions?: number;
};

export function SystemMotionCharts({
  trendChartData,
  trendPeriod,
  onTrendPeriodChange,
  categoryData,
  totals,
  warehouses,
  transfers,
  requests,
  recentTransactions = [],
  topTechnicians,
  courierCompleted = 0,
  courierNotCompleted = 0,
  courierInProgress = 0,
  todayTransactions = 0,
  pendingActions = 0,
}: Props) {
  const { t } = useTranslation();
  const [chartView, setChartView] = useState<ChartView>("lines");

  const inventoryMix = useMemo(
    () =>
      [
        { name: t('common.item_14327'), value: Math.max(totals.fixed, 0), color: rassco.primary },
        { name: t('common.item_15971'), value: Math.max(totals.moving, 0), color: rassco.warning },
        { name: t('common.item_16008'), value: Math.max(totals.central, 0), color: rassco.gray },
      ].filter((d) => d.value > 0),
    [totals.fixed, totals.moving, totals.central]
  );

  const warehouseBars = useMemo(
    () =>
      [...warehouses]
        .sort((a, b) => b.totalItems - a.totalItems)
        .slice(0, 8)
        .map((wh) => ({
          name: wh.name.length > 14 ? `${wh.name.slice(0, 14)}…` : wh.name,
          value: wh.totalItems,
        })),
    [warehouses]
  );

  const techBars = useMemo(
    () =>
      topTechnicians.slice(0, 8).map((t) => ({
        name: t.name.length > 12 ? `${t.name.slice(0, 12)}…` : t.name,
        fixed: t.fixed,
        moving: t.moving,
      })),
    [topTechnicians]
  );

  const systemFlowStatus = useMemo(() => {
    const reqPending = requests.filter((r) => r.status === "pending").length;
    const reqApproved = requests.filter((r) => r.status === "approved").length;
    const reqRejected = requests.filter((r) => r.status === "rejected").length;
    const trPending = transfers.filter((t) => t.status === "pending").length;
    const trAccepted = transfers.filter((t) => t.status === "accepted" || t.status === "completed").length;
    const trRejected = transfers.filter((t) => t.status === "rejected").length;

    return [
      { name: t('common.requests_1'), value: reqPending, color: rassco.warning },
      { name: t('common.requests_2'), value: reqApproved, color: rassco.primary },
      { name: t('common.requests_3'), value: reqRejected, color: rassco.danger },
      { name: t('common.transfers'), value: trPending, color: "#F4B740" },
      { name: t('common.transfers_1'), value: trAccepted, color: "#149D9B" },
      { name: t('common.transfers_2'), value: trRejected, color: "#E05252" },
    ].filter((d) => d.value > 0);
  }, [requests, transfers]);

  const transactionBars = useMemo(() => {
    const buckets: Record<string, number> = {
      addition: 0,
      {t('common.withdraw_0')}
      transfer: 0,
      {t('common.other_0')}
    };
    recentTransactions.forEach((tx) => {
      const type = (tx.type || "").toUpperCase();
      if (type.includes("INTAKE") || type.includes("ADD")) buckets[t('common.add')] += Math.abs(tx.quantity || 1);
      else if (type.includes("WITHDRAW") || type.includes("REMOVE")) buckets[t('common.withdraw')] += Math.abs(tx.quantity || 1);
      else if (type.includes("TRANSFER")) buckets[t('common.transfer_2')] += Math.abs(tx.quantity || 1);
      else buckets[t('common.other')] += Math.abs(tx.quantity || 1);
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [recentTransactions]);

  const activityPulse = useMemo(() => {
    return trendChartData.map((point, index) => {
      const factor = 0.55 + (index % 4) * 0.12;
      return {
        name: point.name,
        stock: point.fixed + point.moving + point.central,
        operations: Math.max(1, Math.round((todayTransactions || 8) * factor + (pendingActions || 0) * 0.4)),
        {t('common.requests_math_max_0_math_round_requests_length_0')}
        transfers_count: Math.max(0, Math.round(transfers.length * (0.15 + index * 0.07))),
      };
    });
  }, [trendChartData, todayTransactions, pendingActions, requests.length, transfers.length]);

  const courierMix = useMemo(
    () =>
      [
        { name: t('common.completed_4'), value: courierCompleted, color: rassco.primary },
        { name: t('common.completed_5'), value: courierNotCompleted, color: rassco.danger },
        { name: t('common.pending_1'), value: courierInProgress, color: rassco.warning },
      ].filter((d) => d.value > 0),
    [courierCompleted, courierNotCompleted, courierInProgress]
  );

  const comparisonBars = useMemo(
    () =>
      trendChartData.map((p) => ({
        name: p.name,
        fixed: p.fixed,
        moving: p.moving,
        {t('common.p_central')}
      })),
    [trendChartData]
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <MotionCard className="xl:col-span-2 p-6 flex flex-col min-h-[520px]" delay={0}>
        <div className="flex flex-col gap-4 mb-5">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-rassco-text flex items-center gap-2">
                <Activity className="size-5 text-rassco" />{t('common.transaction_data_system')}</h3>
              <p className="text-rassco-muted text-sm mt-1">{t('common.inventory_7')}</p>
            </div>
            <div className="bg-[#F7F8FA] border border-[#18B2B0]/40 rounded-xl p-1 flex items-center gap-1 shrink-0">
              {trendPeriodOptions.map((option) => (
                <button
                  key={option.value}type="button"
                  onClick={() => onTrendPeriodChange(option.value)}
                  className={
                    trendPeriod === option.value
                      ? "px-3 py-1.5 text-sm font-semibold rounded-lg bg-rassco text-white shadow-sm"
                      : "px-3 py-1.5 text-sm rounded-lg text-rassco-muted hover:bg-rassco/10 transition-colors"
                  }
                >
                  {option.label}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {viewTabs.map((tab) => {
              const Icon = tab.icon;
              const active = chartView === tab.value;
              return (
                <button
                  key={tab.value}type="button"
                  onClick={() => setChartView(tab.value)}
                  className={
                    active
                      ? "em-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-rassco text-white shadow-sm"
                      : "em-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/90 border border-[#E3E7EA] text-rassco hover:border-[rgba(24,178,176,0.45)] hover:bg-rassco/10"
                  }
                >
                  <Icon className="size-4" />
                  {tab.label}</button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${chartView}-${trendPeriod}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 min-h-[360px]"
          >
            {chartView === "lines" && (
              <ResponsiveContainer width="100%" height={360}>
                <AreaChart data={trendChartData}margin={{ top: 12, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="smFixed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#18B2B0" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#18B2B0" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="smMoving" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F4B740" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#F4B740" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="smCentral" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5F6368" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#5F6368" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EC" opacity={0.55}/>
                  <XAxis dataKey="name" stroke="#7C838B" fontSize={12}tickLine={false}axisLine={false}/>
                  <YAxis stroke="#7C838B" fontSize={12}tickLine={false}axisLine={false}tickFormatter={formatNumber}/>
                  <Tooltip contentStyle={tooltipStyle}itemStyle={{ color: "#2D3135" }} />
                  <Legend verticalAlign="top" height={36}iconType="circle" />
                  <Area type="monotone" name=t('common.item_14327') dataKey="fixed" stroke="#18B2B0" strokeWidth={3}fill="url(#smFixed)" {...chartAnim}/>
                  <Area type="monotone" name=t('common.item_15971') dataKey="moving" stroke="#F4B740" strokeWidth={3}fill="url(#smMoving)" {...chartAnim}animationBegin={140}/>
                  <Area type="monotone" name=t('common.item_16008') dataKey="central" stroke="#5F6368" strokeWidth={3}fill="url(#smCentral)" {...chartAnim}animationBegin={260}/>
                </AreaChart>
              </ResponsiveContainer>
            )}

            {chartView === "bars" && (
              <div className="grid grid-cols-1 gap-4 h-full">
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={comparisonBars}margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EC" opacity={0.5}/>
                    <XAxis dataKey="name" stroke="#7C838B" fontSize={12}tickLine={false}axisLine={false}/>
                    <YAxis stroke="#7C838B" fontSize={12}tickLine={false}axisLine={false}tickFormatter={formatNumber}/>
                    <Tooltip contentStyle={tooltipStyle}/>
                    <Legend verticalAlign="top" height={32}iconType="circle" />
                    <Bar dataKey=t('common.item_6308') fill="#18B2B0" radius={[8, 8, 0, 0]} {...chartAnim}/>
                    <Bar dataKey=t('common.item_7952') fill="#F4B740" radius={[8, 8, 0, 0]} {...chartAnim}animationBegin={120}/>
                    <Bar dataKey=t('common.item_7989') fill="#5F6368" radius={[8, 8, 0, 0]} {...chartAnim}animationBegin={220}/>
                  </BarChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={warehouseBars.length ? warehouseBars : [{ name: t('common.no_data_4'), value: 0 }]} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EC" opacity={0.4}horizontal={false}/>
                    <XAxis type="number" stroke="#7C838B" fontSize={11}tickFormatter={formatNumber}tickLine={false}axisLine={false}/>
                    <YAxis type="category" dataKey="name" width={90}stroke="#7C838B" fontSize={11}tickLine={false}axisLine={false}/>
                    <Tooltip contentStyle={tooltipStyle}/>
                    <Bar dataKey="value" name=t('common.units_warehouse') fill="#18B2B0" radius={[0, 8, 8, 0]}{t('common.item_1081_1', { count: ...chartAnim })}>
                      {warehouseBars.map((_, i) => (
                        <Cell key={i}fill={i % 2 === 0 ? "#18B2B0" : "#5F6368"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {chartView === "rings" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full items-center">
                {[
                  { title: t('common.inventory_9'), data: inventoryMix },
                  { title: t('common.category_1'), data: categoryData },
                  { title: t('common.status_8'), data: courierMix.length ? courierMix : [{ name: t('common.no_data_4'), value: 1, color: "#DADDE1" }] },
                ].map((ring) => (
                  <div key={ring.title}className="flex flex-col items-center">
                    <p className="text-sm font-bold text-rassco-text mb-1">{ring.title}</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={ring.data}dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}outerRadius={72}paddingAngle={3}{...chartAnim}>
                          {ring.data.map((entry, index) => (
                            <Cell key={`${ring.title}-${index}`} fill={entry.color}/>
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}formatter={(value: number) => [`${formatNumber(Number(value))}`, t('common.value')]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 w-full px-2">
                      {ring.data.slice(0, 3).map((d) => (
                        <div key={d.name}className="flex items-center justify-between text-xs text-rassco-muted">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                            {d.name}</span>
                          <span className="font-semibold text-rassco-text tabular-nums">{formatNumber(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {chartView === "flow" && (
              <div className="grid grid-cols-1 gap-3">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={activityPulse}margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EC" opacity={0.5}/>
                    <XAxis dataKey="name" stroke="#7C838B" fontSize={12}tickLine={false}axisLine={false}/>
                    <YAxis stroke="#7C838B" fontSize={12}tickLine={false}axisLine={false}tickFormatter={formatNumber}/>
                    <Tooltip contentStyle={tooltipStyle}/>
                    <Legend verticalAlign="top" height={32}iconType="circle" />
                    <Line type="monotone" dataKey=t('common.item_7987') stroke="#18B2B0" strokeWidth={3}dot={{ r: 4 }} activeDot={{ r: 6 }} {...chartAnim}/>
                    <Line type="monotone" dataKey=t('common.item_9565_1') stroke="#F4B740" strokeWidth={3}dot={{ r: 4 }} {...chartAnim}animationBegin={120}/>
                    <Line type="monotone" dataKey=t('common.requests_4') stroke="#5F6368" strokeWidth={2.5}strokeDasharray="5 4" dot={false}{...chartAnim}animationBegin={200}/>
                    <Line type="monotone" dataKey=t('common.transfers_3') stroke="#E05252" strokeWidth={2.5}strokeDasharray="2 3" dot={false}{...chartAnim}animationBegin={280}/>
                  </LineChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={transactionBars}margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EC" opacity={0.4}/>
                      <XAxis dataKey="name" stroke="#7C838B" fontSize={11}tickLine={false}axisLine={false}/>
                      <YAxis stroke="#7C838B" fontSize={11}tickLine={false}axisLine={false}/>
                      <Tooltip contentStyle={tooltipStyle}/>
                      <Bar dataKey="value" name=t('common.size_operations') radius={[8, 8, 0, 0]}{t('common.item_1081_1', { count: ...chartAnim })}>
                        {transactionBars.map((entry, i) => (
                          <Cell
                            key={entry.name}fill={[rassco.primary, rassco.danger, rassco.warning, rassco.gray][i % 4]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={systemFlowStatus.length ? systemFlowStatus : [{ name: t('common.no_transaction'), value: 1, color: "#DADDE1" }]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={36}outerRadius={58}paddingAngle={2}{...chartAnim}>
                        {(systemFlowStatus.length ? systemFlowStatus : [{ color: "#DADDE1" }]).map((entry, index) => (
                          <Cell key={index}fill={entry.color}/>
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle}/>
                      <Legend verticalAlign="middle" align="left" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </MotionCard>

      <MotionCard className="p-6 flex flex-col justify-between" delay={0.12}>
        <div>
          <h3 className="text-xl font-bold text-rassco-text flex items-center justify-between">{t('common.system_3')}<Shapes className="h-5 w-5 text-rassco" />
          </h3>
          <p className="text-rassco-muted text-sm mt-1">{t('common.inventory_8')}</p>
        </div>

        <div className="flex-1 flex items-center justify-center min-h-[220px] py-2">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={inventoryMix.length ? inventoryMix : categoryData}
                cx="50%"
                cy="50%"
                innerRadius={62}outerRadius={92}paddingAngle={4}dataKey="value"
                {...chartAnim}>
                {(inventoryMix.length ? inventoryMix : categoryData).map((entry, index) => (
                  <Cell key={`pulse-${index}`} fill={entry.color}/>
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}formatter={(value: number) => [t('common.unit_5', { var_0: formatNumber(Number(value)) }), t('common.quantity_3')]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3 pt-4 border-t border-[#18B2B0]/30">
          {(inventoryMix.length ? inventoryMix : categoryData).map((cat) => (
            <div key={cat.name}className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-rassco-gray">{cat.name}</span>
              </span>
              <span className="font-bold text-rassco-text tabular-nums">
                {percentage(cat.value, Math.max(totals.total, 1)).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        {techBars.length > 0 && (
          <div className="mt-5 pt-4 border-t border-[#18B2B0]/30">
            <p className="text-sm font-bold text-rassco-text mb-3">{t('common.technicians')}</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={techBars}margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip contentStyle={tooltipStyle}/>
                <Bar dataKey=t('common.item_6308') stackId="a" fill="#18B2B0" radius={[0, 0, 0, 0]} {...chartAnim}/>
                <Bar dataKey=t('common.item_7952') stackId="a" fill="#F4B740" radius={[6, 6, 0, 0]} {...chartAnim}animationBegin={100}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </MotionCard>
    </div>
  );
}
