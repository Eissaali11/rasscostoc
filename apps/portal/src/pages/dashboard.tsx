import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Bell,
  Boxes,
  Settings,
  UserCircle2,
  Warehouse,
  Shapes,
} from "lucide-react";

type TechnicianWithBothInventories = {
  technicianId: string;
  technicianName: string;
  city: string;
  fixedInventory: unknown;
  movingInventory: unknown;
};

type WarehouseWithStats = {
  id: string;
  name: string;
  location?: string | null;
  totalItems?: number;
};

type TechnicianInventory = Record<string, unknown> & {
  entries?: Array<{ boxes?: number; units?: number }>;
};

function sumInventoryValue(inventory: unknown): number {
  if (!inventory || typeof inventory !== "object") return 0;

  const typed = inventory as TechnicianInventory;
  if (Array.isArray(typed.entries) && typed.entries.length > 0) {
    return typed.entries.reduce(
      (sum, entry) => sum + Number(entry.boxes || 0) + Number(entry.units || 0),
      0,
    );
  }

  return Object.entries(typed)
    .filter(([key, value]) =>
      (key.endsWith("Boxes") || key.endsWith("Units")) && typeof value === "number",
    )
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);
}

function percentage(value: number, max: number): number {
  if (!max || max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

function statusText(percent: number): string {
  if (percent >= 80) return "ممتاز";
  if (percent >= 40) return "متوسط";
  return "منخفض";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ar-SA").format(Math.round(value));
}

type TrendPeriod = "daily" | "weekly" | "monthly";

const trendPeriodOptions: Array<{ value: TrendPeriod; label: string }> = [
  { value: "monthly", label: "شهري" },
  { value: "weekly", label: "أسبوعي" },
  { value: "daily", label: "يومي" },
];

function getTrendWindowLabel(period: TrendPeriod): string {
  if (period === "daily") return "آخر 6 أيام";
  if (period === "weekly") return "آخر 6 أسابيع";
  return "آخر 6 أشهر";
}

function getTrendFactors(period: TrendPeriod): number[] {
  if (period === "daily") return [0.56, 0.72, 0.63, 0.81, 0.68, 0.86];
  if (period === "weekly") return [0.69, 0.8, 0.61, 0.75, 0.88, 0.79];
  return [0.72, 0.89, 0.66, 0.76, 0.92, 0.84];
}

function getTrendLabels(period: TrendPeriod): string[] {
  const now = new Date();

  if (period === "daily") {
    return Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (5 - index));
      return d.toLocaleDateString("ar-SA", { day: "2-digit", month: "numeric" });
    });
  }

  if (period === "weekly") {
    return Array.from({ length: 6 }, (_, index) => `أسبوع ${index + 1}`);
  }

  return Array.from({ length: 6 }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return d.toLocaleDateString("ar-SA", { month: "long" });
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("monthly");
  const [hoveredTrendId, setHoveredTrendId] = useState<number | null>(null);

  const canSeeGlobalData = user?.role === "admin" || user?.role === "supervisor";

  const { data: techniciansData } = useQuery<{ technicians: TechnicianWithBothInventories[] }>({
    queryKey: user?.role === "admin" ? ["/api/admin/all-technicians-inventory"] : ["/api/supervisor/technicians-inventory"],
    enabled: !!user?.id && canSeeGlobalData,
  });

  const { data: warehousesData = [] } = useQuery<WarehouseWithStats[]>({
    queryKey: user?.role === "admin" ? ["/api/warehouses"] : ["/api/supervisor/warehouses"],
    enabled: !!user?.id && canSeeGlobalData,
  });

  const { data: myFixedInventory } = useQuery<unknown>({
    queryKey: ["/api/my-fixed-inventory"],
    enabled: !!user?.id,
  });

  const { data: myMovingInventory } = useQuery<unknown>({
    queryKey: ["/api/my-moving-inventory"],
    enabled: !!user?.id,
  });

  const totals = useMemo(() => {
    if (canSeeGlobalData) {
      const fixed = (techniciansData?.technicians || []).reduce(
        (sum, tech) => sum + sumInventoryValue(tech.fixedInventory),
        0,
      );
      const moving = (techniciansData?.technicians || []).reduce(
        (sum, tech) => sum + sumInventoryValue(tech.movingInventory),
        0,
      );
      const central = warehousesData.reduce((sum, wh) => sum + Number(wh.totalItems || 0), 0);
      return {
        fixed,
        moving,
        central,
        total: fixed + moving + central,
      };
    }

    const fixed = sumInventoryValue(myFixedInventory);
    const moving = sumInventoryValue(myMovingInventory);
    return {
      fixed,
      moving,
      central: 0,
      total: fixed + moving,
    };
  }, [canSeeGlobalData, techniciansData?.technicians, warehousesData, myFixedInventory, myMovingInventory]);

  const topTechnicians = useMemo(() => {
    if (!canSeeGlobalData) {
      const meTotal = totals.fixed + totals.moving;
      return [
        {
          id: user?.id || "me",
          name: user?.fullName || "المستخدم الحالي",
          total: meTotal,
        },
      ];
    }

    const list = (techniciansData?.technicians || []).map((tech) => ({
      id: tech.technicianId,
      name: tech.technicianName,
      total: sumInventoryValue(tech.fixedInventory) + sumInventoryValue(tech.movingInventory),
    }));

    return list.sort((a, b) => b.total - a.total).slice(0, 3);
  }, [canSeeGlobalData, techniciansData?.technicians, totals.fixed, totals.moving, user?.fullName, user?.id]);

  const topWarehouses = useMemo(() => {
    if (!canSeeGlobalData) return [];
    return [...warehousesData]
      .sort((a, b) => Number(b.totalItems || 0) - Number(a.totalItems || 0))
      .slice(0, 3);
  }, [canSeeGlobalData, warehousesData]);

  const maxTech = useMemo(
    () => Math.max(...topTechnicians.map((tech) => tech.total), 1),
    [topTechnicians],
  );

  const maxWarehouse = useMemo(
    () => Math.max(...topWarehouses.map((warehouse) => Number(warehouse.totalItems || 0)), 1),
    [topWarehouses],
  );

  const trendBars = useMemo(() => {
    const factors = getTrendFactors(trendPeriod);
    const labels = getTrendLabels(trendPeriod);
    const fixedBase = Math.max(totals.fixed, 1);
    const movingBase = Math.max(totals.moving, 1);
    const centralBase = Math.max(totals.central || totals.total * 0.25, 1);

    return factors.map((factor, index) => {
      const bucket = index % 3;

      if (bucket === 0) {
        return { id: index + 1, value: fixedBase * factor, color: "#22d3ee", label: labels[index], kind: "ثابت" as const };
      }

      if (bucket === 1) {
        return { id: index + 1, value: movingBase * factor, color: "#fb923c", label: labels[index], kind: "متحرك" as const };
      }

      return { id: index + 1, value: centralBase * factor, color: "#c084fc", label: labels[index], kind: "مركزي" as const };
    });
  }, [trendPeriod, totals.fixed, totals.moving, totals.central, totals.total]);

  const maxTrend = Math.max(...trendBars.map((bar) => bar.value), 1);

  const activeTrendBar = useMemo(() => {
    if (!trendBars.length) return null;

    if (hoveredTrendId !== null) {
      const hovered = trendBars.find((bar) => bar.id === hoveredTrendId);
      if (hovered) return hovered;
    }

    return trendBars[trendBars.length - 1];
  }, [trendBars, hoveredTrendId]);

  const trendScale = useMemo(() => {
    const maxValue = Math.max(...trendBars.map((bar) => bar.value), 0);
    const midValue = maxValue / 2;
    return { maxValue, midValue };
  }, [trendBars]);

  return (
    <div dir="rtl" className="space-y-6 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">لوحة التحكم</h2>
          <p className="text-slate-400 mt-1">مرحباً بك، {user?.fullName || "المستخدم"}</p>
        </div>
        <Link
          href="/notifications"
          className="relative p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-300"
          aria-label="الإشعارات"
          title="الإشعارات"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 size-2.5 bg-red-500 rounded-full border-2 border-[#143030]" />
        </Link>
      </div>

      <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-cyan-400/5 border border-cyan-300/20 p-6 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-10 -top-10 size-40 bg-cyan-300/20 blur-3xl rounded-full" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">إجمالي المخزون</span>
                  <span className="bg-cyan-300/10 text-cyan-300 p-2 rounded-lg">
                    <Boxes className="h-5 w-5" />
                  </span>
                </div>
                <div>
                  <div className="text-4xl font-bold tracking-tight">{formatNumber(totals.total)}</div>
                  <div className="mt-2 text-sm text-emerald-400 font-medium">القراءة الحالية للنظام</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: "مخزون المندوبين الثابت", value: totals.fixed, color: "cyan" },
                { title: "مخزون المندوبين المتحرك", value: totals.moving, color: "orange" },
                { title: "مخزون المستودعات المركزي", value: totals.central, color: "purple" },
              ].map((card) => {
                const colorClass =
                  card.color === "cyan"
                    ? "bg-cyan-400 text-cyan-400"
                    : card.color === "orange"
                      ? "bg-orange-400 text-orange-400"
                      : "bg-purple-400 text-purple-400";

                const width = percentage(card.value, Math.max(totals.total, 1));

                return (
                  <div key={card.title} className="rounded-2xl bg-slate-900/40 border border-slate-700 p-6 flex flex-col justify-between relative overflow-hidden shadow-sm">
                    <div className={`absolute top-0 right-0 w-full h-1 ${colorClass.split(" ")[0]} opacity-80`} />
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-slate-400">{card.title}</span>
                      <Settings className={`h-4 w-4 ${colorClass.split(" ")[1]}`} />
                    </div>
                    <div className="text-3xl font-bold text-white">{formatNumber(card.value)}</div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className={`${colorClass.split(" ")[0]} h-full rounded-full`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl bg-slate-900/40 border border-slate-700 p-6 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">اتجاهات المخزون ({getTrendWindowLabel(trendPeriod)})</h3>
                <div className="text-left">
                  <div className="bg-slate-950 border border-slate-700 rounded-lg p-1 flex items-center gap-1">
                    {trendPeriodOptions.map((option) => (
                      <button
                        key={option.value}
                        className={
                          trendPeriod === option.value
                            ? "px-3 py-1.5 text-sm rounded-md bg-cyan-400/20 text-cyan-300 border border-cyan-300/30"
                            : "px-3 py-1.5 text-sm rounded-md text-slate-300 hover:bg-slate-800 transition-colors"
                        }
                        onClick={() => setTrendPeriod(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-cyan-300 mt-2">
                    {activeTrendBar
                      ? `المؤشر: ${activeTrendBar.label} • ${formatNumber(activeTrendBar.value)} (${activeTrendBar.kind})`
                      : "المؤشر: -"}
                  </p>
                </div>
              </div>

              <div className="flex-1 min-h-[250px] px-2">
                <div className="h-[210px] grid grid-cols-[52px_1fr] gap-2">
                  <div className="flex flex-col justify-between pb-2 text-[11px] text-slate-500">
                    <span>{formatNumber(trendScale.maxValue)}</span>
                    <span>{formatNumber(trendScale.midValue)}</span>
                    <span>0</span>
                  </div>

                  <div className="h-full flex items-end justify-between gap-4 pb-2 border-b border-l border-slate-700">
                    {trendBars.map((bar) => {
                      const heightPx = bar.value <= 0 ? 12 : Math.max(22, Math.round((bar.value / maxTrend) * 170));
                      const isHovered = hoveredTrendId === bar.id;
                      return (
                        <div
                          key={bar.id}
                          className="w-full max-w-[54px] flex flex-col items-center justify-end gap-2"
                          onMouseEnter={() => setHoveredTrendId(bar.id)}
                          onMouseLeave={() => setHoveredTrendId(null)}
                        >
                          <div className="relative w-full flex flex-col items-center">
                            {isHovered && (
                              <div className="absolute -top-8 text-[11px] px-2 py-1 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 whitespace-nowrap">
                                {formatNumber(bar.value)}
                              </div>
                            )}
                            <div
                              className="w-full rounded-t-sm transition-all"
                              style={{
                                height: `${heightPx}px`,
                                backgroundColor: bar.color,
                                boxShadow: isHovered ? `0 0 14px ${bar.color}66` : "none",
                              }}
                            />
                          </div>
                          <span className={`text-[11px] ${isHovered ? "text-slate-200" : "text-slate-500"}`}>{bar.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-6 mt-4 text-sm text-slate-300">
                <div className="flex items-center gap-2"><span className="size-3 rounded-full bg-cyan-400" /> ثابت</div>
                <div className="flex items-center gap-2"><span className="size-3 rounded-full bg-orange-400" /> متحرك</div>
                <div className="flex items-center gap-2"><span className="size-3 rounded-full bg-purple-400" /> مركزي</div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/40 border border-slate-700 p-6 flex flex-col">
              <h3 className="text-lg font-semibold mb-6 flex items-center justify-between">
                تفصيل الملصقات
                <Shapes className="h-4 w-4 text-slate-400" />
              </h3>

              <div className="flex-1 flex flex-col items-center justify-center relative my-4">
                <div
                  className="relative size-40 rounded-full"
                  style={{
                    background: "conic-gradient(#22d3ee 0% 45%, #fb923c 45% 75%, #c084fc 75% 100%)",
                  }}
                >
                  <div className="absolute inset-2 bg-[#102222] rounded-full flex items-center justify-center flex-col">
                    <span className="text-2xl font-bold">{formatNumber(Math.max(totals.total * 0.1, 12000))}</span>
                    <span className="text-xs text-slate-400">إجمالي</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-cyan-400" /> N950 (أجهزة)</span><span className="font-medium">45%</span></div>
                <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-orange-400" /> STC (راوترات)</span><span className="font-medium">30%</span></div>
                <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-purple-400" /> أخرى (كابلات، ألواح)</span><span className="font-medium">25%</span></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
            <div className="rounded-2xl bg-slate-900/40 border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">نظرة سريعة: المندوبين</h3>
                <Link className="text-sm text-cyan-300 hover:underline" href={canSeeGlobalData ? "/admin-inventory-overview" : "/my-moving-inventory"}>عرض الكل</Link>
              </div>

              <div className="space-y-5">
                {topTechnicians.map((technician) => {
                  const width = percentage(technician.total, maxTech);
                  return (
                    <div key={technician.id} className="flex items-center gap-4">
                      <div className="size-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-200">
                        <UserCircle2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-end mb-1">
                          <span className="font-medium text-sm truncate">{technician.name}</span>
                          <span className="text-xs font-semibold text-cyan-300">{formatNumber(technician.total)} قطعة</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400">{statusText(width)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/40 border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">نظرة سريعة: المستودعات</h3>
                <Link className="text-sm text-cyan-300 hover:underline" href="/warehouses">عرض الكل</Link>
              </div>

              <div className="space-y-4">
                {(topWarehouses.length > 0 ? topWarehouses : [{ id: "placeholder", name: "لا توجد بيانات مستودعات", totalItems: 0 }]).map((warehouse, index) => {
                  const current = Number(warehouse.totalItems || 0);
                  const width = percentage(current, maxWarehouse);
                  return (
                    <div key={warehouse.id} className="p-3 rounded-xl bg-slate-800/70 border border-slate-700 flex items-center justify-between hover:border-cyan-400/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-lg bg-cyan-400/10 text-cyan-300 flex items-center justify-center">
                          <Warehouse className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{warehouse.name}</div>
                          <div className="text-xs text-slate-400 truncate">{warehouse.location || "موقع غير محدد"}</div>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="font-bold text-white">{formatNumber(current)}</div>
                        <div className="text-[10px] text-cyan-300">{index === 0 ? "الأعلى" : "نشط"}</div>
                      </div>
                      {warehouse.id !== "placeholder" && (
                        <div className="absolute inset-x-3 bottom-1 h-0.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-400" style={{ width: `${width}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

      </div>
    </div>
  );
}
