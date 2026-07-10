import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
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
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { SystemLog } from "@shared/schema";
import { exportSystemLogsToExcel } from "@/lib/exportToExcel";
import { useToast } from "@/hooks/use-toast";

export default function SystemLogsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntityType, setFilterEntityType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const { data: logs, isLoading } = useQuery<SystemLog[]>({
    queryKey: ["/api/system-logs"],
  });

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      searchTerm === "" ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entityName && log.entityName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAction = filterAction === "all" || log.action === filterAction;
    const matchesEntityType = filterEntityType === "all" || log.entityType === filterEntityType;
    const matchesSeverity = filterSeverity === "all" || log.severity === filterSeverity;

    return matchesSearch && matchesAction && matchesEntityType && matchesSeverity;
  });

  const handleExportExcel = async () => {
    const rows = filteredLogs || [];

    if (rows.length === 0) {
      toast({
        variant: "destructive",
        title: "لا توجد بيانات",
        description: "لا توجد سجلات لتصديرها",
      });
      return;
    }

    await exportSystemLogsToExcel({ logs: rows });
    toast({
      title: "تم التصدير بنجاح",
      description: "تم تصدير سجل عمليات النظام إلى ملف Excel",
    });
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="destructive" className="flex items-center gap-1" data-testid="badge-severity-error"><AlertCircle className="h-3 w-3" />خطأ</Badge>;
      case "warn":
        return <Badge variant="outline" className="flex items-center gap-1 border-yellow-500/50 text-yellow-400 bg-yellow-500/10" data-testid="badge-severity-warn"><AlertTriangle className="h-3 w-3" />تحذير</Badge>;
      default:
        return <Badge variant="outline" className="flex items-center gap-1 border-[#18B2B0]/50 text-[#18B2B0] bg-[#18B2B0]/10" data-testid="badge-severity-info"><Info className="h-3 w-3" />معلومة</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      create: { label: "إنشاء", color: "bg-green-500/10 text-green-400 border-green-500/30" },
      update: { label: "تحديث", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
      delete: { label: "حذف", color: "bg-red-500/10 text-red-400 border-red-500/30" },
      approve: { label: "موافقة", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
      reject: { label: "رفض", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
      transfer: { label: "نقل", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
      login: { label: "تسجيل دخول", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
      logout: { label: "تسجيل خروج", color: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
    };

    const badge = badges[action] || { label: action, color: "bg-gray-500/10 text-gray-400 border-gray-500/30" };
    return <Badge variant="outline" className={badge.color} data-testid={`badge-action-${action}`}>{badge.label}</Badge>;
  };

  const getEntityTypeBadge = (entityType: string) => {
    const types: Record<string, string> = {
      region: "منطقة",
      user: "مستخدم",
      inventory: "مخزون",
      warehouse: "مستودع",
      request: "طلب",
      transfer: "نقل",
      auth: "مصادقة",
      device: "جهاز",
    };

    return types[entityType] || entityType;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <Link href="/home">
              <Button
                variant="outline"
                className="border-[#18B2B0]/30 text-[#18B2B0] hover:bg-[#18B2B0]/10"
                data-testid="button-back"
              >
                <ArrowLeft className="ml-2 h-4 w-4" />
                العودة
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Activity className="h-8 w-8 text-[#18B2B0]" />
                سجل عمليات النظام
              </h1>
              <p className="text-gray-400 text-sm">متابعة جميع العمليات والأحداث في النظام</p>
            </div>
          </div>

          <Button
            variant="outline"
            className="border-[#18B2B0]/30 text-[#18B2B0] hover:bg-[#18B2B0]/10"
            onClick={handleExportExcel}
            data-testid="button-export-system-logs-excel"
          >
            <Download className="ml-2 h-4 w-4" />
            تصدير Excel
          </Button>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-[#1a1a1f]/80 to-[#25252b]/80 border-[#18B2B0]/30 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Filter className="h-5 w-5 text-[#18B2B0]" />
                البحث والتصفية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="ابحث في السجلات..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-500"
                    data-testid="input-search"
                  />
                </div>

                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white" data-testid="select-action">
                    <SelectValue placeholder="نوع العملية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع العمليات</SelectItem>
                    <SelectItem value="create">إنشاء</SelectItem>
                    <SelectItem value="update">تحديث</SelectItem>
                    <SelectItem value="delete">حذف</SelectItem>
                    <SelectItem value="approve">موافقة</SelectItem>
                    <SelectItem value="reject">رفض</SelectItem>
                    <SelectItem value="transfer">نقل</SelectItem>
                    <SelectItem value="login">تسجيل دخول</SelectItem>
                    <SelectItem value="logout">تسجيل خروج</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                  <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white" data-testid="select-entity">
                    <SelectValue placeholder="نوع الكيان" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الكيانات</SelectItem>
                    <SelectItem value="region">منطقة</SelectItem>
                    <SelectItem value="user">مستخدم</SelectItem>
                    <SelectItem value="inventory">مخزون</SelectItem>
                    <SelectItem value="warehouse">مستودع</SelectItem>
                    <SelectItem value="request">طلب</SelectItem>
                    <SelectItem value="transfer">نقل</SelectItem>
                    <SelectItem value="auth">مصادقة</SelectItem>
                    <SelectItem value="device">جهاز</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white" data-testid="select-severity">
                    <SelectValue placeholder="المستوى" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المستويات</SelectItem>
                    <SelectItem value="info">معلومة</SelectItem>
                    <SelectItem value="warn">تحذير</SelectItem>
                    <SelectItem value="error">خطأ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Logs Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-[#1a1a1f]/80 to-[#25252b]/80 border-[#18B2B0]/30 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#18B2B0]" />
                السجلات ({filteredLogs?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full bg-gray-800/50" />
                  ))}
                </div>
              ) : filteredLogs && filteredLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700 hover:bg-gray-800/50">
                        <TableHead className="text-gray-300 text-right">التاريخ</TableHead>
                        <TableHead className="text-gray-300 text-right">المستخدم</TableHead>
                        <TableHead className="text-gray-300 text-right">العملية</TableHead>
                        <TableHead className="text-gray-300 text-right">الكيان</TableHead>
                        <TableHead className="text-gray-300 text-right">الوصف</TableHead>
                        <TableHead className="text-gray-300 text-right">المستوى</TableHead>
                        <TableHead className="text-gray-300 text-right">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow
                          key={log.id}
                          className="border-gray-700 hover:bg-gray-800/50 text-white"
                          data-testid={`row-log-${log.id}`}
                        >
                          <TableCell className="font-mono text-sm text-gray-300">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-[#18B2B0]" />
                              {log.createdAt ? format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: ar }) : "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.userName}</div>
                              <div className="text-xs text-gray-400">{log.userRole}</div>
                            </div>
                          </TableCell>
                          <TableCell>{getActionBadge(log.action)}</TableCell>
                          <TableCell>
                            <div className="text-gray-300">{getEntityTypeBadge(log.entityType)}</div>
                            {log.entityName && <div className="text-xs text-gray-500">{log.entityName}</div>}
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="text-gray-300">{log.description}</div>
                          </TableCell>
                          <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                          <TableCell>
                            {log.success ? (
                              <CheckCircle2 className="h-5 w-5 text-green-400" data-testid="icon-success" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-red-400" data-testid="icon-failure" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 mx-auto text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-400">لا توجد سجلات</h3>
                  <p className="text-gray-500 mt-2">لم يتم العثور على أي سجلات تطابق المعايير المحددة</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
