import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Heart,
  Database,
  ArrowRightLeft,
  AlertTriangle,
  Clock,
  RefreshCw,
  Server,
  Layers,
  Search,
  CheckCircle,
  XCircle,
  FileCode,
  ShieldCheck
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface HealthStatus {
  status: string;
  details: {
    database: boolean;
    subscribers: boolean;
    outboxWorker: boolean;
    featureFlags: boolean;
  };
}

interface SpanInfo {
  id: string;
  name: string;
  parentId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes?: Record<string, any>;
  status: "UNFINISHED" | "OK" | "ERROR";
}

export default function CourierObservabilityPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshInterval, setRefreshInterval] = useState<number>(3000); // 3 seconds live poll

  const { data: health, refetch: refetchHealth } = useQuery<HealthStatus>({
    queryKey: ["/health/ready"],
    queryFn: () => fetch("/health/ready").then((r) => r.json()),
    refetchInterval: refreshInterval,
  });

  const { data: rawMetrics, refetch: refetchMetrics } = useQuery<Record<string, number>>({
    queryKey: ["/api/observability/metrics"],
    queryFn: () => fetch("/api/observability/metrics").then((r) => r.json()),
    refetchInterval: refreshInterval,
  });

  const { data: spans, refetch: refetchSpans } = useQuery<SpanInfo[]>({
    queryKey: ["/api/observability/spans"],
    queryFn: () => fetch("/api/observability/spans").then((r) => r.json()),
    refetchInterval: refreshInterval,
  });

  // Calculate stats from metrics
  const outboxPending = rawMetrics?.outbox_pending_total ?? 0;
  const outboxDead = rawMetrics?.outbox_dead_total ?? 0;
  const sagaCompensations = rawMetrics?.saga_compensations_total ?? 0;
  const subscriberFailures = rawMetrics?.subscriber_failures_total ?? 0;
  const idempotencyHits = rawMetrics?.idempotency_hits_total ?? 0;
  const idempotencyMisses = rawMetrics?.idempotency_misses_total ?? 0;

  // Search filter for spans
  const filteredSpans = spans?.filter((span) => {
    const term = searchTerm.toLowerCase();
    return (
      span.name.toLowerCase().includes(term) ||
      span.id.toLowerCase().includes(term) ||
      (span.attributes?.requestId && String(span.attributes.requestId).includes(term)) ||
      (span.attributes?.technicianCode && String(span.attributes.technicianCode).toLowerCase().includes(term))
    );
  }) || [];

  // Group spans for chart visualization
  const spanChartData = (spans || [])
    .slice(0, 10)
    .reverse()
    .map((s) => ({
      name: s.name.replace("EventProcessing:", "").replace("API:", ""),
      duration: s.duration || 0,
      status: s.status,
    }));

  return (
    <div className="space-y-6 p-6 min-h-screen bg-slate-950 text-slate-100">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 via-emerald-400 to-indigo-500 bg-clip-text text-transparent flex items-center gap-3">
            <Activity className="w-8 h-8 text-teal-400 animate-pulse" />
            Enterprise Observability & Telemetry
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time health, distributed tracing spans, and operational metric indicators.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-teal-500/30 text-teal-400 bg-teal-950/20 px-3 py-1 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Monitoring
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
            onClick={() => {
              refetchHealth();
              refetchMetrics();
              refetchSpans();
            }}
          >
            <RefreshCw className="w-4 h-4 ml-1.5" />
            تحديث
          </Button>
        </div>
      </div>

      {/* Health & Dependency Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Health Status */}
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" />
              حالة الجاهزية (Readiness)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {health?.status === "UP" ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-xl flex items-center gap-2 w-full justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                  <span className="text-lg font-bold">READY / UP</span>
                </div>
              ) : (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2.5 rounded-xl flex items-center gap-2 w-full justify-center">
                  <XCircle className="w-6 h-6 text-rose-400" />
                  <span className="text-lg font-bold">DOWN</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Database Check */}
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              قاعدة البيانات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-450">PostgreSQL Connection</span>
              <Badge className={health?.details?.database ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}>
                {health?.details?.database ? "مكتمل" : "غير متصل"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Subscribers & Outbox Worker */}
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              النواقل والعمال (Workers)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Subscribers Registered</span>
              <span className={health?.details?.subscribers ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {health?.details?.subscribers ? "Active" : "Offline"}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Outbox Worker Loop</span>
              <span className={health?.details?.outboxWorker ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {health?.details?.outboxWorker ? "Active" : "Offline"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              التحقق والتكوين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-450">Feature Flags Loaded</span>
              <Badge className={health?.details?.featureFlags ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}>
                {health?.details?.featureFlags ? "مكتمل" : "قيد التحميل"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Outbox */}
        <Card className="bg-slate-900/40 border-slate-850 hover:border-slate-800 transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Outbox Events</p>
                <h3 className="text-3xl font-extrabold text-white mt-2">{outboxPending}</h3>
              </div>
              <div className={`p-2.5 rounded-lg ${outboxPending > 10 ? "bg-amber-500/10 text-amber-400" : "bg-slate-800 text-slate-400"}`}>
                <ArrowRightLeft className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${outboxPending > 10 ? "bg-amber-500" : "bg-teal-500"}`}
                  style={{ width: `${Math.min(100, outboxPending * 5)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">أحداث Outbox قيد الانتظار للنشر</p>
            </div>
          </CardContent>
        </Card>

        {/* Dead Letter Queue */}
        <Card className="bg-slate-900/40 border-slate-850 hover:border-slate-800 transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dead Letter Events (DEAD)</p>
                <h3 className={`text-3xl font-extrabold mt-2 ${outboxDead > 0 ? "text-rose-500" : "text-white"}`}>
                  {outboxDead}
                </h3>
              </div>
              <div className={`p-2.5 rounded-lg ${outboxDead > 0 ? "bg-rose-500/15 text-rose-500 animate-pulse" : "bg-slate-800 text-slate-400"}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-slate-500 flex items-center gap-1">
                {outboxDead > 0 ? (
                  <span className="text-rose-450 font-medium">⚠️ توجد أحداث فاشلة بحاجة للتدقيق!</span>
                ) : (
                  <span className="text-slate-450">لا توجد أحداث Dead حالياً</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Saga Compensations */}
        <Card className="bg-slate-900/40 border-slate-850 hover:border-slate-800 transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Saga Compensations</p>
                <h3 className={`text-3xl font-extrabold mt-2 ${sagaCompensations > 0 ? "text-yellow-500" : "text-white"}`}>
                  {sagaCompensations}
                </h3>
              </div>
              <div className={`p-2.5 rounded-lg ${sagaCompensations > 0 ? "bg-yellow-500/10 text-yellow-400" : "bg-slate-800 text-slate-400"}`}>
                <RefreshCw className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[10px] text-slate-500">معدل التعويض لعمليات الجرد الفاشلة</p>
            </div>
          </CardContent>
        </Card>

        {/* Subscriber Errors */}
        <Card className="bg-slate-900/40 border-slate-850 hover:border-slate-800 transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subscriber Failures</p>
                <h3 className={`text-3xl font-extrabold mt-2 ${subscriberFailures > 0 ? "text-rose-400" : "text-white"}`}>
                  {subscriberFailures}
                </h3>
              </div>
              <div className={`p-2.5 rounded-lg ${subscriberFailures > 0 ? "bg-rose-500/10 text-rose-400" : "bg-slate-800 text-slate-400"}`}>
                <Server className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[10px] text-slate-500">أخطاء معالجة المشتركين للأحداث</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Idempotency Hit/Miss and Latency Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency Chart */}
        <Card className="lg:col-span-2 bg-slate-900/40 border-slate-850 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-350 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              Latency of Recent Spans (ms)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {spanChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spanChartData}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155" }}
                      labelStyle={{ color: "#f8fafc" }}
                    />
                    <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
                      {spanChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.status === "ERROR" ? "#f43f5e" : "#0d9488"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-slate-500 text-xs">
                لا توجد بيانات كافية لرسم المنحنى البياني
              </div>
            )}
          </CardContent>
        </Card>

        {/* Idempotency Audit */}
        <Card className="bg-slate-900/40 border-slate-850 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-350 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              توزيع تكرار الطلبات (Idempotency)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 block mb-1">Idempotency Hits</span>
                <span className="text-2xl font-bold text-emerald-400">{idempotencyHits}</span>
              </div>
              <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 block mb-1">Idempotency Misses</span>
                <span className="text-2xl font-bold text-slate-300">{idempotencyMisses}</span>
              </div>
            </div>

            {/* Hit ratio calculation */}
            {idempotencyHits + idempotencyMisses > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">كفاءة منع التكرار</span>
                  <span className="text-emerald-400 font-semibold">
                    {Math.round((idempotencyHits / (idempotencyHits + idempotencyMisses)) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{ width: `${(idempotencyHits / (idempotencyHits + idempotencyMisses)) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trace Spans Table */}
      <Card className="bg-slate-900/40 border-slate-850 backdrop-blur-xl">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <FileCode className="w-5 h-5 text-teal-400" />
            Distributed Spans & Traces
          </CardTitle>

          <div className="relative w-full sm:w-72">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-450" />
            <Input
              placeholder="ابحث بالاسم، ID، أو الكود..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9 bg-slate-900 border-slate-800 text-slate-200 placeholder:text-slate-500 w-full"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredSpans.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-slate-900/30">
                    <TableHead className="text-slate-400 text-right w-1/4">العملية / Span Name</TableHead>
                    <TableHead className="text-slate-400 text-right">Span ID</TableHead>
                    <TableHead className="text-slate-400 text-right">Parent ID</TableHead>
                    <TableHead className="text-slate-400 text-right">المستغرق (ms)</TableHead>
                    <TableHead className="text-slate-400 text-right">الحالة</TableHead>
                    <TableHead className="text-slate-400 text-right">سمات إضافية (Metadata)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSpans.map((span) => (
                    <TableRow key={span.id} className="border-slate-850 hover:bg-slate-905 text-slate-100">
                      <TableCell className="font-semibold text-slate-200 text-sm">
                        {span.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-400">{span.id}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{span.parentId || "-"}</TableCell>
                      <TableCell className="font-mono text-sm text-teal-400">
                        {span.duration ? `${span.duration}ms` : "Active"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            span.status === "ERROR"
                              ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                              : span.status === "OK"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-slate-800 border-slate-700 text-slate-400"
                          }
                        >
                          {span.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-slate-400">
                        {span.attributes ? JSON.stringify(span.attributes) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              لا توجد Spans نشطة أو مطابقة للبحث في الذاكرة حالياً.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
