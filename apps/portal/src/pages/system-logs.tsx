import { useTranslation } from "@/lib/language";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  FileText,
  Download,
  Filter,
  Search,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Trash2,
  Edit3,
  PlusCircle,
  LogIn,
  LogOut,
  RefreshCw,
  Eye,
  User,
  ShieldCheck,
  Printer,
  ExternalLink,
  Layers,
  Database,
  UserCheck,
  Clock,
  Globe,
  Terminal,
  Lock,
  Unlock,
  SlidersHorizontal
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { SystemLog } from "@shared/schema";
import { exportSystemLogsToExcel } from "@/lib/exportToExcel";
import { exportSingleLogToPDF } from "@/lib/exportLogPDF";
import { useToast } from "@/hooks/use-toast";

export default function SystemLogsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntityType, setFilterEntityType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);

  const { data: logs, isLoading, refetch, isRefetching } = useQuery<SystemLog[]>({
    queryKey: ["/api/system-logs"],
  });

  // Arabic Translation Helpers
  const formatActionDetails = (action: string) => {
    const actUpper = (action || "").toUpperCase();
    
    if (actUpper === "PLATFORM_LOCK_ENABLE") {
      return { label: "تفعيل قفل المنصة", colorClass: "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold", Icon: Lock };
    }
    if (actUpper === "PLATFORM_LOCK_DISABLE") {
      return { label: "إلغاء قفل المنصة", colorClass: "bg-rose-100 text-rose-900 border-rose-300 font-bold", Icon: Unlock };
    }
    if (actUpper === "DELETE" || actUpper === "REMOVE") {
      return { label: "حذف نهائي", colorClass: "bg-rose-100 text-rose-900 border-rose-300 font-bold", Icon: Trash2 };
    }
    if (actUpper === "SEARCH" || actUpper === "LOOKUP") {
      return { label: "استعلام وبحث", colorClass: "bg-cyan-100 text-cyan-900 border-cyan-300 font-bold", Icon: Search };
    }
    if (actUpper === "UPDATE" || actUpper === "EDIT") {
      return { label: "تحديث وتعديل", colorClass: "bg-amber-100 text-amber-950 border-amber-300 font-bold", Icon: Edit3 };
    }
    if (actUpper === "CREATE" || actUpper === "ADD") {
      return { label: "إنشاء وإضافة", colorClass: "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold", Icon: PlusCircle };
    }
    if (actUpper === "TRANSFER") {
      return { label: "نقل عهدة", colorClass: "bg-indigo-100 text-indigo-900 border-indigo-300 font-bold", Icon: RefreshCw };
    }
    if (actUpper === "LOGIN") {
      return { label: "تسجيل دخول", colorClass: "bg-blue-100 text-blue-900 border-blue-300 font-bold", Icon: LogIn };
    }
    if (actUpper === "LOGOUT") {
      return { label: "تسجيل خروج", colorClass: "bg-slate-100 text-slate-800 border-slate-300 font-bold", Icon: LogOut };
    }

    return { label: action.replace(/_/g, " "), colorClass: "bg-slate-100 text-slate-900 border-slate-300 font-bold", Icon: Activity };
  };

  const formatEntityType = (entityType?: string | null) => {
    if (!entityType) return "عام";
    const map: Record<string, string> = {
      platform_lock: "قفل المنصة المركزية",
      platform_lock_state: "حالة قفل المنصة",
      item: "أصل / سيريال",
      serialized_item: "أصل مسلسـل",
      search_query: "استعلام بحث",
      user: "حساب مستخدم",
      region: "منطقة جغرافية",
      warehouse: "مستودع رئيسي",
      inventory: "حركة مخزون",
      request: "طلب تسليم",
      transfer: "مناقلة عهدة",
      auth: "مصادقة وأمان",
      device: "جهاز تسليم",
      courier_request: "طلب توصيل مندوب",
    };
    return map[entityType] || entityType.replace(/_/g, " ");
  };

  const formatEntityName = (entityName?: string | null, entityType?: string | null) => {
    if (!entityName) return formatEntityType(entityType);
    const map: Record<string, string> = {
      platform_lock_state: "إعدادات الأمان وقفل المنصة",
      platform_lock: "قفل المنصة المركزية",
    };
    return map[entityName] || entityName;
  };

  const formatUserName = (userName?: string | null) => {
    if (!userName) return "النظام الآلي";
    const map: Record<string, string> = {
      "owner-portal": "بوابة المالك (Owner Portal)",
      "system": "نظام الرقابة الآلي",
      "admin": "المدير العام",
    };
    return map[userName] || userName;
  };

  const formatUserRole = (role?: string | null) => {
    if (!role) return "مستخدم النظام";
    const map: Record<string, string> = {
      PLATFORM_OWNER: "مالك المنصة (Platform Owner)",
      admin: "مدير النظام (Admin)",
      ADMIN: "مدير النظام (Admin)",
      supervisor: "مشرف أقاليم (Supervisor)",
      SUPERVISOR: "مشرف أقاليم (Supervisor)",
      technician: "فني ميداني (Technician)",
      TECHNICIAN: "فني ميداني (Technician)",
      warehouse_manager: "أمـين مستودع",
      WAREHOUSE_MANAGER: "أمـين مستودع",
      user: "مستخدم",
    };
    return map[role] || role;
  };

  const formatDescription = (desc: string) => {
    if (!desc) return "إجراء تنفيذي موثق بالنظام";
    if (desc.includes("PLATFORM_LOCK_DISABLE")) {
      return "تم إلغاء قفل المنصة المركزية واستعادة الوصول الكامل للعمليات واللوحات التشغيلية";
    }
    if (desc.includes("PLATFORM_LOCK_ENABLE")) {
      return "تم تفعيل قفل المنصة المركزية وتقييد الوصول لحين المراجعة الأسبوعية";
    }
    return desc;
  };

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      searchTerm === "" ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entityName && log.entityName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.action && log.action.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAction = filterAction === "all" || log.action === filterAction;
    const matchesEntityType = filterEntityType === "all" || log.entityType === filterEntityType;
    const matchesSeverity = filterSeverity === "all" || log.severity === filterSeverity;

    return matchesSearch && matchesAction && matchesEntityType && matchesSeverity;
  });

  // Calculate Metrics
  const totalCount = logs?.length || 0;
  const deleteCount = logs?.filter(l => l.action?.toLowerCase().includes("delete")).length || 0;
  const searchCount = logs?.filter(l => l.action?.toLowerCase().includes("search")).length || 0;
  const lockCount = logs?.filter(l => l.action?.includes("PLATFORM_LOCK")).length || 0;
  const activeActorsCount = new Set(logs?.map(l => l.userName)).size || 0;

  const handleExportExcel = async () => {
    const rows = filteredLogs || [];
    if (rows.length === 0) {
      toast({
        variant: "destructive",
        title: "لا توجد بيانات",
        description: "لا توجد سجلات مطابقة للتصدير حالياً",
      });
      return;
    }
    await exportSystemLogsToExcel({ logs: rows });
    toast({
      title: "تم التصدير بنجاح",
      description: `تم تصدير ${rows.length} سجل إلى ملف Excel بنجاح`,
    });
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-rose-300 text-rose-900 bg-rose-50 font-bold px-2 py-0.5 rounded-lg">
            <AlertCircle className="h-3 w-3" /> خطأ / حذف
          </Badge>
        );
      case "warn":
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-amber-300 text-amber-950 bg-amber-50 font-bold px-2 py-0.5 rounded-lg">
            <AlertTriangle className="h-3 w-3" /> تنبيه
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-teal-300 text-teal-900 bg-teal-50 font-bold px-2 py-0.5 rounded-lg">
            <Info className="h-3 w-3" /> معلومة
          </Badge>
        );
    }
  };

  const handleNavigateToUser = (userId?: string | null) => {
    if (userId) {
      setLocation(`/technician-details/${userId}`);
    } else {
      setLocation(`/users`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 p-4 md:p-8 dir-rtl text-right font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Ultra-Clear High Contrast Light Header Banner */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 md:p-7 rounded-3xl shadow-sm border border-slate-200"
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            
            {/* Title & Navigation */}
            <div className="flex items-center gap-4">
              <Link href="/home">
                <Button
                  variant="outline"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-extrabold rounded-2xl px-4 py-2"
                >
                  <ArrowLeft className="ml-2 h-4 w-4 text-slate-700" />
                  الرئيسية
                </Button>
              </Link>

              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-teal-50 text-teal-700 border border-teal-200 rounded-2xl shadow-sm">
                  <ShieldCheck className="h-8 w-8 text-teal-600" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                    مركز الرقابة وسجلات النظام الشاملة
                  </h1>
                  <p className="text-slate-600 text-sm font-bold mt-1">
                    رصد وتوثيق دقيق لكافة العمليات (حذف، بحث، قفل المنصة، وتعديل عهد) مع بصمة المسئول
                  </p>
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300 rounded-2xl font-extrabold px-4 py-2"
              >
                <RefreshCw className={`ml-2 h-4 w-4 text-teal-600 ${isRefetching ? 'animate-spin' : ''}`} />
                تحديث السجلات
              </Button>

              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold rounded-2xl shadow-md px-5 py-2 transition-all"
                onClick={handleExportExcel}
              >
                <Download className="ml-2 h-4 w-4 text-white" />
                تصدير السجلات (Excel)
              </Button>
            </div>

          </div>
        </motion.div>

        {/* Metric Summary Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-600 font-extrabold">إجمالي العمليات</p>
                <h3 className="text-2xl font-black text-slate-900">{totalCount}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-rose-50 text-rose-700 rounded-2xl border border-rose-100">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-600 font-extrabold">عمليات الحذف</p>
                <h3 className="text-2xl font-black text-rose-700">{deleteCount}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-cyan-50 text-cyan-700 rounded-2xl border border-cyan-100">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-600 font-extrabold">الاستعلام والبحث</p>
                <h3 className="text-2xl font-black text-cyan-700">{searchCount}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-100">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-600 font-extrabold">قفل وتأمين المنصة</p>
                <h3 className="text-2xl font-black text-amber-800">{lockCount}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl col-span-2 md:col-span-1">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-600 font-extrabold">المسؤولين النشطين</p>
                <h3 className="text-2xl font-black text-emerald-700">{activeActorsCount}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Control Bar */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-2xl">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-teal-600" />
                تصفية وبحث السجلات بالترجمة العربية
              </CardTitle>

              {/* Quick Filter Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={filterAction === "all" ? "default" : "outline"}
                  onClick={() => setFilterAction("all")}
                  className={filterAction === "all" ? "bg-slate-900 text-white font-extrabold rounded-xl" : "rounded-xl text-slate-700 font-bold border-slate-300"}
                >
                  عرض الكل
                </Button>
                <Button
                  size="sm"
                  variant={filterAction === "delete" ? "default" : "outline"}
                  onClick={() => setFilterAction("delete")}
                  className={filterAction === "delete" ? "bg-rose-600 text-white font-extrabold rounded-xl" : "rounded-xl text-rose-800 font-bold border-rose-200 hover:bg-rose-50"}
                >
                  <Trash2 className="ml-1 h-3.5 w-3.5" /> الحذف فقط
                </Button>
                <Button
                  size="sm"
                  variant={filterAction === "search" ? "default" : "outline"}
                  onClick={() => setFilterAction("search")}
                  className={filterAction === "search" ? "bg-cyan-600 text-white font-extrabold rounded-xl" : "rounded-xl text-cyan-800 font-bold border-cyan-200 hover:bg-cyan-50"}
                >
                  <Search className="ml-1 h-3.5 w-3.5" /> عمليات البحث
                </Button>
                <Button
                  size="sm"
                  variant={filterAction === "PLATFORM_LOCK_ENABLE" ? "default" : "outline"}
                  onClick={() => setFilterAction("PLATFORM_LOCK_ENABLE")}
                  className={filterAction === "PLATFORM_LOCK_ENABLE" ? "bg-emerald-600 text-white font-extrabold rounded-xl" : "rounded-xl text-emerald-800 font-bold border-emerald-200 hover:bg-emerald-50"}
                >
                  <Lock className="ml-1 h-3.5 w-3.5" /> قفل المنصة
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative md:col-span-1">
                <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="ابحث بالنص، المسؤول، أو السيريال..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10 bg-slate-50 border-slate-300 rounded-xl font-bold text-slate-900"
                />
              </div>

              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="bg-slate-50 border-slate-300 rounded-xl font-bold text-slate-900">
                  <SelectValue placeholder="نوع العملية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع العمليات</SelectItem>
                  <SelectItem value="delete">🗑️ حذف نهائي (Delete)</SelectItem>
                  <SelectItem value="search">🔍 بحث واستعلام (Search)</SelectItem>
                  <SelectItem value="update">✏️ تحديث بيانات (Update)</SelectItem>
                  <SelectItem value="create">➕ إنشاء وإضافة (Create)</SelectItem>
                  <SelectItem value="PLATFORM_LOCK_ENABLE">🔒 تفعيل قفل المنصة</SelectItem>
                  <SelectItem value="PLATFORM_LOCK_DISABLE">🔓 إلغاء قفل المنصة</SelectItem>
                  <SelectItem value="transfer">🚚 نقل عهدة (Transfer)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                <SelectTrigger className="bg-slate-50 border-slate-300 rounded-xl font-bold text-slate-900">
                  <SelectValue placeholder="نوع الكيان المتأثر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الكيانات</SelectItem>
                  <SelectItem value="platform_lock">قفل المنصة (Platform Lock)</SelectItem>
                  <SelectItem value="item">أصل / سيريال (Item)</SelectItem>
                  <SelectItem value="search_query">استعلام بحث (Search Query)</SelectItem>
                  <SelectItem value="user">حساب مستخدم (User)</SelectItem>
                  <SelectItem value="warehouse">مستودع (Warehouse)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="bg-slate-50 border-slate-300 rounded-xl font-bold text-slate-900">
                  <SelectValue placeholder="مستوى الأهمية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المستويات</SelectItem>
                  <SelectItem value="info">معلومة (Info)</SelectItem>
                  <SelectItem value="warn">تنبيه (Warning)</SelectItem>
                  <SelectItem value="error">خطأ / حرج (Error)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Data Table */}
        <Card className="bg-white border-slate-200 shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-black text-slate-900">
                  سجلات التدقيق المباشرة (Live Audit Trail)
                </CardTitle>
                <p className="text-xs text-slate-600 mt-0.5 font-bold">موثقة ومترجمة بالكامل باللغة العربية مع البصمة الرقمية</p>
              </div>
            </div>

            <Badge className="bg-teal-600 text-white border-teal-700 font-black px-3.5 py-1.5 text-sm rounded-xl shadow-sm">
              {filteredLogs?.length || 0} سجل موثق
            </Badge>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full bg-slate-100 rounded-2xl" />
                ))}
              </div>
            ) : filteredLogs && filteredLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-100">
                    <TableRow className="border-slate-200">
                      <TableHead className="text-slate-900 font-black text-right py-4 px-4">الوقت والتاريخ</TableHead>
                      <TableHead className="text-slate-900 font-black text-right py-4 px-4">المسؤول عن العملية</TableHead>
                      <TableHead className="text-slate-900 font-black text-right py-4 px-4">نوع العملية</TableHead>
                      <TableHead className="text-slate-900 font-black text-right py-4 px-4">الكيان / الهدف</TableHead>
                      <TableHead className="text-slate-900 font-black text-right py-4 px-4">تفاصيل الإجراء والملاحظات</TableHead>
                      <TableHead className="text-slate-900 font-black text-right py-4 px-4">المستوى</TableHead>
                      <TableHead className="text-slate-900 font-black text-center py-4 px-4">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const actionInfo = formatActionDetails(log.action);
                      const ActionIcon = actionInfo.Icon;

                      return (
                        <TableRow
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className="border-slate-200 hover:bg-teal-50/50 transition-colors cursor-pointer group"
                        >
                          <TableCell className="font-mono text-xs text-slate-800 py-4 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-bold">
                              <Clock className="h-3.5 w-3.5 text-teal-600" />
                              {log.createdAt ? format(new Date(log.createdAt), "yyyy/MM/dd - HH:mm:ss", { locale: ar }) : "-"}
                            </div>
                          </TableCell>

                          <TableCell className="py-4 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center font-black text-xs shadow-sm">
                                {log.userName ? log.userName.charAt(0).toUpperCase() : "U"}
                              </div>
                              <div>
                                <div className="font-black text-slate-900 text-sm group-hover:text-teal-700">
                                  {formatUserName(log.userName)}
                                </div>
                                <div className="text-xs text-slate-600 font-bold">{formatUserRole(log.userRole)}</div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="py-4 px-4 whitespace-nowrap">
                            <Badge variant="outline" className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${actionInfo.colorClass}`}>
                              <ActionIcon className="h-3.5 w-3.5" />
                              {actionInfo.label}
                            </Badge>
                          </TableCell>

                          <TableCell className="py-4 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-800 text-xs">{formatEntityType(log.entityType)}</div>
                            <div className="text-xs font-black text-teal-800">{formatEntityName(log.entityName, log.entityType)}</div>
                          </TableCell>

                          <TableCell className="max-w-xs md:max-w-md py-4 px-4">
                            <div className="text-xs font-bold text-slate-900 leading-snug">
                              {formatDescription(log.description)}
                            </div>
                          </TableCell>

                          <TableCell className="py-4 px-4 whitespace-nowrap">
                            {getSeverityBadge(log.severity)}
                          </TableCell>

                          <TableCell className="py-4 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedLog(log)}
                                className="h-8 px-2.5 text-teal-800 hover:bg-teal-100/80 rounded-xl font-bold"
                              >
                                <Eye className="h-4 w-4 ml-1" />
                                التفاصيل
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => exportSingleLogToPDF(log)}
                                className="h-8 px-2.5 text-rose-800 hover:bg-rose-100/80 rounded-xl font-bold"
                                title="تصدير العملية PDF"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-16">
                <FileText className="h-16 w-16 mx-auto text-slate-300 mb-3" />
                <h3 className="text-lg font-bold text-slate-700">لا توجد سجلات مطابقة</h3>
                <p className="text-slate-500 text-sm mt-1">جرب تغيير معايير البحث أو اختيار "جميع العمليات"</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Expanded Log Details Modal */}
      <AnimatePresence>
        {selectedLog && (
          <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
            <DialogContent className="max-w-3xl dir-rtl text-right rounded-3xl p-6 bg-white border-slate-200 shadow-2xl">
              <DialogHeader className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-teal-500/10 text-teal-600 rounded-2xl">
                      <Terminal className="h-6 w-6" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-black text-slate-900">
                        تفاصيل سجل الرقابة والنظام
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500 font-mono mt-0.5">
                        معرف الإجراء الرقمي: {selectedLog.id}
                      </DialogDescription>
                    </div>
                  </div>
                  <div>
                    {(() => {
                      const act = formatActionDetails(selectedLog.action);
                      const Icon = act.Icon;
                      return (
                        <Badge variant="outline" className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm ${act.colorClass}`}>
                          <Icon className="h-4 w-4" />
                          {act.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 py-4">

                {/* Responsible Official Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                      {selectedLog.userName ? selectedLog.userName.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">المسؤول عن العملية</span>
                      <h4 className="text-lg font-extrabold text-slate-900">{formatUserName(selectedLog.userName)}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600">
                        <Badge variant="outline" className="bg-white border-slate-300 font-bold">{formatUserRole(selectedLog.userRole)}</Badge>
                        {selectedLog.userId && <span className="font-mono text-slate-400">ID: {selectedLog.userId.slice(0, 8)}...</span>}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleNavigateToUser(selectedLog.userId)}
                    className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold px-4 shadow-sm"
                  >
                    <User className="ml-1.5 h-4 w-4" />
                    الوصول لملف المسؤول عن العملية
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5 opacity-70" />
                  </Button>
                </div>

                {/* Target Entity & Execution Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                    <span className="text-xs font-bold text-slate-400 block">الكيان / العنصر المتأثر</span>
                    <div className="font-extrabold text-slate-900 text-base">{formatEntityName(selectedLog.entityName, selectedLog.entityType)}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>التصنيف المترجم:</span>
                      <Badge variant="outline" className="bg-slate-100 font-bold">{formatEntityType(selectedLog.entityType)}</Badge>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                    <span className="text-xs font-bold text-slate-400 block">تاريخ وحالة الإجراء</span>
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      {selectedLog.createdAt ? format(new Date(selectedLog.createdAt), "yyyy/MM/dd - HH:mm:ss", { locale: ar }) : "-"}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">نتيجة التنفيذ:</span>
                      {selectedLog.success ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                          <CheckCircle2 className="ml-1 h-3.5 w-3.5" /> ناجحة ومكتملة
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold">
                          <AlertCircle className="ml-1 h-3.5 w-3.5" /> مرفوضة / خطأ
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description Box */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5">
                  <span className="text-xs font-bold text-slate-400 block">بيان الوصف الميداني الإداري (مترجم)</span>
                  <p className="text-slate-900 font-bold text-sm leading-relaxed">
                    {formatDescription(selectedLog.description)}
                  </p>
                </div>

                {/* System Technical Details */}
                {selectedLog.details && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-500 block flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5 text-teal-600" />
                      بصمة النظام والبيانات التقنية (Technical Metadata)
                    </span>
                    <div className="bg-slate-900 text-teal-300 font-mono dir-ltr text-xs p-4 rounded-2xl max-h-48 overflow-y-auto whitespace-pre-wrap border border-slate-800 shadow-inner">
                      {(() => {
                        try {
                          const parsed = typeof selectedLog.details === "string" ? JSON.parse(selectedLog.details) : selectedLog.details;
                          return JSON.stringify(parsed, null, 2);
                        } catch (e) {
                          return selectedLog.details;
                        }
                      })()}
                    </div>
                  </div>
                )}

              </div>

              <DialogFooter className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <Button
                  onClick={() => exportSingleLogToPDF(selectedLog)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl w-full sm:w-auto shadow-sm"
                >
                  <Printer className="ml-2 h-4 w-4" />
                  تصدير تقرير العملية بصيغة PDF
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-xl w-full sm:w-auto border-slate-300 text-slate-700"
                >
                  إغلاق النافذة
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
