import { useTranslation } from "@/lib/language";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
  ShieldCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
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

const glass = "rassco-glass rassco-glass-static";

export default function CourierObservabilityPage() {
  const { t, dir } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshInterval] = useState<number>(3000);

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

  const outboxPending = rawMetrics?.outbox_pending_total ?? 0;
  const outboxDead = rawMetrics?.outbox_dead_total ?? 0;
  const sagaCompensations = rawMetrics?.saga_compensations_total ?? 0;
  const subscriberFailures = rawMetrics?.subscriber_failures_total ?? 0;
  const idempotencyHits = rawMetrics?.idempotency_hits_total ?? 0;
  const idempotencyMisses = rawMetrics?.idempotency_misses_total ?? 0;

  const filteredSpans =
    spans?.filter((span) => {
      const term = searchTerm.toLowerCase();
      return (
        span.name.toLowerCase().includes(term) ||
        span.id.toLowerCase().includes(term) ||
        (span.attributes?.requestId && String(span.attributes.requestId).includes(term)) ||
        (span.attributes?.technicianCode &&
          String(span.attributes.technicianCode).toLowerCase().includes(term))
      );
    }) || [];

  const spanChartData = (spans || [])
    .slice(0, 10)
    .reverse()
    .map((s) => ({
      name: s.name.replace("EventProcessing:", "").replace("API:", ""),
      duration: s.duration || 0,
      status: s.status,
    }));

  return (
    <div dir={dir} className="rassco-page space-y-6 p-1">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${glass} p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#2D3135] flex items-center gap-3">
            <span className="size-11 rounded-2xl bg-[#18B2B0]/12 text-[#18B2B0] flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </span>
            Enterprise Observability
          </h1>
          <p className="text-[#6B7280] text-sm mt-2 font-medium">
            Real-time health, distributed tracing spans, and operational metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="border-[#18B2B0]/30 text-[#18B2B0] bg-[#18B2B0]/10 px-3 py-1.5 flex items-center gap-1.5 rounded-full font-bold"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#18B2B0] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#18B2B0]" />
            </span>
            Live Monitoring
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="rounded-2xl border-[rgba(24,178,176,0.2)] bg-white/70 text-[#2D3135] hover:border-[#18B2B0] hover:text-[#18B2B0]"
            onClick={() => {
              refetchHealth();
              refetchMetrics();
              refetchSpans();
            }}
          >
            <RefreshCw className="w-4 h-4 me-1.5" />
            {t("courier.update")}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className={`${glass} p-5`}>
          <div className="text-sm font-semibold text-[#6B7280] flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-[#E05252]" />
            {t("courier.status_2")}
          </div>
          {health?.status === "UP" ? (
            <div className="bg-[#18B2B0]/10 border border-[#18B2B0]/25 text-[#18B2B0] p-3 rounded-2xl flex items-center gap-2 justify-center">
              <CheckCircle className="w-5 h-5" />
              <span className="text-base font-extrabold">READY / UP</span>
            </div>
          ) : (
            <div className="bg-[#E05252]/10 border border-[#E05252]/25 text-[#E05252] p-3 rounded-2xl flex items-center gap-2 justify-center">
              <XCircle className="w-5 h-5" />
              <span className="text-base font-extrabold">DOWN</span>
            </div>
          )}
        </div>

        <div className={`${glass} p-5`}>
          <div className="text-sm font-semibold text-[#6B7280] flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-[#18B2B0]" />
            {t("courier.data_1")}
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs text-[#6B7280] font-medium">PostgreSQL Connection</span>
            <Badge
              className={
                health?.details?.database
                  ? "bg-[#18B2B0]/12 text-[#18B2B0] border-[#18B2B0]/25"
                  : "bg-[#E05252]/10 text-[#E05252] border-[#E05252]/25"
              }
            >
              {health?.details?.database ? t("courier.completed_5") : t("courier.item_11197")}
            </Badge>
          </div>
        </div>

        <div className={`${glass} p-5 space-y-2`}>
          <div className="text-sm font-semibold text-[#6B7280] flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-[#18B2B0]" />
            {t("courier.workers")}
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#6B7280]">Subscribers Registered</span>
            <span className={`font-bold ${health?.details?.subscribers ? "text-[#18B2B0]" : "text-[#E05252]"}`}>
              {health?.details?.subscribers ? "Active" : "Offline"}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#6B7280]">Outbox Worker Loop</span>
            <span className={`font-bold ${health?.details?.outboxWorker ? "text-[#18B2B0]" : "text-[#E05252]"}`}>
              {health?.details?.outboxWorker ? "Active" : "Offline"}
            </span>
          </div>
        </div>

        <div className={`${glass} p-5`}>
          <div className="text-sm font-semibold text-[#6B7280] flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-[#18B2B0]" />
            {t("courier.verification")}
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs text-[#6B7280] font-medium">Feature Flags Loaded</span>
            <Badge
              className={
                health?.details?.featureFlags
                  ? "bg-[#18B2B0]/12 text-[#18B2B0] border-[#18B2B0]/25"
                  : "bg-[#F4B740]/15 text-[#B8860B] border-[#F4B740]/35"
              }
            >
              {health?.details?.featureFlags ? t("courier.completed_5") : t("courier.pending_loading")}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Pending Outbox Events",
            value: outboxPending,
            icon: ArrowRightLeft,
            warn: outboxPending > 10,
            hint: t("courier.pending_waiting"),
            bar: Math.min(100, outboxPending * 5),
          },
          {
            title: "Dead Letter Events (DEAD)",
            value: outboxDead,
            icon: AlertTriangle,
            warn: outboxDead > 0,
            danger: outboxDead > 0,
            hint: outboxDead > 0 ? t("courier.item_116375") : t("courier.no_1"),
          },
          {
            title: "Saga Compensations",
            value: sagaCompensations,
            icon: RefreshCw,
            warn: sagaCompensations > 0,
            hint: t("courier.rate_1"),
          },
          {
            title: "Subscriber Failures",
            value: subscriberFailures,
            icon: Server,
            danger: subscriberFailures > 0,
            hint: t("courier.item_42969"),
          },
        ].map((card) => {
          const Icon = card.icon;
          const accent = card.danger ? "#E05252" : card.warn ? "#F4B740" : "#18B2B0";
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rassco-glass p-6"
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">{card.title}</p>
                  <h3
                    className="text-3xl font-extrabold mt-2 tracking-tight"
                    style={{ color: card.danger || card.warn ? accent : "#2D3135" }}
                  >
                    {card.value}
                  </h3>
                </div>
                <div
                  className="p-2.5 rounded-2xl"
                  style={{ backgroundColor: `${accent}18`, color: accent }}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              {"bar" in card && typeof card.bar === "number" ? (
                <div className="mt-4">
                  <div className="w-full bg-[#E6E8EC] rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${card.bar}%`,
                        backgroundColor: accent,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-[#6B7280] mt-1.5 font-medium">{card.hint}</p>
                </div>
              ) : (
                <p className="text-xs text-[#6B7280] mt-4 font-medium">{card.hint}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${glass} p-6 lg:col-span-2`}>
          <div className="text-sm font-bold text-[#2D3135] flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-[#18B2B0]" />
            Latency of Recent Spans (ms)
          </div>
          {spanChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spanChartData}>
                  <XAxis dataKey="name" stroke="#6B7280" fontSize={10} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E6E8EC",
                      borderRadius: "12px",
                      color: "#2D3135",
                    }}
                    labelStyle={{ color: "#2D3135" }}
                  />
                  <Bar dataKey="duration" radius={[6, 6, 0, 0]}>
                    {spanChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.status === "ERROR" ? "#E05252" : "#18B2B0"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-[#6B7280] text-xs font-medium">
              {t("courier.no_data")}
            </div>
          )}
        </div>

        <div className={`${glass} p-6 space-y-6`}>
          <div className="text-sm font-bold text-[#2D3135] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#18B2B0]" />
            {t("courier.duplicate_requests")}
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-white/70 border border-[rgba(24,178,176,0.12)] rounded-2xl">
              <span className="text-xs text-[#6B7280] block mb-1 font-semibold">Idempotency Hits</span>
              <span className="text-2xl font-extrabold text-[#18B2B0]">{idempotencyHits}</span>
            </div>
            <div className="p-4 bg-white/70 border border-[rgba(24,178,176,0.12)] rounded-2xl">
              <span className="text-xs text-[#6B7280] block mb-1 font-semibold">Idempotency Misses</span>
              <span className="text-2xl font-extrabold text-[#2D3135]">{idempotencyMisses}</span>
            </div>
          </div>
          {idempotencyHits + idempotencyMisses > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#6B7280] font-medium">{t("courier.duplicate")}</span>
                <span className="text-[#18B2B0] font-bold">
                  {Math.round((idempotencyHits / (idempotencyHits + idempotencyMisses)) * 100)}%
                </span>
              </div>
              <div className="w-full bg-[#E6E8EC] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#18B2B0] h-2 rounded-full"
                  style={{
                    width: `${(idempotencyHits / (idempotencyHits + idempotencyMisses)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`${glass} p-6`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="text-lg font-extrabold text-[#2D3135] flex items-center gap-2">
            <FileCode className="w-5 h-5 text-[#18B2B0]" />
            Distributed Spans & Traces
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute end-3 top-2.5 h-4 w-4 text-[#6B7280]" />
            <Input
              placeholder={t("courier.code")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pe-9 bg-white/80 border-[rgba(24,178,176,0.18)] text-[#2D3135] placeholder:text-[#6B7280] rounded-2xl focus-visible:ring-[#18B2B0]"
            />
          </div>
        </div>

        {filteredSpans.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-[rgba(24,178,176,0.12)]">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E6E8EC] bg-[#F3F4F6] hover:bg-[#F3F4F6]">
                  <TableHead className="text-[#6B7280] text-right font-bold w-1/4">
                    {t("courier.operation_1")}
                  </TableHead>
                  <TableHead className="text-[#6B7280] text-right font-bold">Span ID</TableHead>
                  <TableHead className="text-[#6B7280] text-right font-bold">Parent ID</TableHead>
                  <TableHead className="text-[#6B7280] text-right font-bold">
                    {t("courier.item_13067")}
                  </TableHead>
                  <TableHead className="text-[#6B7280] text-right font-bold">{t("courier.status")}</TableHead>
                  <TableHead className="text-[#6B7280] text-right font-bold">
                    {t("courier.item_16817")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSpans.map((span) => (
                  <TableRow key={span.id} className="border-[#E6E8EC] hover:bg-[#18B2B0]/05 text-[#2D3135]">
                    <TableCell className="font-semibold text-sm">{span.name}</TableCell>
                    <TableCell className="font-mono text-xs text-[#6B7280]">{span.id}</TableCell>
                    <TableCell className="font-mono text-xs text-[#6B7280]">{span.parentId || "-"}</TableCell>
                    <TableCell className="font-mono text-sm text-[#18B2B0] font-bold">
                      {span.duration ? `${span.duration}ms` : "Active"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          span.status === "ERROR"
                            ? "bg-[#E05252]/10 border-[#E05252]/25 text-[#E05252]"
                            : span.status === "OK"
                              ? "bg-[#18B2B0]/12 border-[#18B2B0]/25 text-[#18B2B0]"
                              : "bg-[#F3F4F6] border-[#E6E8EC] text-[#6B7280]"
                        }
                      >
                        {span.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-[#6B7280]">
                      {span.attributes ? JSON.stringify(span.attributes) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-[#6B7280] text-sm font-medium">{t("courier.no_2")}</div>
        )}
      </div>
    </div>
  );
}
