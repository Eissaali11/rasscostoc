import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  Search,
  Key,
  Users,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  MapPin,
  RefreshCw,
  Lock,
  Unlock,
  Trash2,
  ShieldAlert
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface UserSummary {
  userId: string;
  userName: string;
  userRole: string;
  scrapesCount: number;
  leadsFetched: number;
  newLeadsFetched: number;
  lastScrapeAt: string;
  apiKeysUsed: string[];
  isBlocked?: boolean;
}

interface ApiKeySummary {
  maskedKey: string;
  scrapesCount: number;
  leadsFetched: number;
  users: string[];
}

interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  apiKey: string;
  maskedKey: string;
  searchMode: string;
  regionName: string;
  leadsFound: number;
  newLeadsCount: number;
  createdAt: string;
}

interface AuditSummaryResponse {
  totalScrapes: number;
  totalLeadsFetched: number;
  totalNewLeads: number;
  blockedUserCount?: number;
  userSummaries: UserSummary[];
  apiKeysSummary: ApiKeySummary[];
  recentLogs: AuditLogEntry[];
}

export default function LeadDiscoveryAuditPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<AuditSummaryResponse>({
    queryKey: ["/api/leads/discovery/audit-summary"],
    refetchInterval: 20000,
  });

  // Access toggle mutation (Block / Allow)
  const toggleAccessMutation = useMutation({
    mutationFn: async ({ userName, userId, allow }: { userName: string; userId: string; allow: boolean }) => {
      const res = await apiRequest("POST", "/api/leads/discovery/toggle-user-access", { userName, userId, allow });
      return res.json();
    },
    onSuccess: (res) => {
      toast({
        title: "تم تحديث الصلاحية بنجاح",
        description: res.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/discovery/audit-summary"] });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "خطأ في تعديل الصلاحية",
        description: err?.message || "حدث خطأ غير متوقع",
      });
    },
  });

  // Clear user leads mutation
  const clearUserLeadsMutation = useMutation({
    mutationFn: async ({ userName, userId }: { userName: string; userId: string }) => {
      const res = await apiRequest("POST", "/api/leads/discovery/clear-user-leads", { userName, userId });
      return res.json();
    },
    onSuccess: (res) => {
      toast({
        title: "تم الحذف بنجاح",
        description: res.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/discovery/audit-summary"] });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "خطأ أثناء الحذف",
        description: err?.message || "حدث خطأ غير متوقع",
      });
    },
  });

  const handleToggleAccess = (user: UserSummary) => {
    const nextAllow = !!user.isBlocked;
    const actionText = nextAllow ? "السماح بالسحب" : "حظر وإغلاق السحب واستهلاك المفتاح";
    if (window.confirm(`هل أنت متأكد من (${actionText}) للحساب: ${user.userName}؟`)) {
      toggleAccessMutation.mutate({ userName: user.userName, userId: user.userId, allow: nextAllow });
    }
  };

  const handleClearUserLeads = (user: UserSummary) => {
    if (window.confirm(`⚠️ تحذير: هل أنت متأكد من حذف جميع العملاء المسحوبين وسجلات الحركة للحساب: (${user.userName})؟`)) {
      clearUserLeadsMutation.mutate({ userName: user.userName, userId: user.userId });
    }
  };

  const filteredUserSummaries = data?.userSummaries.filter((u) =>
    searchTerm === "" ||
    u.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.apiKeysUsed.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredLogs = data?.recentLogs.filter((log) =>
    searchTerm === "" ||
    log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.maskedKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.regionName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFB] p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
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
              >
                <ArrowLeft className="ml-2 h-4 w-4" />
                الرئيسية
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2D3135] flex items-center gap-2">
                <Key className="h-8 w-8 text-[#18B2B0]" />
                سجل تتبع واستهلاك المفاتيح والتحكم بالحسابات
              </h1>
              <p className="text-[#6B7280] text-sm">
                التحكم في صلاحية سحب العملاء وحظر/تفعيل الحسابات وحذف سحبيات المستخدمين
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="border-[#18B2B0] text-[#18B2B0] hover:bg-[#18B2B0]/10"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`ml-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            تحديث البيانات
          </Button>
        </motion.div>

        {isError && (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-6 text-center space-y-3">
              <ShieldAlert className="h-10 w-10 text-red-500 mx-auto" />
              <h3 className="text-lg font-bold text-red-700">تعذر تحميل بيانات سجل التتبع</h3>
              <p className="text-sm text-red-600 max-w-md mx-auto">
                {(error as any)?.message || "قد تكون انتهت الجلسة أو ليس لديك الصلاحية الكافية للوصول إلى هذه الصفحة."}
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" onClick={() => refetch()}>
                  <RefreshCw className="ml-2 h-4 w-4" />
                  إعادة المحاولة
                </Button>
                <Link href="/login">
                  <Button className="bg-[#18B2B0] hover:bg-[#149D9B] text-white">
                    تسجيل الدخول
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rassco-glass rassco-glass-static border-r-4 border-r-[#18B2B0]">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-[#6B7280] text-sm font-medium">إجمالي عمليات السحب</p>
                <h3 className="text-2xl font-bold text-[#2D3135] mt-1">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : data?.totalScrapes || 0}
                </h3>
              </div>
              <div className="p-3 bg-[#18B2B0]/10 rounded-xl text-[#18B2B0]">
                <Layers className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rassco-glass rassco-glass-static border-r-4 border-r-[#3B82F6]">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-[#6B7280] text-sm font-medium">العملاء المسحوبين</p>
                <h3 className="text-2xl font-bold text-[#2D3135] mt-1">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : data?.totalLeadsFetched || 0}
                </h3>
              </div>
              <div className="p-3 bg-[#3B82F6]/10 rounded-xl text-[#3B82F6]">
                <Building2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rassco-glass rassco-glass-static border-r-4 border-r-[#10B981]">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-[#6B7280] text-sm font-medium">الفنيين المستخدِمين للمفتاح</p>
                <h3 className="text-2xl font-bold text-[#2D3135] mt-1">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : data?.userSummaries.length || 0}
                </h3>
              </div>
              <div className="p-3 bg-[#10B981]/10 rounded-xl text-[#10B981]">
                <Users className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rassco-glass rassco-glass-static border-r-4 border-r-[#EF4444]">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-[#6B7280] text-sm font-medium">الحسابات المحظورة من السحب</p>
                <h3 className="text-2xl font-bold text-[#EF4444] mt-1">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : data?.blockedUserCount || 0}
                </h3>
              </div>
              <div className="p-3 bg-[#EF4444]/10 rounded-xl text-[#EF4444]">
                <ShieldAlert className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Input */}
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-3 h-4 w-4 text-[#9AA1AB]" />
          <Input
            placeholder="بحث باسم الفني، المفتاح، أو المنطقة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 bg-white border-[#E6E8EC] text-[#2D3135] placeholder:text-[#9AA1AB]"
          />
        </div>

        {/* Table 1: Per-User Scrape Usage Summary & Access Control */}
        <Card className="rassco-glass rassco-glass-static">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-[#2D3135] flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-[#18B2B0]" />
              إدارة صلاحيات الفنيين وحذف السحبيات
            </CardTitle>
            <Badge variant="outline" className="bg-[#18B2B0]/10 text-[#149D9B] border-[#18B2B0]/30">
              {filteredUserSummaries?.length || 0} مستخدم
            </Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-[#F3F4F6]" />
                ))}
              </div>
            ) : filteredUserSummaries && filteredUserSummaries.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#E6E8EC]">
                      <TableHead className="text-right">اسم الفني / المستخدم</TableHead>
                      <TableHead className="text-right">حالة الصلاحية</TableHead>
                      <TableHead className="text-right">عدد عمليات السحب</TableHead>
                      <TableHead className="text-right">إجمالي العملاء المكتشفين</TableHead>
                      <TableHead className="text-right">المفاتيح المستخدَمة</TableHead>
                      <TableHead className="text-right">الإجراءات والتحكم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUserSummaries.map((user) => (
                      <TableRow key={user.userName} className="hover:bg-[#F8FAFB]">
                        <TableCell className="font-bold text-[#2D3135]">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-[#18B2B0]/15 flex items-center justify-center text-[#18B2B0] font-bold text-xs">
                              {user.userName.substring(0, 2)}
                            </div>
                            {user.userName}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.isBlocked ? (
                            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 gap-1 font-bold">
                              <Lock className="h-3 w-3" />
                              محظور من السحب
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 gap-1 font-bold">
                              <Unlock className="h-3 w-3" />
                              مُصرّح له
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-[#18B2B0]">
                          {user.scrapesCount} عملية
                        </TableCell>
                        <TableCell className="font-bold text-[#2D3135]">
                          {user.leadsFetched} عميل ({user.newLeadsFetched} جديد)
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.apiKeysUsed.map((k) => (
                              <Badge key={k} variant="outline" className="font-mono text-xs bg-amber-50 text-amber-700 border-amber-200">
                                {k}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className={user.isBlocked
                                ? "border-emerald-500 text-emerald-600 hover:bg-emerald-50 text-xs"
                                : "border-red-500 text-red-600 hover:bg-red-50 text-xs"
                              }
                              onClick={() => handleToggleAccess(user)}
                              disabled={toggleAccessMutation.isPending}
                            >
                              {user.isBlocked ? (
                                <>
                                  <Unlock className="ml-1 h-3.5 w-3.5" />
                                  تفعيل السحب
                                </>
                              ) : (
                                <>
                                  <Lock className="ml-1 h-3.5 w-3.5" />
                                  حظر السحب
                                </>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-600 text-xs"
                              onClick={() => handleClearUserLeads(user)}
                              disabled={clearUserLeadsMutation.isPending}
                            >
                              <Trash2 className="ml-1 h-3.5 w-3.5" />
                              حذف سحبياته
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-[#6B7280]">
                لا توجد سجلات سحب للمستخدمين حالياً
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table 2: Detailed Audit Activity Logs */}
        <Card className="rassco-glass rassco-glass-static">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-[#2D3135] flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-[#18B2B0]" />
              سجل الحركات الميدانية الحية (Live Scrape Log)
            </CardTitle>
            <Badge variant="outline" className="bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30">
              أحدث {filteredLogs?.length || 0} عملية
            </Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-[#F3F4F6]" />
                ))}
              </div>
            ) : filteredLogs && filteredLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#E6E8EC]">
                      <TableHead className="text-right">التاريخ والوقت</TableHead>
                      <TableHead className="text-right">المستخدم</TableHead>
                      <TableHead className="text-right">المفتاح المستخدَم</TableHead>
                      <TableHead className="text-right">نوع البحث والمنطقة</TableHead>
                      <TableHead className="text-right">العملاء المسحوبين</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-[#F8FAFB]">
                        <TableCell className="font-mono text-xs text-[#6B7280]">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-[#18B2B0]" />
                            {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ar })}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-[#2D3135]">
                          {log.userName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs bg-slate-100 text-slate-800 border-slate-300">
                            <Key className="ml-1 h-3 w-3 text-amber-600 inline" />
                            {log.maskedKey}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-[#4B5563]">
                            <MapPin className="h-3.5 w-3.5 text-red-500" />
                            <span className="font-semibold">{log.regionName}</span>
                            <span className="text-gray-400">({log.searchMode})</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            +{log.leadsFound} عميل ({log.newLeadsCount} جديد)
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-[#6B7280]">
                لا توجد حركات سحب عملاء تفصيلية مسجلة بعد
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
