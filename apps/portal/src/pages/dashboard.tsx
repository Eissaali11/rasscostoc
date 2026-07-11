import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
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
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ar-SA").format(Math.round(value));
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

const trendPeriodOptions: Array<{ value: TrendPeriod; label: string }> = [
  { value: "monthly", label: "شهري" },
  { value: "weekly", label: "أسبوعي" },
  { value: "daily", label: "يومي" },
];

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
  completed: "#10b981",
  notCompleted: "#ef4444",
  inProgress: "#f59e0b",
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
      className={`bg-[#1a3636] border border-slate-700/50 rounded-xl p-5 flex items-center gap-4 shadow transition-all duration-300 ${
        onClick ? "cursor-pointer hover:border-emerald-500/50 hover:bg-[#1f3d3d] hover:-translate-y-0.5" : ""
      }`}
    >
      <div className={`p-3 rounded-lg ${color} shadow-inner`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
      </div>
    </div>
  );
}
// ──────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("monthly");

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
      city: tech.city || "غير محدد",
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
      { name: "أجهزة دفع (POS)", value: Math.round(totals.total * 0.45), color: "#22d3ee" },
      { name: "شرائح اتصالات (SIM)", value: Math.round(totals.total * 0.30), color: "#fb923c" },
      { name: "مستهلكات (ورق/ملصقات)", value: Math.round(totals.total * 0.25), color: "#c084fc" },
    ];
  }, [totals.total]);

  // Pending items count
  const pendingRequestsCount = useMemo(() => {
    return allRequests.filter((r) => r.status === "pending").length;
  }, [allRequests]);

  const pendingTransfersCount = useMemo(() => {
    return allTransfers.filter((t) => t.status === "pending").length;
  }, [allTransfers]);

  const totalPendingActions = pendingRequestsCount + pendingTransfersCount;

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
    { name: "مكتمل", value: courierCompleted, color: COURIER_COLORS.completed, statusKey: "Installation Completed" },
    { name: "غير مكتمل", value: courierNotCompleted, color: COURIER_COLORS.notCompleted, statusKey: "Not Completed" },
    { name: "قيد المعالجة", value: courierInProgress, color: COURIER_COLORS.inProgress, statusKey: "pending" },
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
      <div dir="rtl" className="space-y-8 text-slate-100">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1a3636] border border-slate-700/60 p-6 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="absolute -left-20 -top-20 size-60 bg-cyan-400/10 blur-3xl rounded-full" />
          <div className="relative z-10 space-y-1">
            <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-300 bg-clip-text text-transparent">
              لوحة التحكم المركزية
            </h2>
            <p className="text-slate-400 font-medium">
              مرحباً بك مجدداً، {user?.fullName || "المشرف"}. إليك نظرة شاملة على عمليات المخزون ومؤشرات الأداء.
            </p>
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <div className="px-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-sm font-semibold text-cyan-300 flex items-center gap-2">
              <CalendarIcon className="size-4" />
              {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>

        {/* Top level metrics (Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Inventory */}
          <Card className="bg-slate-900/40 border-slate-700/80 hover:border-cyan-400/40 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-cyan-400/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-1 bg-cyan-400 opacity-80" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-slate-400">إجمالي قطع المخزون</span>
              <Boxes className="h-5 w-5 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-extrabold tracking-tight text-white mb-2">{formatNumber(totals.total)}</div>
              <div className="flex flex-col gap-1 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800">
                <div className="flex justify-between">
                  <span>المستودعات:</span>
                  <span className="font-semibold text-purple-300">{formatNumber(totals.central)}</span>
                </div>
                <div className="flex justify-between">
                  <span>المندوبين (ثابت):</span>
                  <span className="font-semibold text-cyan-300">{formatNumber(totals.fixed)}</span>
                </div>
                <div className="flex justify-between">
                  <span>المندوبين (متحرك):</span>
                  <span className="font-semibold text-orange-300">{formatNumber(totals.moving)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Today Transactions */}
          <Card className="bg-slate-900/40 border-slate-700/80 hover:border-orange-400/40 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-orange-400/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-1 bg-orange-400 opacity-80" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-slate-400">معاملات اليوم</span>
              <Activity className="h-5 w-5 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-extrabold tracking-tight text-white mb-2">
                {formatNumber(dashboardStats?.todayTransactions ?? 0)}
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800">
                <span>تحديث فوري للشبكة</span>
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <TrendingUp className="size-3.5" />
                  +12% عن أمس
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Active Staff */}
          <Card className="bg-slate-900/40 border-slate-700/80 hover:border-purple-400/40 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-purple-400/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-1 bg-purple-400 opacity-80" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-slate-400">طاقم العمل والمناديب</span>
              <Users className="h-5 w-5 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-extrabold tracking-tight text-white mb-2">
                {formatNumber(adminStats?.activeUsers ?? dashboardStats?.totalUsers ?? 0)}
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800">
                <span>إجمالي المستخدمين في النظام</span>
                <span className="font-semibold text-purple-300">
                  {formatNumber(adminStats?.totalUsers ?? dashboardStats?.totalUsers ?? 0)} كلي
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Pending actions */}
          <Card className="bg-slate-900/40 border-slate-700/80 hover:border-rose-400/40 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-rose-400/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-1 bg-rose-400 opacity-80" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-medium text-slate-400">عمليات تتطلب إجراءً</span>
              <AlertTriangle className="h-5 w-5 text-rose-400 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-extrabold tracking-tight text-rose-400 mb-2">
                {formatNumber(totalPendingActions)}
              </div>
              <div className="flex flex-col gap-1 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800">
                <div className="flex justify-between">
                  <span>طلبات عهدة معلقة:</span>
                  <span className={`font-semibold ${pendingRequestsCount > 0 ? "text-rose-400 font-bold" : "text-slate-400"}`}>
                    {pendingRequestsCount} طلبات
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>مناقلات مستودعات معلقة:</span>
                  <span className={`font-semibold ${pendingTransfersCount > 0 ? "text-rose-400 font-bold" : "text-slate-400"}`}>
                    {pendingTransfersCount} مناقلات
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed content sections */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-slate-900/60 border border-slate-700/60 p-1 rounded-xl flex items-center justify-start overflow-x-auto w-full md:w-max">
            <TabsTrigger value="overview" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition-all data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border data-[state=active]:border-cyan-400/30">
              <Layers className="size-4" />
              نظرة عامة والنشاط
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition-all data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border data-[state=active]:border-cyan-400/30">
              <TrendingUp className="size-4" />
              تحليلات الأصناف والمخزون
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition-all data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border data-[state=active]:border-cyan-400/30">
              <Clock className="size-4" />
              العمليات المعلقة
              {totalPendingActions > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {totalPendingActions}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition-all data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border data-[state=active]:border-cyan-400/30">
              <Users className="size-4" />
              طاقم العمل والمستودعات
            </TabsTrigger>
            <TabsTrigger value="courier" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition-all data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 data-[state=active]:border data-[state=active]:border-emerald-400/30">
              <Truck className="size-4" />
              التوصيل والتركيب
              {(courierStats?.totalRequests ?? 0) > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                  {courierStats?.totalRequests}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trend Chart (Left & Center) */}
              <div className="lg:col-span-2 rounded-2xl bg-slate-900/40 border border-slate-700/80 p-6 flex flex-col shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">منحنى توزيع واتجاهات المخزون</h3>
                    <p className="text-slate-400 text-xs mt-0.5">مقارنة زمنية بين المخزون الثابت، المتحرك، والمستودعات</p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center gap-1 shrink-0">
                    {trendPeriodOptions.map((option) => (
                      <button
                        key={option.value}
                        className={
                          trendPeriod === option.value
                            ? "px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-sm"
                            : "px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:bg-slate-800 transition-colors"
                        }
                        onClick={() => setTrendPeriod(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorFixed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorMoving" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorCentral" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c084fc" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#c084fc" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", borderColor: "#475569", borderRadius: "12px", color: "#f8fafc", direction: "rtl" }}
                        itemStyle={{ color: "#f8fafc" }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area type="monotone" name="مخزون ثابت" dataKey="fixed" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#colorFixed)" />
                      <Area type="monotone" name="مخزون متحرك" dataKey="moving" stroke="#fb923c" strokeWidth={2} fillOpacity={1} fill="url(#colorMoving)" />
                      <Area type="monotone" name="مخزون مركزي" dataKey="central" stroke="#c084fc" strokeWidth={2} fillOpacity={1} fill="url(#colorCentral)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Side Card: Category proportion breakdown */}
              <div className="rounded-2xl bg-slate-900/40 border border-slate-700/80 p-6 flex flex-col justify-between shadow-sm">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center justify-between">
                    تصنيف عناصر المخزون
                    <Shapes className="h-4 w-4 text-slate-400" />
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">نسب توزيع المنتجات المعتمدة بالنظام</p>
                </div>

                <div className="flex-1 flex items-center justify-center min-h-[200px]">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", borderColor: "#475569", borderRadius: "12px", color: "#f8fafc", direction: "rtl" }}
                        formatter={(value: any) => [`${formatNumber(Number(value))} قطعة`, "الكمية"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-800">
                  {categoryData.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
                        <span className="text-slate-300">{cat.name}</span>
                      </span>
                      <span className="font-semibold text-white">
                        {percentage(cat.value, Math.max(totals.total, 1)).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent activity & transactions */}
            {user?.role === "admin" && adminStats && (
              <Card className="bg-slate-900/40 border-slate-700/80 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                      <History className="size-5 text-cyan-400" />
                      سجل العمليات الأخيرة بالنظام
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs mt-0.5">
                      آخر 10 معاملات مخزونية مسجلة للعهد والعهدة والواردات
                    </CardDescription>
                  </div>
                  <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs px-4" asChild>
                    <Link href="/operations">سجل العمليات الكامل</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-950/40 border-slate-800">
                        <TableRow>
                          <TableHead className="text-right text-slate-400 text-xs font-semibold">المستلم/الفني</TableHead>
                          <TableHead className="text-right text-slate-400 text-xs font-semibold">نوع العملية</TableHead>
                          <TableHead className="text-right text-slate-400 text-xs font-semibold">الصنف</TableHead>
                          <TableHead className="text-right text-slate-400 text-xs font-semibold">الكمية</TableHead>
                          <TableHead className="text-right text-slate-400 text-xs font-semibold">السبب / الملاحظات</TableHead>
                          <TableHead className="text-right text-slate-400 text-xs font-semibold">التاريخ والوقت</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminStats.recentTransactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-slate-500 py-6 text-sm">
                              لا توجد سجلات معاملات حديثة متوفرة.
                            </TableCell>
                          </TableRow>
                        ) : (
                          adminStats.recentTransactions.map((tx) => {
                            const isIntake = tx.type === "INTAKE" || tx.type === "ADD";
                            const isWithdraw = tx.type === "WITHDRAW" || tx.type === "REMOVE";
                            const isTransfer = tx.type === "TRANSFER";

                            return (
                              <TableRow key={tx.id} className="border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="size-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs">
                                      {(tx.userName || "م").substring(0, 1)}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-xs text-white">{tx.userName || "مستخدم غير معرف"}</div>
                                      <div className="text-[10px] text-slate-500">{tx.userRole === "admin" ? "مدير" : tx.userRole === "supervisor" ? "مشرف" : "فني"}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3">
                                  <Badge
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 ${
                                      isIntake
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : isWithdraw
                                          ? "bg-rose-500/10 text-rose-400"
                                          : "bg-cyan-500/10 text-cyan-400"
                                    }`}
                                  >
                                    {isTransfer ? "مناقلة عهدة" : isIntake ? "إضافة مخزون" : "سحب/صرف"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-3 font-semibold text-xs text-slate-300">
                                  {tx.itemName || "صنف غير معروف"}
                                </TableCell>
                                <TableCell className="py-3 font-bold text-xs text-white">
                                  {tx.quantity} وحدات
                                </TableCell>
                                <TableCell className="py-3 text-slate-400 text-xs max-w-[200px] truncate" title={tx.reason}>
                                  {tx.reason || "-"}
                                </TableCell>
                                <TableCell className="py-3 text-slate-500 text-xs">
                                  {new Date(tx.createdAt).toLocaleDateString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
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
              <Card className="bg-slate-900/40 border-slate-700/80 shadow-sm flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="size-5 text-rose-400" />
                    تحذيرات النقص وحالات العجز
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs mt-0.5">
                    القطع والأجهزة التي تقع تحت الحد الحرج للتنبيه
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-center">
                      <div className="text-3xl font-extrabold text-rose-400">{dashboardStats?.lowStockItems ?? 0}</div>
                      <div className="text-slate-400 text-xs mt-1">أصناف منخفضة المخزون</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 text-center">
                      <div className="text-3xl font-extrabold text-slate-200">{dashboardStats?.outOfStockItems ?? 0}</div>
                      <div className="text-slate-400 text-xs mt-1">أصناف منتهية تماماً</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>مستوى المخزون الحرج العام</span>
                      <span className="text-rose-400 font-semibold">حالة منبهة</span>
                    </div>
                    <Progress value={85} className="h-2 bg-slate-800 [&>div]:bg-rose-500" />
                    <p className="text-[10px] text-slate-500">مبني على متوسط الاستهلاك وتفضيلات الفنيين الأسبوعية</p>
                  </div>
                </CardContent>
              </Card>

              {/* General stock distribution */}
              <Card className="bg-slate-900/40 border-slate-700/80 shadow-sm flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Settings className="size-5 text-cyan-400" />
                    تفاصيل مخزون فروع ومندوبي النظام
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs mt-0.5">
                    مقارنة توزيع المخزون بين المندوبين ومستودعات المناطق
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">مخزون المستودعات المركزي</span>
                        <span className="font-semibold text-purple-300">{formatNumber(totals.central)} ({percentage(totals.central, totals.total).toFixed(0)}%)</span>
                      </div>
                      <Progress value={percentage(totals.central, totals.total)} className="h-2 bg-slate-800 [&>div]:bg-purple-400" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">مخزون المندوبين الثابت</span>
                        <span className="font-semibold text-cyan-300">{formatNumber(totals.fixed)} ({percentage(totals.fixed, totals.total).toFixed(0)}%)</span>
                      </div>
                      <Progress value={percentage(totals.fixed, totals.total)} className="h-2 bg-slate-800 [&>div]:bg-cyan-400" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">مخزون المندوبين المتحرك (مبيعات عهدة)</span>
                        <span className="font-semibold text-orange-300">{formatNumber(totals.moving)} ({percentage(totals.moving, totals.total).toFixed(0)}%)</span>
                      </div>
                      <Progress value={percentage(totals.moving, totals.total)} className="h-2 bg-slate-800 [&>div]:bg-orange-400" />
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
              <Card className="bg-slate-900/40 border-slate-700/80 shadow-sm flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                      <Inbox className="size-5 text-cyan-300" />
                      طلبات عهدة المندوبين المعلقة
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs mt-0.5">
                      طلبات المخزون التي لم يتم البت فيها بعد من قبل الإدارة
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-cyan-300 border-cyan-400/30 bg-cyan-500/5">
                    {pendingRequestsCount} معلقة
                  </Badge>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto max-h-[400px]">
                  {allRequests.filter((r) => r.status === "pending").length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle2 className="size-10 text-emerald-400 mb-2" />
                      <span className="text-sm font-semibold text-slate-300">لا توجد طلبات عهدة معلقة حالياً</span>
                      <span className="text-xs text-slate-500 mt-1">تمت معالجة كافة طلبات الفنيين بنجاح</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allRequests
                        .filter((r) => r.status === "pending")
                        .map((req) => (
                          <div key={req.id} className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700 transition-colors space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-white">{req.technicianName || "فني غير معروف"}</span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(req.createdAt).toLocaleDateString("ar-SA")}
                              </span>
                            </div>
                            <div className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                              <span className="font-medium text-cyan-300">الكمية المطلوبة:</span>{" "}
                              {sumRequestItems(req)} قطع (انقر للتفاصيل)
                            </div>
                            {req.notes && (
                              <p className="text-[11px] text-slate-400 italic">ملاحظة الفني: "{req.notes}"</p>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                              <Button size="sm" className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 text-[10px] h-7 px-3" asChild>
                                <Link href="/notifications">مراجعة والبت في الطلب</Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Warehouse transfers status */}
              <Card className="bg-slate-900/40 border-slate-700/80 shadow-sm flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                      <RefreshCcw className="size-5 text-orange-300 animate-spin-slow" />
                      مناقلات المستودعات المعلقة
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs mt-0.5">
                      المناقلات والعهدة التي بانتظار استلام أو تأكيد الفني
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-orange-300 border-orange-400/30 bg-orange-500/5">
                    {pendingTransfersCount} بانتظار التأكيد
                  </Badge>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto max-h-[400px]">
                  {allTransfers.filter((t) => t.status === "pending").length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle2 className="size-10 text-emerald-400 mb-2" />
                      <span className="text-sm font-semibold text-slate-300">لا توجد مناقلات معلقة حالياً</span>
                      <span className="text-xs text-slate-500 mt-1">المخزون والعهدة في حالة توازن كامل</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allTransfers
                        .filter((t) => t.status === "pending")
                        .map((transfer) => (
                          <div key={transfer.id} className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700 transition-colors space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-white">إلى الفني: {transfer.technicianName || "فني غير معروف"}</span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(transfer.createdAt).toLocaleDateString("ar-SA")}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                              <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                                <div className="text-[10px] text-slate-500">المستودع المصدر</div>
                                <div className="font-medium text-slate-300">{transfer.warehouseName || "المستودع الرئيسي"}</div>
                              </div>
                              <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                                <div className="text-[10px] text-slate-500">الكمية والصنف</div>
                                <div className="font-bold text-orange-300">{transfer.quantity} وحدة ({transfer.itemNameAr || transfer.itemType})</div>
                              </div>
                            </div>
                            {transfer.notes && (
                              <p className="text-[11px] text-slate-400 italic">ملاحظة: "{transfer.notes}"</p>
                            )}
                            <div className="flex justify-between items-center pt-2">
                              <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">بانتظار مسح الفني</Badge>
                              <Button size="sm" className="bg-orange-500/10 text-orange-300 border border-orange-500/20 hover:bg-orange-500/20 text-[10px] h-7 px-3" asChild>
                                <Link href="/operations">مراجعة المعاملة</Link>
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
              <div className="lg:col-span-2 rounded-2xl bg-slate-900/40 border border-slate-700/80 p-6 flex flex-col shadow-sm">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="size-5 text-cyan-400" />
                  قائمة العهد الإجمالية للفنيين
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">تفصيل كميات العهدة الثابتة والمتحركة لكل مندوب</p>

                <div className="mt-6 overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-950/40 border-slate-800">
                      <TableRow>
                        <TableHead className="text-right text-slate-400 text-xs font-semibold">اسم المندوب</TableHead>
                        <TableHead className="text-right text-slate-400 text-xs font-semibold">المدينة</TableHead>
                        <TableHead className="text-right text-slate-400 text-xs font-semibold">العهدة الثابتة</TableHead>
                        <TableHead className="text-right text-slate-400 text-xs font-semibold">العهدة المتحركة</TableHead>
                        <TableHead className="text-right text-slate-400 text-xs font-semibold">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topTechniciansList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-500 py-6 text-sm">
                            لا توجد بيانات عهدة للفنيين حالياً.
                          </TableCell>
                        </TableRow>
                      ) : (
                        topTechniciansList.map((tech) => (
                          <TableRow key={tech.id} className="border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                            <TableCell className="py-3">
                              <div className="font-semibold text-xs text-white">{tech.name}</div>
                            </TableCell>
                            <TableCell className="py-3 text-slate-400 text-xs">
                              {tech.city}
                            </TableCell>
                            <TableCell className="py-3 font-semibold text-xs text-cyan-300">
                              {formatNumber(tech.fixed)} قطعة
                            </TableCell>
                            <TableCell className="py-3 font-semibold text-xs text-orange-300">
                              {formatNumber(tech.moving)} قطعة
                            </TableCell>
                            <TableCell className="py-3 font-bold text-xs text-white">
                              {formatNumber(tech.total)} قطعة
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Warehouse stats card */}
              <div className="rounded-2xl bg-slate-900/40 border border-slate-700/80 p-6 flex flex-col shadow-sm">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Warehouse className="size-5 text-purple-400" />
                  مستودعات المخزون النشطة
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">تفصيل مخزون المستودعات الرئيسي والفرعي</p>

                <div className="mt-6 space-y-4 flex-1 overflow-y-auto max-h-[350px]">
                  {warehousesData.length === 0 ? (
                    <div className="text-center text-slate-500 py-12 text-sm">لا توجد مستودعات مسجلة في النظام.</div>
                  ) : (
                    warehousesData.map((wh) => (
                      <div key={wh.id} className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 hover:border-slate-700 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-xs text-white">{wh.name}</span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                              <MapPin className="size-3" />
                              {wh.location || "موقع افتراضي"}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-purple-300 border-purple-400/30 bg-purple-500/5 shrink-0">
                            {formatNumber(wh.totalItems)} قطعة
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
            <div className="bg-[#1a3636]/60 border border-slate-700/40 rounded-2xl p-4 shadow-lg space-y-3">
              <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                ⚡ روابط الوصول السريع — وحدة التوصيل والتركيب
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  { label: "البيانات الخام", path: "/courier/raw-data", icon: Database, color: "hover:bg-blue-500/10 hover:border-blue-500/30" },
                  { label: "التحقق والطلبات", path: "/courier/requests", icon: ClipboardCheck, color: "hover:bg-emerald-500/10 hover:border-emerald-500/30" },
                  { label: "تقارير PDF", path: "/courier/pdf", icon: FileText, color: "hover:bg-purple-500/10 hover:border-purple-500/30" },
                  { label: "التقارير الإجمالية", path: "/courier/reports", icon: BarChart3, color: "hover:bg-indigo-500/10 hover:border-indigo-500/30" },
                  { label: "تصدير Excel", path: "/courier/export", icon: Download, color: "hover:bg-amber-500/10 hover:border-amber-500/30" },
                ].map((btn) => {
                  const BtnIcon = btn.icon;
                  return (
                    <button
                      key={btn.label}
                      onClick={() => setLocation(btn.path)}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-[#102222]/85 border border-slate-700/70 text-slate-200 transition-all duration-300 hover:-translate-y-0.5 shadow-sm ${btn.color}`}
                    >
                      <BtnIcon className="w-4 h-4 text-slate-400" />
                      <span>{btn.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CourierStatCard label="إجمالي طلبات التركيب" value={courierStats?.totalRequests ?? "—"} icon={BarChart2} color="bg-blue-600" onClick={() => setLocation("/courier/requests")} />
              <CourierStatCard label="مكتملة بنجاح" value={courierCompleted} icon={PackageCheck} color="bg-emerald-600" onClick={() => setLocation("/courier/requests?status=Installation Completed")} />
              <CourierStatCard label="غير مكتملة" value={courierNotCompleted} icon={XCircle} color="bg-red-600" onClick={() => setLocation("/courier/requests?status=Not Completed")} />
              <CourierStatCard label="قيد المعالجة" value={courierInProgress} icon={Timer} color="bg-amber-600" onClick={() => setLocation("/courier/requests?status=pending")} />
              <CourierStatCard label="تقارير PDF معالجة" value={courierAiStats?.totalProcessed ?? "—"} icon={FileText} color="bg-purple-600" />
              <CourierStatCard label="تقارير مُطبَّقة" value={courierAiStats?.totalApplied ?? "—"} icon={PackageCheck} color="bg-cyan-600" />
              <CourierStatCard label="متوسط دقة الاستخراج" value={courierAiStats?.averageConfidence ? `${courierAiStats.averageConfidence}%` : "—"} icon={TrendingUp} color="bg-indigo-600" />
              <CourierStatCard label="معدل الإتمام الكلي" value={`${courierCompletionRate}%`} icon={TrendingUp} color="bg-teal-600" />
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Donut Chart: Completion Status */}
              <div className="bg-[#1a3636] border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-100">نسبة توزيع الطلبات وإتمامها</h2>
                  <p className="text-xs text-slate-400 mt-1">توزيع نسبي لحالات التركيب والمعالجة الحالية</p>
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
                        contentStyle={{ backgroundColor: "#142d2d", borderColor: "#334155", borderRadius: "10px", textAlign: "right", direction: "rtl" }}
                        itemStyle={{ color: "#e2e8f0" }}
                        formatter={(value: any, name: any) => [`${value} طلب`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="absolute text-center pointer-events-none">
                    <span className="text-[10px] text-slate-400 block font-semibold">إجمالي الطلبات</span>
                    <span className="text-2xl font-black text-white block mt-0.5">{courierStats?.totalRequests || 0}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-700/40">
                  {courierDonutData.map((d) => (
                    <button
                      key={d.name}
                      onClick={() => setLocation(`/courier/requests?status=${encodeURIComponent(d.statusKey)}`)}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-[#102222]/40 border border-slate-800 hover:border-slate-600 transition-colors text-center cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: d.color }} />
                      <span className="text-[10px] text-slate-400 font-bold">{d.name}</span>
                      <span className="text-xs font-black text-slate-100">{d.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bar Chart: Failure Reasons */}
              <div className="bg-[#1a3636] border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-100">أسباب الفشل الأكثر شيوعاً</h2>
                  <p className="text-xs text-slate-400 mt-1">المعوقات التشغيلية الأكثر تكراراً في الميدان</p>
                </div>

                <div className="h-64 mt-4">
                  {courierBarData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-600" />
                      <span className="text-xs">لا توجد حالات فشل مسجلة حتى الآن</span>
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
                        <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          stroke="#94a3b8"
                          fontSize={9}
                          tickLine={false}
                          width={100}
                          axisLine={false}
                          tickFormatter={(val: string) => val.length > 15 ? `${val.substring(0, 15)}...` : val}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#142d2d", borderColor: "#334155", borderRadius: "10px", textAlign: "right", direction: "rtl" }}
                          itemStyle={{ color: "#e2e8f0" }}
                          formatter={(value: any) => [`${value} تكرار`, "عدد الحالات"]}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} cursor="pointer">
                          {courierBarData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#ef4444" : "#f87171"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700/40 text-xs text-slate-400 flex items-center justify-between">
                  <span>إجمالي حالات الفشل المصنفة</span>
                  <span className="text-slate-200 font-bold">
                    {Object.values(courierStats?.failures || {}).reduce((s, v) => s + v, 0)} حالة
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Render Technician-Specific Dashboard
  return (
    <div dir="rtl" className="space-y-8 text-slate-100">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1a3636] border border-slate-700/60 p-6 rounded-2xl relative overflow-hidden shadow-lg">
        <div className="absolute -left-20 -top-20 size-60 bg-cyan-400/10 blur-3xl rounded-full" />
        <div className="relative z-10 space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-300 bg-clip-text text-transparent">
            حقيبة عهدتي الشخصية
          </h2>
          <p className="text-slate-400 font-medium">
            أهلاً بك، {user?.fullName || "المندوب"}. تابع عهدتك الثابتة والمتحركة وقدم طلبات المخزون الجديدة.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-sm font-semibold text-cyan-300 flex items-center gap-2">
            <CalendarIcon className="size-4" />
            {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
      </div>

      {/* Technician cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-900/40 border-slate-700/80 hover:border-cyan-400/40 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-slate-400">العهدة الثابتة (أجهزة/راوترات)</span>
            <Boxes className="h-5 w-5 text-cyan-300" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-white mb-1">{formatNumber(totals.fixed)}</div>
            <p className="text-xs text-slate-500 mt-2">الأجهزة المسلسلة في عهدتك النشطة</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-700/80 hover:border-orange-400/40 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-slate-400">العهدة المتحركة (مبيعات/شرائح)</span>
            <Activity className="h-5 w-5 text-orange-300" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-white mb-1">{formatNumber(totals.moving)}</div>
            <p className="text-xs text-slate-500 mt-2">الكميات والمستهلكات القابلة للاستهلاك والصرف</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-700/80 hover:border-purple-400/40 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-slate-400">طلباتي بانتظار الموافقة</span>
            <Clock className="h-5 w-5 text-purple-300" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-white mb-1">
              {formatNumber(allRequests.filter((r) => r.status === "pending").length)}
            </div>
            <p className="text-xs text-slate-500 mt-2">طلبات صرف مخزون معلقة حالياً</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-700/80 hover:border-rose-400/40 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium text-slate-400">مناقلات بانتظار استلامي</span>
            <AlertTriangle className="h-5 w-5 text-rose-300 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-rose-400 mb-1">
              {formatNumber(allTransfers.filter((t) => t.status === "pending").length)}
            </div>
            <p className="text-xs text-slate-500 mt-2">يرجى فحص ومسح السيريال للتأكيد</p>
          </CardContent>
        </Card>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick action controls (Left) */}
        <div className="space-y-6">
          <Card className="bg-slate-900/40 border-slate-700/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="size-5 text-yellow-400" />
                إجراءات سريعة
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button className="w-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 hover:bg-cyan-500/30 flex items-center justify-center gap-2" asChild>
                <Link href="/my-fixed-inventory">
                  <Boxes className="size-4" />
                  تفاصيل العهدة الثابتة
                </Link>
              </Button>
              <Button className="w-full bg-orange-500/20 text-orange-300 border border-orange-400/30 hover:bg-orange-500/30 flex items-center justify-center gap-2" asChild>
                <Link href="/my-moving-inventory">
                  <Activity className="size-4" />
                  تفاصيل العهدة المتحركة
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Pending transfers to accept */}
          <Card className="bg-slate-900/40 border-slate-700/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="size-5 text-rose-400" />
                مناقلات جديدة بانتظار مسحك
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {allTransfers.filter((t) => t.status === "pending").length === 0 ? (
                <div className="text-center text-slate-500 py-6 text-xs">لا توجد مناقلات معلقة بانتظار التأكيد.</div>
              ) : (
                allTransfers
                  .filter((t) => t.status === "pending")
                  .map((t) => (
                    <div key={t.id} className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 flex flex-col gap-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-white">{t.itemNameAr || t.itemType}</span>
                        <span className="font-bold text-orange-300">{t.quantity} وحدة</span>
                      </div>
                      <span className="text-[10px] text-slate-500">من مستودع: {t.warehouseName || "المستودع الرئيسي"}</span>
                      <Button size="sm" className="w-full bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-[10px] h-7 mt-2" asChild>
                        <Link href="/my-moving-inventory">ابدأ مسح الرقم التسلسلي والاستلام</Link>
                      </Button>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Technician specific inventory distribution chart (Right & Center) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/40 border border-slate-700/80 p-6 flex flex-col shadow-sm">
          <h3 className="text-lg font-bold text-white">توزيع عهدتي الحالية</h3>
          <p className="text-slate-400 text-xs mt-0.5">تفصيل بياني لمجموع العهد بمنتجاتها</p>

          <div className="flex-1 min-h-[250px] mt-6">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { name: "العهدة الثابتة", quantity: totals.fixed, fill: "#22d3ee" },
                { name: "العهدة المتحركة", quantity: totals.moving, fill: "#fb923c" }
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "#475569", borderRadius: "12px", color: "#f8fafc", direction: "rtl" }}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                />
                <Bar dataKey="quantity" radius={[8, 8, 0, 0]}>
                  <Cell fill="#22d3ee" />
                  <Cell fill="#fb923c" />
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
