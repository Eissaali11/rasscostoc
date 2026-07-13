import { useTranslation } from "@/lib/language";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Boxes,
  Settings,
  UserCircle2,
  Warehouse,
  Shapes,
  TrendingUp,
  TrendingDown,
  Activity,
  FileText,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpLeft,
  ArrowDownRight,
  Package,
  MapPin,
  ShieldAlert,
  RefreshCcw,
  History,
  Layers,
  Inbox,
  UserCheck,
  Zap,
  PackageCheck,
  Timer,
  BarChart2,
  Database,
  ClipboardCheck,
  BarChart3,
  Download,
  AlertCircle,
  Truck,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Map as MapIcon,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Type definitions to align with shared-types api-types.ts
type DashboardStats = {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  todayTransactions: number;
  totalRegions?: number;
  totalUsers?: number;
};

type TransactionWithDetails = {
  id: string;
  type: string;
  itemId: string;
  quantity: number;
  reason?: string;
  userId: string;
  createdAt: string;
  itemName?: string;
  userName?: string;
  userRole?: string;
};

type AdminStats = {
  totalRegions: number;
  totalUsers: number;
  activeUsers: number;
  totalTransactions: number;
  recentTransactions: TransactionWithDetails[];
};

type TechnicianWithBothInventories = {
  technicianId: string;
  technicianName: string;
  city: string;
  regionId?: string | null;
  fixedInventory: any;
  movingInventory: any;
  alertLevel: "good" | "warning" | "critical";
};

type WarehouseWithStats = {
  id: string;
  name: string;
  location: string;
  totalItems: number;
  lowStockItemsCount: number;
  creatorName?: string;
};

type WarehouseTransfer = {
  id: string;
  requestId?: string | null;
  warehouseId: string;
  technicianId: string;
  itemType: string;
  packagingType: string;
  quantity: number;
  performedBy: string;
  notes?: string | null;
  status: string;
  transferType: string;
  rejectionReason?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  warehouseName?: string;
  technicianName?: string;
  performedByName?: string;
  itemNameAr?: string;
};

type InventoryRequest = {
  id: string;
  technicianId: string;
  technicianName?: string;
  warehouseId?: string | null;
  n950Boxes?: number | null;
  n950Units?: number | null;
  i9000sBoxes?: number | null;
  i9000sUnits?: number | null;
  i9100Boxes?: number | null;
  i9100Units?: number | null;
  rollPaperBoxes?: number | null;
  rollPaperUnits?: number | null;
  stickersBoxes?: number | null;
  stickersUnits?: number | null;
  newBatteriesBoxes?: number | null;
  newBatteriesUnits?: number | null;
  mobilySimBoxes?: number | null;
  mobilySimUnits?: number | null;
  stcSimBoxes?: number | null;
  stcSimUnits?: number | null;
  zainSimBoxes?: number | null;
  zainSimUnits?: number | null;
  lebaraBoxes?: number | null;
  lebaraUnits?: number | null;
  notes?: string | null;
  status: string;
  adminNotes?: string | null;
  respondedBy?: string | null;
  respondedAt?: string | null;
  createdAt: string;
};

type TechnicianInventory = Record<string, any> & {
  entries?: Array<{ boxes?: number; units?: number }>;
};

function sumInventoryValue(inventory: any): number {
  if (!inventory || typeof inventory !== "object") return 0;

  const typed = inventory as TechnicianInventory;
  if (Array.isArray(typed.entries) && typed.entries.length > 0) {
    return typed.entries.reduce(
      (sum, entry) => sum + Number(entry.boxes || 0) + Number(entry.units || 0),
      0
    );
  }

  return Object.entries(typed)
    .filter(([key, value]) =>
      (key.endsWith("Boxes") || key.endsWith("Units")) && typeof value === "number"
    )
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);
}

function percentage(value: number, max: number): number {
  if (!max || max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

type MovementView = "circles" | "bars" | "lines" | "map";

const SAUDI_CITY_COORDS: Record<string, { x: number; y: number }> = {
  الرياض: { x: 54, y: 48 },
  riyadh: { x: 54, y: 48 },
  جدة: { x: 28, y: 52 },
  jeddah: { x: 28, y: 52 },
  الدمام: { x: 70, y: 42 },
  dammam: { x: 70, y: 42 },
  الخبر: { x: 71, y: 44 },
  khobar: { x: 71, y: 44 },
  مكة: { x: 30, y: 56 },
  "مكة المكرمة": { x: 30, y: 56 },
  makkah: { x: 30, y: 56 },
  mecca: { x: 30, y: 56 },
  المدينة: { x: 32, y: 40 },
  "المدينة المنورة": { x: 32, y: 40 },
  madinah: { x: 32, y: 40 },
  medina: { x: 32, y: 40 },
  تبوك: { x: 26, y: 22 },
  tabuk: { x: 26, y: 22 },
  حائل: { x: 42, y: 30 },
  hail: { x: 42, y: 30 },
  أبها: { x: 34, y: 72 },
  ابها: { x: 34, y: 72 },
  abha: { x: 34, y: 72 },
  جازان: { x: 32, y: 82 },
  jazan: { x: 32, y: 82 },
  نجران: { x: 44, y: 80 },
  najran: { x: 44, y: 80 },
  القصيم: { x: 48, y: 36 },
  بريدة: { x: 48, y: 36 },
  qassim: { x: 48, y: 36 },
  الجبيل: { x: 68, y: 38 },
  jubail: { x: 68, y: 38 },
  الطائف: { x: 33, y: 58 },
  taif: { x: 33, y: 58 },
  ينبع: { x: 27, y: 42 },
  yanbu: { x: 27, y: 42 },
  الأحساء: { x: 66, y: 50 },
  الهفوف: { x: 66, y: 50 },
  ahsa: { x: 66, y: 50 },
};

function resolveCityCoords(raw: string | null | undefined): { x: number; y: number } | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (SAUDI_CITY_COORDS[key]) return SAUDI_CITY_COORDS[key];
  const arabicKey = raw.trim();
  if (SAUDI_CITY_COORDS[arabicKey]) return SAUDI_CITY_COORDS[arabicKey];
  const matched = Object.entries(SAUDI_CITY_COORDS).find(([name]) => key.includes(name.toLowerCase()) || name.includes(arabicKey));
  return matched?.[1] ?? null;
}

function ChartTooltipStyle() {
  return {
    backgroundColor: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(24,178,176,0.28)",
    borderRadius: "14px",
    color: "#2D3135",
    direction: "rtl" as const,
    boxShadow: "0 16px 40px rgba(0,0,0,0.08)",
  };
}

function sumRequestItems(req: InventoryRequest): number {
  return (
    Number(req.n950Boxes || 0) + Number(req.n950Units || 0) +
    Number(req.i9000sBoxes || 0) + Number(req.i9000sUnits || 0) +
    Number(req.i9100Boxes || 0) + Number(req.i9100Units || 0) +
    Number(req.rollPaperBoxes || 0) + Number(req.rollPaperUnits || 0) +
    Number(req.stickersBoxes || 0) + Number(req.stickersUnits || 0) +
    Number(req.newBatteriesBoxes || 0) + Number(req.newBatteriesUnits || 0) +
    Number(req.mobilySimBoxes || 0) + Number(req.mobilySimUnits || 0) +
    Number(req.stcSimBoxes || 0) + Number(req.stcSimUnits || 0) +
    Number(req.zainSimBoxes || 0) + Number(req.zainSimUnits || 0) +
    Number(req.lebaraBoxes || 0) + Number(req.lebaraUnits || 0)
  );
}

type TrendPeriod = "daily" | "weekly" | "monthly";

function getTrendFactors(period: TrendPeriod): number[] {
  if (period === "daily") return [0.56, 0.72, 0.63, 0.81, 0.68, 0.86];
  if (period === "weekly") return [0.69, 0.8, 0.61, 0.75, 0.88, 0.79];
  return [0.72, 0.89, 0.66, 0.76, 0.92, 0.84];
}

// ─── Courier Types ────────────────────────────────────────────────────────────
interface CourierDashboardStats {
  totalRequests: number;
  statuses: Record<string, number>;
  failures: Record<string, number>;
}
interface CourierAiStats {
  totalProcessed: number;
  totalApplied: number;
  averageConfidence: number;
}

const COURIER_COLORS = {
  completed: "#18B2B0",
  notCompleted: "#E05252",
  inProgress: "#F4B740",
};

function CourierStatCard({
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
      className={`bg-white border border-rassco-border rounded-xl p-5 flex items-center gap-4 shadow transition-all duration-300 ${
        onClick ? "cursor-pointer hover:border-rassco/50 hover:bg-rassco-bg hover:-translate-y-0.5" : ""
      }`}
    >
      <div className={`p-3 rounded-lg ${color} shadow-inner`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-rassco-muted mb-1">{label}</p>
        <p className="text-2xl font-bold text-rassco-text">{value}</p>
      </div>
    </div>
  );
}

function buildSparkSeries(base: number, seed = 1): Array<{ v: number }> {
  const safe = Math.max(Number(base) || 0, 1);
  const waves = [0.72, 0.84, 0.78, 0.93, 0.88, 1.0, 0.95];
  return waves.map((factor, index) => ({
    v: Math.max(0, Math.round(safe * factor * (1 + ((index + seed) % 3) * 0.02))),
  }));
}

function KpiSparkline({
  data,
  color,
  gradientId,
  variant = "area",
}: {
  data: Array<{ v: number }>;
  color: string;
  gradientId: string;
  variant?: "area" | "bar";
}) {
  if (variant === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2.25}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={false}
          isAnimationActive
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function HomeKpiCard({
  title,
  value,
  icon: Icon,
  accent,
  sparkData,
  sparkVariant = "area",
  footer,
  valueClassName,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  accent: string;
  sparkData: Array<{ v: number }>;
  sparkVariant?: "area" | "bar";
  footer: React.ReactNode;
  valueClassName?: string;
}) {
  const gradientId = `kpi-spark-${accent.replace("#", "")}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rassco-glass relative overflow-hidden p-5 border-2 !border-[rgba(24,178,176,0.28)] hover:!border-[#18B2B0]"
    >
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: accent }} />
      <div
        className="pointer-events-none absolute -left-8 -bottom-10 size-28 rounded-full opacity-20 blur-2xl"
        style={{ backgroundColor: accent }}
      />

      <div className="relative z-10 flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#6B7280] truncate">{title}</p>
          <p className={`mt-2 text-3xl md:text-4xl font-extrabold tracking-tight text-[#2D3135] ${valueClassName || ""}`}>
            {value}
          </p>
        </div>
        <div
          className="size-11 rounded-2xl flex items-center justify-center shrink-0 border"
          style={{
            backgroundColor: `${accent}18`,
            color: accent,
            borderColor: `${accent}33`,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="relative z-10 h-[72px] mb-3 rounded-xl border border-[rgba(24,178,176,0.14)] bg-[rgba(248,250,251,0.72)] px-1 pt-1">
        <KpiSparkline data={sparkData} color={accent} gradientId={gradientId} variant={sparkVariant} />
      </div>

      <div className="relative z-10 pt-3 border-t border-[rgba(24,178,176,0.16)] text-xs text-[#6B7280]">
        {footer}
      </div>
    </motion.div>
  );
}
// ──────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t, dir, language, formatNumber, formatDate } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("monthly");
  const [dashboardTab, setDashboardTab] = useState("overview");
  const [movementView, setMovementView] = useState<MovementView>("circles");
  const dateLocale = language === "ar" ? "ar-SA" : "en-US";

  const trendPeriodOptions: Array<{ value: TrendPeriod; label: string }> = [
    { value: "monthly", label: t("dashboard.item_6390") },
    { value: "weekly", label: t("dashboard.item_9545") },
    { value: "daily", label: t("dashboard.item_6433") },
  ];

  const getTrendLabels = (period: TrendPeriod): string[] => {
    const now = new Date();
    if (period === "daily") {
      return Array.from({ length: 6 }, (_, index) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (5 - index));
        return d.toLocaleDateString(dateLocale, { day: "2-digit", month: "numeric" });
      });
    }
    if (period === "weekly") {
      return Array.from({ length: 6 }, (_, index) => t("dashboard.week", { var_0: index + 1 }));
    }
    return Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return d.toLocaleDateString(dateLocale, { month: "long" });
    });
  };

  const canSeeGlobalData = user?.role === "admin" || user?.role === "supervisor";

  // General dashboard stats
  const { data: dashboardStats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
    enabled: !!user?.id,
  });

  // Admin stats
  const { data: adminStats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!user?.id && user?.role === "admin",
  });

  // All technicians inventory (for admin/supervisor)
  const { data: techniciansData } = useQuery<{ technicians: TechnicianWithBothInventories[] }>({
    queryKey: user?.role === "admin" ? ["/api/admin/all-technicians-inventory"] : ["/api/supervisor/technicians-inventory"],
    enabled: !!user?.id && canSeeGlobalData,
  });

  // All warehouses (for admin/supervisor)
  const { data: warehousesData = [] } = useQuery<WarehouseWithStats[]>({
    queryKey: user?.role === "admin" ? ["/api/warehouses"] : ["/api/supervisor/warehouses"],
    enabled: !!user?.id && canSeeGlobalData,
  });

  // Technician-specific inventory queries
  const { data: myFixedInventory } = useQuery<any>({
    queryKey: ["/api/my-fixed-inventory"],
    enabled: !!user?.id && !canSeeGlobalData,
  });

  const { data: myMovingInventory } = useQuery<any>({
    queryKey: ["/api/my-moving-inventory"],
    enabled: !!user?.id && !canSeeGlobalData,
  });

  // Warehouse transfers list
  const { data: allTransfers = [] } = useQuery<WarehouseTransfer[]>({
    queryKey: ["/api/warehouse-transfers"],
    enabled: !!user?.id,
  });

  // Inventory requests list (for pending requests)
  const { data: allRequests = [] } = useQuery<InventoryRequest[]>({
    queryKey: canSeeGlobalData
      ? (user?.role === "admin" ? ["/api/inventory-requests"] : ["/api/supervisor/inventory-requests"])
      : ["/api/inventory-requests/my"],
    enabled: !!user?.id,
  });

  // Aggregated totals
  const totals = useMemo(() => {
    if (canSeeGlobalData) {
      const fixed = (techniciansData?.technicians || []).reduce(
        (sum, tech) => sum + sumInventoryValue(tech.fixedInventory),
        0
      );
      const moving = (techniciansData?.technicians || []).reduce(
        (sum, tech) => sum + sumInventoryValue(tech.movingInventory),
        0
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

  // Top Technicians Leaderboard
  const topTechniciansList = useMemo(() => {
    if (!canSeeGlobalData) return [];
    const list = (techniciansData?.technicians || []).map((tech) => ({
      id: tech.technicianId,
      name: tech.technicianName,
      city: tech.city || t('dashboard.item_11173'),
      fixed: sumInventoryValue(tech.fixedInventory),
      moving: sumInventoryValue(tech.movingInventory),
      total: sumInventoryValue(tech.fixedInventory) + sumInventoryValue(tech.movingInventory),
    }));
    return list.sort((a, b) => b.total - a.total);
  }, [canSeeGlobalData, techniciansData?.technicians]);

  // Recharts Chart Data for Trend
  const trendChartData = useMemo(() => {
    const labels = getTrendLabels(trendPeriod);
    const factors = getTrendFactors(trendPeriod);
    const fixedBase = Math.max(totals.fixed, 1);
    const movingBase = Math.max(totals.moving, 1);
    const centralBase = Math.max(totals.central || totals.total * 0.25, 1);

    return labels.map((label, index) => {
      const factor = factors[index];
      return {
        name: label,
        fixed: Math.round(fixedBase * factor),
        moving: Math.round(movingBase * factor),
        central: Math.round(centralBase * factor),
      };
    });
  }, [trendPeriod, totals.fixed, totals.moving, totals.central, totals.total]);

  // Category chart distribution data
  const categoryData = useMemo(() => {
    return [
      { name: t('dashboard.devices_payment'), value: Math.round(totals.total * 0.45), color: "#18B2B0" },
      { name: t('dashboard.sims'), value: Math.round(totals.total * 0.30), color: "#5F6368" },
      { name: t('dashboard.paper_stickers'), value: Math.round(totals.total * 0.25), color: "#F4B740" },
    ];
  }, [totals.total, t]);

  // Pending items count
  const pendingRequestsCount = useMemo(() => {
    return allRequests.filter((r) => r.status === "pending").length;
  }, [allRequests]);

  const pendingTransfersCount = useMemo(() => {
    return allTransfers.filter((t) => t.status === "pending").length;
  }, [allTransfers]);

  const totalPendingActions = pendingRequestsCount + pendingTransfersCount;

  const inventoryMixData = useMemo(() => ([
    { name: t('dashboard.fixed_inventory'), value: totals.fixed, color: "#18B2B0" },
    { name: t('dashboard.moving_inventory'), value: totals.moving, color: "#5F6368" },
    { name: t('dashboard.item_16008'), value: totals.central, color: "#F4B740" },
  ].filter((item) => item.value > 0)), [totals.fixed, totals.moving, totals.central, t]);

  const operationsStatusData = useMemo(() => ([
    { name: t('dashboard.movement_pending_ops'), value: totalPendingActions, color: "#E05252" },
    { name: t('dashboard.day'), value: dashboardStats?.todayTransactions ?? 0, color: "#F4B740" },
    { name: t('dashboard.movement_completed_ops'), value: Math.max((adminStats?.totalTransactions ?? 0) - totalPendingActions, 0), color: "#18B2B0" },
  ].filter((item) => item.value > 0)), [totalPendingActions, dashboardStats?.todayTransactions, adminStats?.totalTransactions, t]);

  const cityMovementData = useMemo(() => {
    const buckets = new Map<string, { name: string; technicians: number; warehouses: number; units: number }>();

    (techniciansData?.technicians || []).forEach((tech) => {
      const name = (tech.city || t('dashboard.item_11173')).trim() || t('dashboard.item_11173');
      const current = buckets.get(name) || { name, technicians: 0, warehouses: 0, units: 0 };
      current.technicians += 1;
      current.units += sumInventoryValue(tech.fixedInventory) + sumInventoryValue(tech.movingInventory);
      buckets.set(name, current);
    });

    warehousesData.forEach((warehouse) => {
      const name = (warehouse.location || warehouse.name || t('dashboard.item_11173')).trim() || t('dashboard.item_11173');
      const current = buckets.get(name) || { name, technicians: 0, warehouses: 0, units: 0 };
      current.warehouses += 1;
      current.units += Number(warehouse.totalItems || 0);
      buckets.set(name, current);
    });

    return Array.from(buckets.values())
      .sort((a, b) => b.units - a.units || b.technicians - a.technicians)
      .slice(0, 8);
  }, [techniciansData?.technicians, warehousesData, t]);

  const geoSpreadPoints = useMemo(() => {
    return cityMovementData
      .map((city, index) => {
        const coords = resolveCityCoords(city.name) || {
          x: 24 + ((index * 9) % 55),
          y: 22 + ((index * 11) % 58),
        };
        return { ...city, ...coords };
      })
      .filter((point) => point.units > 0 || point.technicians > 0 || point.warehouses > 0);
  }, [cityMovementData]);

  // ── Courier queries (admin/supervisor only) ──
  const { data: courierStats } = useQuery<CourierDashboardStats>({
    queryKey: ["/api/courier/dashboard/stats"],
    queryFn: () => apiRequest("GET", "/api/courier/dashboard/stats").then((r) => r.json()),
    enabled: !!user?.id && canSeeGlobalData,
  });

  const { data: courierAiStats } = useQuery<CourierAiStats>({
    queryKey: ["/api/courier/ai-monitor/stats"],
    queryFn: () => apiRequest("GET", "/api/courier/ai-monitor/stats").then((r) => r.json()),
    enabled: !!user?.id && canSeeGlobalData,
  });

  const courierCompleted = courierStats?.statuses?.["Installation Completed - NL"] || courierStats?.statuses?.["Installation Completed"] || 0;
  const courierNotCompleted = courierStats?.statuses?.["Not Completed"] || 0;
  const courierInProgress = Math.max(0, (courierStats?.totalRequests || 0) - courierCompleted - courierNotCompleted);
  const courierCompletionRate = courierStats?.totalRequests ? Math.round((courierCompleted / courierStats.totalRequests) * 100) : 0;

  const courierDonutData = [
    { name: t('dashboard.completed'), value: courierCompleted, color: COURIER_COLORS.completed, statusKey: "Installation Completed" },
    { name: t('dashboard.completed_1'), value: courierNotCompleted, color: COURIER_COLORS.notCompleted, statusKey: "Not Completed" },
    { name: t('dashboard.pending'), value: courierInProgress, color: COURIER_COLORS.inProgress, statusKey: "pending" },
  ].filter((d) => d.value > 0);

  const courierTopFailures = Object.entries(courierStats?.failures || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const courierBarData = courierTopFailures.map(([reason, count]) => ({
    name: reason.replace(/_/g, " "),
    count,
    reasonKey: reason,
  }));

  // Render Admin/Supervisor Dashboard
  if (canSeeGlobalData) {
    return (
      <div dir={dir} className="space-y-8 text-rassco-text">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rassco-glass rassco-glass-static p-6 relative overflow-hidden border-2 !border-[rgba(24,178,176,0.28)]">
          <div className="absolute -left-20 -top-20 size-60 bg-[#18B2B0]/10 blur-3xl rounded-full" />
          <div className="relative z-10 space-y-1">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#2D3135]">
              {t('dashboard.admin_panel')}
            </h2>
            <p className="text-[#6B7280] font-medium">
              {t('dashboard.welcome_back_overview', { name: user?.fullName || t('dashboard.supervisor') })}
            </p>
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <div className="px-4 py-2 bg-[#F8FAFB] border-2 border-[rgba(24,178,176,0.22)] rounded-xl text-sm font-semibold text-[#18B2B0] flex items-center gap-2">
              <CalendarIcon className="size-4" />
              {new Date().toLocaleDateString(dateLocale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>

        {/* Top level metrics (Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <HomeKpiCard
            title={t('dashboard.total_units_inventory')}
            value={formatNumber(totals.total)}
            icon={Boxes}
            accent="#18B2B0"
            sparkData={trendChartData.map((point) => ({ v: point.fixed + point.moving + point.central }))}
            footer={(
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span>{t('dashboard.warehouses_1')}</span>
                  <span className="font-semibold text-[#2D3135]">{formatNumber(totals.central)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('dashboard.couriers')}</span>
                  <span className="font-semibold text-[#18B2B0]">{formatNumber(totals.fixed)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('dashboard.couriers_1')}</span>
                  <span className="font-semibold text-[#F4B740]">{formatNumber(totals.moving)}</span>
                </div>
              </div>
            )}
          />

          <HomeKpiCard
            title={t('dashboard.day')}
            value={formatNumber(dashboardStats?.todayTransactions ?? 0)}
            icon={Activity}
            accent="#F4B740"
            sparkVariant="bar"
            sparkData={buildSparkSeries(dashboardStats?.todayTransactions ?? 0, 2)}
            footer={(
              <div className="flex justify-between items-center">
                <span>{t('dashboard.update')}</span>
                <span className="flex items-center gap-1 text-[#18B2B0] font-semibold">
                  <TrendingUp className="size-3.5" />
                  {t('dashboard.phrase_a75ee9f0')}
                </span>
              </div>
            )}
          />

          <HomeKpiCard
            title={t('dashboard.item_28760')}
            value={formatNumber(adminStats?.activeUsers ?? dashboardStats?.totalUsers ?? 0)}
            icon={Users}
            accent="#5F6368"
            sparkData={buildSparkSeries(adminStats?.activeUsers ?? dashboardStats?.totalUsers ?? 0, 3)}
            footer={(
              <div className="flex justify-between items-center">
                <span>{t('dashboard.total_users_system')}</span>
                <span className="font-semibold text-[#2D3135]">
                  {t('dashboard.count', { count: formatNumber(adminStats?.totalUsers ?? dashboardStats?.totalUsers ?? 0) })}
                </span>
              </div>
            )}
          />

          <HomeKpiCard
            title={t('dashboard.item_27049')}
            value={formatNumber(totalPendingActions)}
            icon={AlertTriangle}
            accent="#E05252"
            sparkVariant="bar"
            sparkData={buildSparkSeries(Math.max(totalPendingActions, 1), 4)}
            valueClassName="text-[#E05252]"
            footer={(
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span>{t('dashboard.requests')}</span>
                  <span className={`font-semibold ${pendingRequestsCount > 0 ? "text-[#E05252]" : "text-[#6B7280]"}`}>
                    {t('dashboard.requests_2', { count: pendingRequestsCount })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('dashboard.transfers_warehouses')}</span>
                  <span className={`font-semibold ${pendingTransfersCount > 0 ? "text-[#E05252]" : "text-[#6B7280]"}`}>
                    {t('dashboard.transfers_2', { count: pendingTransfersCount })}
                  </span>
                </div>
              </div>
            )}
          />
        </div>

        {/* Tabbed content sections */}
        <Tabs value={dashboardTab} onValueChange={setDashboardTab} className="space-y-6">
          <TabsList className="dashboard-tabs-rail !h-auto !min-h-[4.25rem] !w-full md:!w-max !inline-flex !items-center !justify-start !gap-2 !overflow-x-auto !rounded-full !border-2 !border-[#18B2B0]/40 !bg-[#cfd6dc] !p-2.5 !shadow-[0_10px_28px_rgba(15,23,42,0.12)] !text-[#3d4650]">
            <TabsTrigger
              value="overview"
              className="dashboard-tab-trigger group relative isolate !z-0 !flex !h-auto !items-center !gap-2.5 !whitespace-nowrap !rounded-full !px-7 !py-4 !text-base !font-extrabold !text-[#4b5563] !shadow-none !transition-colors !duration-300 hover:!text-[#18B2B0] data-[state=active]:!bg-transparent data-[state=active]:!text-white data-[state=active]:!shadow-none"
            >
              {dashboardTab === "overview" && (
                <motion.span
                  layoutId="dashboard-tab-pill"
                  className="dashboard-tab-pill absolute inset-0 z-0 rounded-full bg-gradient-to-l from-[#18B2B0] to-[#149D9B] shadow-[0_10px_24px_rgba(24, 178, 176,0.4)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.65 }}
                />
              )}
              <Layers className="relative z-10 size-5 shrink-0" />
              <span className="relative z-10">{t('dashboard.item_23921')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="dashboard-tab-trigger group relative isolate !z-0 !flex !h-auto !items-center !gap-2.5 !whitespace-nowrap !rounded-full !px-7 !py-4 !text-base !font-extrabold !text-[#4b5563] !shadow-none !transition-colors !duration-300 hover:!text-[#18B2B0] data-[state=active]:!bg-transparent data-[state=active]:!text-white data-[state=active]:!shadow-none"
            >
              {dashboardTab === "analytics" && (
                <motion.span
                  layoutId="dashboard-tab-pill"
                  className="dashboard-tab-pill absolute inset-0 z-0 rounded-full bg-gradient-to-l from-[#18B2B0] to-[#149D9B] shadow-[0_10px_24px_rgba(24, 178, 176,0.4)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.65 }}
                />
              )}
              <TrendingUp className="relative z-10 size-5 shrink-0" />
              <span className="relative z-10">{t('dashboard.item_35089')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="dashboard-tab-trigger group relative isolate !z-0 !flex !h-auto !items-center !gap-2.5 !whitespace-nowrap !rounded-full !px-7 !py-4 !text-base !font-extrabold !text-[#4b5563] !shadow-none !transition-colors !duration-300 hover:!text-[#18B2B0] data-[state=active]:!bg-transparent data-[state=active]:!text-white data-[state=active]:!shadow-none"
            >
              {dashboardTab === "pending" && (
                <motion.span
                  layoutId="dashboard-tab-pill"
                  className="dashboard-tab-pill absolute inset-0 z-0 rounded-full bg-gradient-to-l from-[#18B2B0] to-[#149D9B] shadow-[0_10px_24px_rgba(24, 178, 176,0.4)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.65 }}
                />
              )}
              <Clock className="relative z-10 size-5 shrink-0" />
              <span className="relative z-10">{t('dashboard.operations')}</span>
              {totalPendingActions > 0 && (
                <span className="relative z-10 px-2 py-0.5 rounded-full bg-rassco-danger text-white text-[11px] font-extrabold shadow-sm">
                  {totalPendingActions}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="team"
              className="dashboard-tab-trigger group relative isolate !z-0 !flex !h-auto !items-center !gap-2.5 !whitespace-nowrap !rounded-full !px-7 !py-4 !text-base !font-extrabold !text-[#4b5563] !shadow-none !transition-colors !duration-300 hover:!text-[#18B2B0] data-[state=active]:!bg-transparent data-[state=active]:!text-white data-[state=active]:!shadow-none"
            >
              {dashboardTab === "team" && (
                <motion.span
                  layoutId="dashboard-tab-pill"
                  className="dashboard-tab-pill absolute inset-0 z-0 rounded-full bg-gradient-to-l from-[#18B2B0] to-[#149D9B] shadow-[0_10px_24px_rgba(24, 178, 176,0.4)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.65 }}
                />
              )}
              <Users className="relative z-10 size-5 shrink-0" />
              <span className="relative z-10">{t('dashboard.item_31912')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="courier"
              className="dashboard-tab-trigger group relative isolate !z-0 !flex !h-auto !items-center !gap-2.5 !whitespace-nowrap !rounded-full !px-7 !py-4 !text-base !font-extrabold !text-[#4b5563] !shadow-none !transition-colors !duration-300 hover:!text-[#18B2B0] data-[state=active]:!bg-transparent data-[state=active]:!text-white data-[state=active]:!shadow-none"
            >
              {dashboardTab === "courier" && (
                <motion.span
                  layoutId="dashboard-tab-pill"
                  className="dashboard-tab-pill absolute inset-0 z-0 rounded-full bg-gradient-to-l from-[#18B2B0] to-[#149D9B] shadow-[0_10px_24px_rgba(24, 178, 176,0.4)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.65 }}
                />
              )}
              <Truck className="relative z-10 size-5 shrink-0" />
              <span className="relative z-10">{t('dashboard.delivery')}</span>
              {(courierStats?.totalRequests ?? 0) > 0 && (
                <span className={`relative z-10 px-2 py-0.5 rounded-full text-[11px] font-extrabold border ${
                  dashboardTab === "courier"
                    ? "bg-white/25 text-white border-white/30"
                    : "bg-rassco/15 text-rassco border-rassco/25"
                }`}>
                  {courierStats?.totalRequests}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={dashboardTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-6 outline-none">
            <div className="rassco-glass rassco-glass-static p-6 border-2 !border-[rgba(24,178,176,0.28)]">
              <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-[#2D3135]">{t('dashboard.system_movement')}</h3>
                  <p className="text-[#6B7280] text-xs mt-0.5">{t('dashboard.system_movement_desc')}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="bg-[#F8FAFB] border-2 border-[rgba(24,178,176,0.22)] rounded-xl p-1 flex items-center gap-1 shrink-0 overflow-x-auto">
                    {([
                      { key: "circles" as const, label: t('dashboard.movement_circles'), icon: PieChartIcon },
                      { key: "bars" as const, label: t('dashboard.movement_bars'), icon: BarChart3 },
                      { key: "lines" as const, label: t('dashboard.movement_lines'), icon: LineChartIcon },
                      { key: "map" as const, label: t('dashboard.movement_map'), icon: MapIcon },
                    ]).map((tab) => {
                      const Icon = tab.icon;
                      const active = movementView === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setMovementView(tab.key)}
                          className={
                            active
                              ? "px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#18B2B0] text-white shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap"
                              : "px-3 py-1.5 text-xs rounded-lg text-[#6B7280] hover:bg-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                          }
                        >
                          <Icon className="size-3.5" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                  {movementView === "lines" || movementView === "bars" ? (
                    <div className="bg-[#F8FAFB] border-2 border-[rgba(24,178,176,0.22)] rounded-xl p-1 flex items-center gap-1 shrink-0">
                      {trendPeriodOptions.map((option) => (
                        <button
                          key={option.value}
                          className={
                            trendPeriod === option.value
                              ? "px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#18B2B0] text-white shadow-sm"
                              : "px-3 py-1.5 text-xs rounded-lg text-[#6B7280] hover:bg-white transition-colors"
                          }
                          onClick={() => setTrendPeriod(option.value)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={movementView}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl border border-[rgba(24,178,176,0.16)] bg-[rgba(248,250,251,0.65)] p-4 min-h-[360px]"
                >
                  {movementView === "circles" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {[
                        { title: t('dashboard.movement_mix'), data: inventoryMixData },
                        { title: t('dashboard.category_items_inventory'), data: categoryData },
                        { title: t('dashboard.movement_activity'), data: operationsStatusData },
                      ].map((block) => (
                        <div key={block.title} className="rounded-2xl border border-[rgba(24,178,176,0.14)] bg-white/70 p-4">
                          <h4 className="text-sm font-bold text-[#2D3135] mb-2">{block.title}</h4>
                          <div className="h-[210px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={block.data}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={52}
                                  outerRadius={74}
                                  paddingAngle={4}
                                  dataKey="value"
                                  stroke="#fff"
                                  strokeWidth={3}
                                >
                                  {block.data.map((entry, index) => (
                                    <Cell key={`${block.title}-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={ChartTooltipStyle()}
                                  formatter={(value: any) => [formatNumber(Number(value)), t('dashboard.quantity')]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="space-y-2 pt-2 border-t border-[rgba(24,178,176,0.12)]">
                            {block.data.map((item) => (
                              <div key={item.name} className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-2 text-[#6B7280]">
                                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                                  {item.name}
                                </span>
                                <span className="font-semibold text-[#2D3135]">{formatNumber(item.value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {movementView === "bars" && (
                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                      <div className="xl:col-span-3 h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#DADDE1" opacity={0.45} vertical={false} />
                            <XAxis dataKey="name" stroke="#7C838B" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#7C838B" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                            <Tooltip contentStyle={ChartTooltipStyle()} />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            <Bar name={t('dashboard.fixed_inventory_chart')} dataKey="fixed" fill="#18B2B0" radius={[6, 6, 0, 0]} />
                            <Bar name={t('dashboard.moving_inventory_chart')} dataKey="moving" fill="#5F6368" radius={[6, 6, 0, 0]} />
                            <Bar name={t('dashboard.item_16008')} dataKey="central" fill="#F4B740" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="xl:col-span-2 h-[320px]">
                        <h4 className="text-sm font-bold text-[#2D3135] mb-2">{t('dashboard.movement_cities')}</h4>
                        <ResponsiveContainer width="100%" height="90%">
                          <BarChart data={cityMovementData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#DADDE1" opacity={0.35} horizontal={false} />
                            <XAxis type="number" stroke="#7C838B" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                            <YAxis type="category" dataKey="name" width={70} stroke="#7C838B" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={ChartTooltipStyle()} />
                            <Bar dataKey="units" name={t('dashboard.movement_units_count')} fill="#18B2B0" radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {movementView === "lines" && (
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#DADDE1" opacity={0.45} vertical={false} />
                          <XAxis dataKey="name" stroke="#7C838B" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="#7C838B" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                          <Tooltip contentStyle={ChartTooltipStyle()} />
                          <Legend verticalAlign="top" height={36} iconType="circle" />
                          <Line type="monotone" name={t('dashboard.fixed_inventory_chart')} dataKey="fixed" stroke="#18B2B0" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                          <Line type="monotone" name={t('dashboard.moving_inventory_chart')} dataKey="moving" stroke="#5F6368" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                          <Line type="monotone" name={t('dashboard.item_16008')} dataKey="central" stroke="#F4B740" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {movementView === "map" && (
                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                      <div className="xl:col-span-3 relative h-[340px] rounded-2xl overflow-hidden border border-[rgba(24,178,176,0.16)] bg-gradient-to-br from-[#eefbfb] via-[#f8fafb] to-[#e7ecef]">
                        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
                          <defs>
                            <linearGradient id="saudiFill" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#18B2B0" stopOpacity="0.16" />
                              <stop offset="100%" stopColor="#5F6368" stopOpacity="0.08" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M18 24 C26 14, 40 12, 52 16 C64 20, 74 18, 82 24 C88 30, 90 40, 86 50 C84 60, 80 68, 74 76 C66 86, 54 90, 42 88 C32 86, 24 78, 20 68 C14 56, 12 38, 18 24 Z"
                            fill="url(#saudiFill)"
                            stroke="#18B2B0"
                            strokeWidth="1.2"
                            opacity="0.95"
                          />
                          <path
                            d="M22 30 C30 22, 42 20, 54 24 C66 28, 76 26, 82 32"
                            fill="none"
                            stroke="#18B2B0"
                            strokeOpacity="0.25"
                            strokeWidth="0.6"
                          />
                          {geoSpreadPoints.map((point) => {
                            const radius = Math.max(1.8, Math.min(5.5, 1.6 + Math.sqrt(Math.max(point.units, 1)) / 18));
                            return (
                              <g key={point.name}>
                                <circle cx={point.x} cy={point.y} r={radius + 1.8} fill="#18B2B0" opacity="0.15" />
                                <circle cx={point.x} cy={point.y} r={radius} fill="#18B2B0" stroke="#ffffff" strokeWidth="0.6" />
                                <text x={point.x} y={point.y - radius - 1.5} textAnchor="middle" fontSize="2.8" fill="#2D3135" fontWeight="700">
                                  {point.name}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                        {geoSpreadPoints.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-sm text-[#6B7280]">
                            {t('dashboard.movement_no_geo')}
                          </div>
                        )}
                      </div>
                      <div className="xl:col-span-2 space-y-3 max-h-[340px] overflow-y-auto pr-1">
                        <p className="text-xs text-[#6B7280]">{t('dashboard.movement_map_hint')}</p>
                        {geoSpreadPoints.map((point) => (
                          <div key={`list-${point.name}`} className="rounded-xl border border-[rgba(24,178,176,0.16)] bg-white/80 p-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="font-bold text-sm text-[#2D3135] flex items-center gap-1.5">
                                <MapPin className="size-3.5 text-[#18B2B0]" />
                                {point.name}
                              </span>
                              <span className="text-xs font-semibold text-[#18B2B0]">{formatNumber(point.units)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6B7280]">
                              <div className="rounded-lg bg-[#F8FAFB] px-2 py-1.5 border border-[rgba(24,178,176,0.1)]">
                                {t('dashboard.movement_technicians_count')}: <strong className="text-[#2D3135]">{formatNumber(point.technicians)}</strong>
                              </div>
                              <div className="rounded-lg bg-[#F8FAFB] px-2 py-1.5 border border-[rgba(24,178,176,0.1)]">
                                {t('dashboard.movement_warehouses_count')}: <strong className="text-[#2D3135]">{formatNumber(point.warehouses)}</strong>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Recent activity & transactions */}
            {user?.role === "admin" && adminStats && (
              <Card className="rassco-glass rassco-glass-static border-2 !border-[rgba(24,178,176,0.28)] bg-transparent shadow-none">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-rassco-text flex items-center gap-2">
                      <History className="size-5 text-rassco" />
                      {t('dashboard.log_operations')}
                    </CardTitle>
                    <CardDescription className="text-rassco-muted text-xs mt-0.5">
                      {t('dashboard.phrase_1cb4bbe4')}
                    </CardDescription>
                  </div>
                  <Button variant="outline" className="border-rassco-border text-rassco-gray hover:bg-rassco-bg text-xs px-4" asChild>
                    <Link href="/operations">{t('dashboard.log_operations_1')}</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-rassco-bg/40 border-rassco-border">
                        <TableRow>
                          <TableHead className="text-right text-rassco-muted text-xs font-semibold">{t('dashboard.received_technician')}</TableHead>
                          <TableHead className="text-right text-rassco-muted text-xs font-semibold">{t('dashboard.type_operation')}</TableHead>
                          <TableHead className="text-right text-rassco-muted text-xs font-semibold">{t('dashboard.item_7975')}</TableHead>
                          <TableHead className="text-right text-rassco-muted text-xs font-semibold">{t('dashboard.quantity')}</TableHead>
                          <TableHead className="text-right text-rassco-muted text-xs font-semibold">{t('dashboard.reason_notes')}</TableHead>
                          <TableHead className="text-right text-rassco-muted text-xs font-semibold">{t('dashboard.date')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminStats.recentTransactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-slate-500 py-6 text-sm">
                              {t('dashboard.no_logs')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          adminStats.recentTransactions.map((tx) => {
                            const isIntake = tx.type === "INTAKE" || tx.type === "ADD";
                            const isWithdraw = tx.type === "WITHDRAW" || tx.type === "REMOVE";
                            const isTransfer = tx.type === "TRANSFER";

                            return (
                              <TableRow key={tx.id} className="border-rassco-border/60 hover:bg-rassco-bg/20 transition-colors">
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="size-7 rounded-full bg-rassco-bg flex items-center justify-center font-bold text-rassco-gray text-xs">
                                      {(tx.userName || t('dashboard.item_1605')).substring(0, 1)}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-xs text-rassco-text">{tx.userName || t('dashboard.item_20777')}</div>
                                      <div className="text-[10px] text-slate-500">{tx.userRole === "admin" ? t('dashboard.manager') : tx.userRole === "supervisor" ? t('dashboard.supervisor_1') : t('dashboard.item_4817')}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3">
                                  <Badge
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 ${
                                      isIntake
                                        ? "bg-emerald-500/10 text-rassco"
                                        : isWithdraw
                                          ? "bg-rassco-danger/10 text-rassco-danger"
                                          : "bg-cyan-500/10 text-rassco"
                                    }`}
                                  >
                                    {isTransfer ? t('dashboard.transfer') : isIntake ? t('dashboard.add') : t('dashboard.withdraw_disbursement')}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-3 font-semibold text-xs text-rassco-gray">
                                  {tx.itemName || t('dashboard.item_17641')}
                                </TableCell>
                                <TableCell className="py-3 font-bold text-xs text-rassco-text">
                                  {t('dashboard.units_1', { count: tx.quantity })}
                                </TableCell>
                                <TableCell className="py-3 text-rassco-muted text-xs max-w-[200px] truncate" title={tx.reason}>
                                  {tx.reason || "-"}
                                </TableCell>
                                <TableCell className="py-3 text-slate-500 text-xs">
                                  {new Date(tx.createdAt).toLocaleDateString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB 2: ANALYTICS & LOW STOCK */}
          <TabsContent value="analytics" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Low stock Card */}
              <Card className="bg-white border-rassco-border shadow-sm flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-rassco-text flex items-center gap-2">
                    <ShieldAlert className="size-5 text-rassco-danger" />
                    {t('dashboard.item_36622')}
                  </CardTitle>
                  <CardDescription className="text-rassco-muted text-xs mt-0.5">
                    {t('dashboard.units')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-rassco-danger/5 border border-rassco-danger/20 text-center">
                      <div className="text-3xl font-extrabold text-rassco-danger">{dashboardStats?.lowStockItems ?? 0}</div>
                      <div className="text-rassco-muted text-xs mt-1">{t('dashboard.inventory')}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-rassco-bg/60 border border-rassco-border text-center">
                      <div className="text-3xl font-extrabold text-rassco-text">{dashboardStats?.outOfStockItems ?? 0}</div>
                      <div className="text-rassco-muted text-xs mt-1">{t('dashboard.item_27138')}</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-rassco-border space-y-3">
                    <div className="flex items-center justify-between text-xs text-rassco-gray">
                      <span>{t('dashboard.level_inventory')}</span>
                      <span className="text-rassco-danger font-semibold">{t('dashboard.status')}</span>
                    </div>
                    <Progress value={85} className="h-2 bg-rassco-bg [&>div]:bg-rassco-danger" />
                    <p className="text-[10px] text-slate-500">{t('dashboard.technicians_1')}</p>
                  </div>
                </CardContent>
              </Card>

              {/* General stock distribution */}
              <Card className="bg-white border-rassco-border shadow-sm flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-rassco-text flex items-center gap-2">
                    <Settings className="size-5 text-rassco" />
                    {t('dashboard.details_branches_system')}
                  </CardTitle>
                  <CardDescription className="text-rassco-muted text-xs mt-0.5">
                    {t('dashboard.inventory_couriers')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-rassco-muted">{t('dashboard.warehouses_2')}</span>
                        <span className="font-semibold text-rassco-gray">{formatNumber(totals.central)} ({percentage(totals.central, totals.total).toFixed(0)}%)</span>
                      </div>
                      <Progress value={percentage(totals.central, totals.total)} className="h-2 bg-rassco-bg [&>div]:bg-rassco-gray" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-rassco-muted">{t('dashboard.couriers_2')}</span>
                        <span className="font-semibold text-rassco">{formatNumber(totals.fixed)} ({percentage(totals.fixed, totals.total).toFixed(0)}%)</span>
                      </div>
                      <Progress value={percentage(totals.fixed, totals.total)} className="h-2 bg-rassco-bg [&>div]:bg-rassco" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-rassco-muted">{t('dashboard.couriers_sales')}</span>
                        <span className="font-semibold text-rassco-warning">{formatNumber(totals.moving)} ({percentage(totals.moving, totals.total).toFixed(0)}%)</span>
                      </div>
                      <Progress value={percentage(totals.moving, totals.total)} className="h-2 bg-rassco-bg [&>div]:bg-rassco-warning" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 3: PENDING OPERATIONS */}
          <TabsContent value="pending" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Technician custody requests */}
              <Card className="bg-white border-rassco-border shadow-sm flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg font-bold text-rassco-text flex items-center gap-2">
                      <Inbox className="size-5 text-rassco" />
                      {t('dashboard.requests_couriers')}
                    </CardTitle>
                    <CardDescription className="text-rassco-muted text-xs mt-0.5">
                      {t('dashboard.requests_inventory_management')}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-rassco border-rassco/30 bg-cyan-500/5">
                    {t('dashboard.item_9062', { count: pendingRequestsCount })}
                  </Badge>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto max-h-[400px]">
                  {allRequests.filter((r) => r.status === "pending").length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle2 className="size-10 text-rassco mb-2" />
                      <span className="text-sm font-semibold text-rassco-gray">{t('dashboard.no_requests')}</span>
                      <span className="text-xs text-slate-500 mt-1">{t('dashboard.requests_technicians_successfu')}</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allRequests
                        .filter((r) => r.status === "pending")
                        .map((req) => (
                          <div key={req.id} className="p-4 rounded-xl bg-rassco-bg/40 border border-rassco-border hover:border-rassco-border transition-colors space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-rassco-text">{req.technicianName || t('dashboard.item_17662')}</span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(req.createdAt).toLocaleDateString(dateLocale)}
                              </span>
                            </div>
                            <div className="text-xs text-rassco-gray bg-rassco-bg p-2 rounded-lg border border-rassco-border">
                              <span className="font-medium text-rassco">{t('dashboard.quantity_1')}</span>{" "}
                              {t('dashboard.count_1', { count: t('dashboard.units_2', { count: sumRequestItems(req) }) })}
                            </div>
                            {req.notes && (
                              <p className="text-[11px] text-rassco-muted italic">{t('dashboard.technician_3')}{req.notes}"</p>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                              <Button size="sm" className="bg-cyan-500/10 text-rassco border border-cyan-500/20 hover:bg-rassco/20 text-[10px] h-7 px-3" asChild>
                                <Link href="/notifications">{t('dashboard.review_request')}</Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Warehouse transfers status */}
              <Card className="bg-white border-rassco-border shadow-sm flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg font-bold text-rassco-text flex items-center gap-2">
                      <RefreshCcw className="size-5 text-rassco-warning animate-spin-slow" />
                      {t('dashboard.transfers_warehouses_1')}
                    </CardTitle>
                    <CardDescription className="text-rassco-muted text-xs mt-0.5">
                      {t('dashboard.transfers_receive_confirm_tech')}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-rassco-warning border-rassco-warning/30 bg-rassco-warning/5">
                    {t('dashboard.confirm', { count: pendingTransfersCount })}
                  </Badge>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto max-h-[400px]">
                  {allTransfers.filter((t) => t.status === "pending").length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle2 className="size-10 text-rassco mb-2" />
                      <span className="text-sm font-semibold text-rassco-gray">{t('dashboard.no_transfers')}</span>
                      <span className="text-xs text-slate-500 mt-1">{t('dashboard.inventory_status')}</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allTransfers
                        .filter((t) => t.status === "pending")
                        .map((transfer) => (
                          <div key={transfer.id} className="p-4 rounded-xl bg-rassco-bg/40 border border-rassco-border hover:border-rassco-border transition-colors space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-rassco-text">{t('dashboard.technician_4')}{transfer.technicianName || t('dashboard.item_17662')}</span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(transfer.createdAt).toLocaleDateString(dateLocale)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-rassco-gray">
                              <div className="bg-rassco-bg p-2 rounded border border-rassco-border">
                                <div className="text-[10px] text-slate-500">{t('dashboard.warehouse_source')}</div>
                                <div className="font-medium text-rassco-gray">{transfer.warehouseName || t('dashboard.warehouse_primary')}</div>
                              </div>
                              <div className="bg-rassco-bg p-2 rounded border border-rassco-border">
                                <div className="text-[10px] text-slate-500">{t('dashboard.quantity_2')}</div>
                                <div className="font-bold text-rassco-warning">{transfer.quantity}{t('dashboard.unit_3')}{transfer.itemNameAr || transfer.itemType})</div>
                              </div>
                            </div>
                            {transfer.notes && (
                              <p className="text-[11px] text-rassco-muted italic">{t('dashboard.item_9658')}{transfer.notes}"</p>
                            )}
                            <div className="flex justify-between items-center pt-2">
                              <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">{t('dashboard.scan_technician')}</Badge>
                              <Button size="sm" className="bg-rassco-warning/10 text-rassco-warning border border-rassco-warning/20 hover:bg-rassco-warning/20 text-[10px] h-7 px-3" asChild>
                                <Link href="/operations">{t('dashboard.review')}</Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 4: STAFF & WAREHOUSES */}
          <TabsContent value="team" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Technicians Leaderboard (Left & Center) */}
              <div className="lg:col-span-2 rounded-2xl bg-white border border-rassco-border p-6 flex flex-col shadow-sm">
                <h3 className="text-lg font-bold text-rassco-text flex items-center gap-2">
                  <UserCheck className="size-5 text-rassco" />
                  {t('dashboard.item_41535')}
                </h3>
                <p className="text-rassco-muted text-xs mt-0.5">{t('dashboard.item_63853')}</p>

                <div className="mt-6 overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-rassco-bg/40 border-rassco-border">
                      <TableRow>
                        <TableHead className="text-right text-rassco-muted text-xs font-semibold">{t('dashboard.name_technician')}</TableHead>
                        <TableHead className="text-right text-rassco-muted text-xs font-semibold">{t('dashboard.city')}</TableHead>
                        <TableHead className="text-right text-rassco-muted text-xs font-semibold">{t('dashboard.item_20635')}</TableHead>
                        <TableHead className="text-right text-rassco-muted text-xs font-semibold">{t('dashboard.item_22279')}</TableHead>
                        <TableHead className="text-right text-rassco-muted text-xs font-semibold">{t('dashboard.total')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topTechniciansList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-500 py-6 text-sm">
                            {t('dashboard.no_data')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        topTechniciansList.map((tech) => (
                          <TableRow key={tech.id} className="border-rassco-border/60 hover:bg-rassco-bg/20 transition-colors">
                            <TableCell className="py-3">
                              <div className="font-semibold text-xs text-rassco-text">{tech.name}</div>
                            </TableCell>
                            <TableCell className="py-3 text-rassco-muted text-xs">
                              {tech.city}
                            </TableCell>
                            <TableCell className="py-3 font-semibold text-xs text-rassco">
                              {t('dashboard.unit_1', { count: formatNumber(tech.fixed) })}
                            </TableCell>
                            <TableCell className="py-3 font-semibold text-xs text-rassco-warning">
                              {t('dashboard.unit_1', { count: formatNumber(tech.moving) })}
                            </TableCell>
                            <TableCell className="py-3 font-bold text-xs text-rassco-text">
                              {t('dashboard.unit_1', { count: formatNumber(tech.total) })}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Warehouse stats card */}
              <div className="rounded-2xl bg-white border border-rassco-border p-6 flex flex-col shadow-sm">
                <h3 className="text-lg font-bold text-rassco-text flex items-center gap-2">
                  <Warehouse className="size-5 text-rassco" />
                  {t('dashboard.warehouses_inventory_active')}
                </h3>
                <p className="text-rassco-muted text-xs mt-0.5">{t('dashboard.warehouses_primary')}</p>

                <div className="mt-6 space-y-4 flex-1 overflow-y-auto max-h-[350px]">
                  {warehousesData.length === 0 ? (
                    <div className="text-center text-slate-500 py-12 text-sm">{t('dashboard.no_warehouses_system')}</div>
                  ) : (
                    warehousesData.map((wh) => (
                      <div key={wh.id} className="p-4 rounded-xl bg-rassco-bg/40 border border-rassco-border hover:border-rassco-border transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-xs text-rassco-text">{wh.name}</span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                              <MapPin className="size-3" />
                              {wh.location || t('dashboard.signed')}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-rassco-gray border-rassco/30 bg-rassco/5 shrink-0">
                            {t('dashboard.unit_1', { count: formatNumber(wh.totalItems) })}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 5: COURIER & INSTALLATION */}
          <TabsContent value="courier" className="space-y-6 outline-none">
            {/* Quick Access Shortcuts */}
            <div className="bg-white border border-rassco-border rounded-2xl p-4 shadow-lg space-y-3">
              <h2 className="text-xs font-bold text-rassco uppercase tracking-wide flex items-center gap-1.5">
                {t('dashboard.unit_delivery')}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  { label: t('dashboard.data'), path: "/courier/raw-data", icon: Database, color: "hover:bg-blue-500/10 hover:border-blue-500/30" },
                  { label: t('dashboard.verification'), path: "/courier/requests", icon: ClipboardCheck, color: "hover:bg-emerald-500/10 hover:border-emerald-500/30" },
                  { label: t('dashboard.item_9785'), path: "/courier/pdf", icon: FileText, color: "hover:bg-rassco/10 hover:border-rassco/30" },
                  { label: t('dashboard.reports'), path: "/courier/reports", icon: BarChart3, color: "hover:bg-rassco/10 hover:border-rassco/30" },
                  { label: t('dashboard.export'), path: "/courier/export", icon: Download, color: "hover:bg-amber-500/10 hover:border-amber-500/30" },
                ].map((btn) => {
                  const BtnIcon = btn.icon;
                  return (
                    <button
                      key={btn.label}
                      onClick={() => setLocation(btn.path)}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-rassco-bg border border-rassco-border text-rassco-text transition-all duration-300 hover:-translate-y-0.5 shadow-sm ${btn.color}`}
                    >
                      <BtnIcon className="w-4 h-4 text-rassco-muted" />
                      <span>{btn.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CourierStatCard label={t('dashboard.total_requests_1')} value={courierStats?.totalRequests ?? "—"} icon={BarChart2} color="bg-blue-600" onClick={() => setLocation("/courier/requests")} />
              <CourierStatCard label={t('dashboard.successfully')} value={courierCompleted} icon={PackageCheck} color="bg-emerald-600" onClick={() => setLocation("/courier/requests?status=Installation Completed")} />
              <CourierStatCard label={t('dashboard.item_14393')} value={courierNotCompleted} icon={XCircle} color="bg-rassco-danger" onClick={() => setLocation("/courier/requests?status=Not Completed")} />
              <CourierStatCard label={t('dashboard.pending')} value={courierInProgress} icon={Timer} color="bg-amber-600" onClick={() => setLocation("/courier/requests?status=pending")} />
              <CourierStatCard label={t('dashboard.item_19351')} value={courierAiStats?.totalProcessed ?? "—"} icon={FileText} color="bg-rassco-gray" />
              <CourierStatCard label={t('dashboard.item_22364')} value={courierAiStats?.totalApplied ?? "—"} icon={PackageCheck} color="bg-cyan-600" />
              <CourierStatCard label={t('dashboard.item_27036')} value={courierAiStats?.averageConfidence ? `${courierAiStats.averageConfidence}%` : "—"} icon={TrendingUp} color="bg-rassco" />
              <CourierStatCard label={t('dashboard.rate')} value={`${courierCompletionRate}%`} icon={TrendingUp} color="bg-teal-600" />
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Donut Chart: Completion Status */}
              <div className="bg-white border border-rassco-border rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-rassco-text">{t('dashboard.requests_1')}</h2>
                  <p className="text-xs text-rassco-muted mt-1">{t('dashboard.item_60609')}</p>
                </div>

                <div className="h-64 mt-4 flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={courierDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        cursor="pointer"
                        onClick={(data: any) => setLocation(`/courier/requests?status=${encodeURIComponent(data.statusKey)}`)}
                      >
                        {courierDonutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E6E8EC", borderRadius: "10px", color: "#2D3135", textAlign: "right", direction: "rtl" }}
                        itemStyle={{ color: "#2D3135" }}
                        formatter={(value: any, name: any) => [t('dashboard.request', { var_0: value }), name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="absolute text-center pointer-events-none">
                    <span className="text-[10px] text-rassco-muted block font-semibold">{t('dashboard.total_requests')}</span>
                    <span className="text-2xl font-black text-rassco-text block mt-0.5">{courierStats?.totalRequests || 0}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-rassco-border">
                  {courierDonutData.map((d) => (
                    <button
                      key={d.name}
                      onClick={() => setLocation(`/courier/requests?status=${encodeURIComponent(d.statusKey)}`)}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-rassco-bg border border-rassco-border hover:border-rassco-border transition-colors text-center cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: d.color }} />
                      <span className="text-[10px] text-rassco-muted font-bold">{d.name}</span>
                      <span className="text-xs font-black text-rassco-text">{d.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bar Chart: Failure Reasons */}
              <div className="bg-white border border-rassco-border rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-rassco-text">{t('dashboard.fail')}</h2>
                  <p className="text-xs text-rassco-muted mt-1">{t('dashboard.item_62238')}</p>
                </div>

                <div className="h-64 mt-4">
                  {courierBarData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-600" />
                      <span className="text-xs">{t('dashboard.no_fail')}</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={courierBarData}
                        layout="vertical"
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                        onClick={(state: any) => {
                          if (state?.activePayload?.[0]?.payload?.reasonKey) {
                            setLocation(`/courier/requests?reason=${encodeURIComponent(state.activePayload[0].payload.reasonKey)}`);
                          }
                        }}
                      >
                        <XAxis type="number" stroke="#7C838B" fontSize={10} tickLine={false} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          stroke="#7C838B"
                          fontSize={9}
                          tickLine={false}
                          width={100}
                          axisLine={false}
                          tickFormatter={(val: string) => val.length > 15 ? `${val.substring(0, 15)}...` : val}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E6E8EC", borderRadius: "10px", color: "#2D3135", textAlign: "right", direction: "rtl" }}
                          itemStyle={{ color: "#2D3135" }}
                          formatter={(value: any) => [t('dashboard.duplicate', { var_0: value }), t('dashboard.item_15883')]}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} cursor="pointer">
                          {courierBarData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#E05252" : "#E05252"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-rassco-border text-xs text-rassco-muted flex items-center justify-between">
                  <span>{t('dashboard.total_fail')}</span>
                  <span className="text-rassco-text font-bold">
                    {t('dashboard.count_status', { count: Object.values(courierStats?.failures || {}).reduce((s, v) => s + v, 0) })}
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    );
  }

  // Render Technician-Specific Dashboard
  return (
    <div dir={dir} className="space-y-8 text-rassco-text">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-rassco-border p-6 rounded-2xl relative overflow-hidden shadow-lg">
        <div className="absolute -left-20 -top-20 size-60 bg-rassco/10 blur-3xl rounded-full" />
        <div className="relative z-10 space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-rassco-text">
            {t('dashboard.item_27106')}
          </h2>
          <p className="text-rassco-muted font-medium">
            {t('dashboard.welcome_tech_custody', { name: user?.fullName || t('dashboard.technician') })}
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="px-4 py-2 bg-rassco-bg border border-rassco-border rounded-xl text-sm font-semibold text-rassco flex items-center gap-2">
            <CalendarIcon className="size-4" />
            {new Date().toLocaleDateString(dateLocale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
      </div>

      {/* Technician cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white border-rassco-border hover:border-rassco/40 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-rassco-muted">{t('dashboard.devices')}</span>
            <Boxes className="h-5 w-5 text-rassco" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-rassco-text mb-1">{formatNumber(totals.fixed)}</div>
            <p className="text-xs text-slate-500 mt-2">{t('dashboard.devices_active')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-rassco-border hover:border-rassco-warning/40 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-rassco-muted">{t('dashboard.sales_sims')}</span>
            <Activity className="h-5 w-5 text-rassco-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-rassco-text mb-1">{formatNumber(totals.moving)}</div>
            <p className="text-xs text-slate-500 mt-2">{t('dashboard.item_63814')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-rassco-border hover:border-rassco/40 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-rassco-muted">{t('dashboard.item_33432')}</span>
            <Clock className="h-5 w-5 text-rassco-gray" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-rassco-text mb-1">
              {formatNumber(allRequests.filter((r) => r.status === "pending").length)}
            </div>
            <p className="text-xs text-slate-500 mt-2">{t('dashboard.requests_disbursement')}</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-rassco-border hover:border-rassco-danger/40 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-rassco-muted">{t('dashboard.transfers_1')}</span>
            <AlertTriangle className="h-5 w-5 text-rassco-danger animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-rassco-danger mb-1">
              {formatNumber(allTransfers.filter((t) => t.status === "pending").length)}
            </div>
            <p className="text-xs text-slate-500 mt-2">{t('dashboard.serial')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick action controls (Left) */}
        <div className="space-y-6">
          <Card className="bg-white border-rassco-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-rassco-text flex items-center gap-2">
                <Zap className="size-5 text-yellow-400" />
                {t('dashboard.item_19019')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button className="w-full bg-rassco/20 text-rassco border border-rassco/30 hover:bg-cyan-500/30 flex items-center justify-center gap-2" asChild>
                <Link href="/my-fixed-inventory">
                  <Boxes className="size-4" />
                  {t('dashboard.details')}
                </Link>
              </Button>
              <Button className="w-full bg-rassco-warning/20 text-rassco-warning border border-rassco-warning/30 hover:bg-rassco-warning/30 flex items-center justify-center gap-2" asChild>
                <Link href="/my-moving-inventory">
                  <Activity className="size-4" />
                  {t('dashboard.details_1')}
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Pending transfers to accept */}
          <Card className="bg-white border-rassco-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-rassco-text flex items-center gap-2">
                <Clock className="size-5 text-rassco-danger" />
                {t('dashboard.transfers')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {allTransfers.filter((t) => t.status === "pending").length === 0 ? (
                <div className="text-center text-slate-500 py-6 text-xs">{t('dashboard.no_transfers_confirm')}</div>
              ) : (
                allTransfers
                  .filter((transfer) => transfer.status === "pending")
                  .map((transfer) => (
                    <div key={transfer.id} className="p-3 rounded-lg bg-rassco-bg/40 border border-rassco-border flex flex-col gap-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-rassco-text">{transfer.itemNameAr || transfer.itemType}</span>
                        <span className="font-bold text-rassco-warning">{transfer.quantity}{t('dashboard.unit_4')}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{t('dashboard.warehouse_1')}{transfer.warehouseName || t('dashboard.warehouse_primary')}</span>
                      <Button size="sm" className="w-full bg-cyan-500/10 text-rassco hover:bg-rassco/20 text-[10px] h-7 mt-2" asChild>
                        <Link href="/my-moving-inventory">{t('dashboard.scan_number_serial')}</Link>
                      </Button>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Technician specific inventory distribution chart (Right & Center) */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-rassco-border p-6 flex flex-col shadow-sm">
          <h3 className="text-lg font-bold text-rassco-text">{t('dashboard.item_27136')}</h3>
          <p className="text-rassco-muted text-xs mt-0.5">{t('dashboard.item_47924')}</p>

          <div className="flex-1 min-h-[250px] mt-6">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { name: t('dashboard.item_20635'), quantity: totals.fixed, fill: "#18B2B0" },
                { name: t('dashboard.item_22279'), quantity: totals.moving, fill: "#5F6368" }
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DADDE1" opacity={0.2} />
                <XAxis dataKey="name" stroke="#7C838B" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#7C838B" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E6E8EC", borderRadius: "12px", color: "#2D3135", direction: "rtl" }}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                />
                <Bar dataKey="quantity" radius={[8, 8, 0, 0]}>
                  <Cell fill="#18B2B0" />
                  <Cell fill="#5F6368" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple Calendar Icon Component
function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}
