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

function HealthPill({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border ${
        ok
          ? "bg-[#18B2B0]/12 text-[#18B2B0] border-[#18B2B0]/25"
          : "bg-[#E05252]/10 text-[#E05252] border-[#E05252]/25"
      }`}
    >
      {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {ok ? okLabel : badLabel}
    </span>
  );
}

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
  const isUp = health?.status === "UP";

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

  const metricCards = [
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
  ];

  return (
    <div dir={dir} className="rassco-page space-y-6 p-1">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="courier-panel courier-panel-static p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#2D3135] flex items-center gap-3">
            <span className="courier-icon-badge">
              <Activity className="w-5 h-5" />
            </span>
            {t("titles.courier_observability")}
          </h1>
          <p className="text-[#6B7280] text-sm mt-2 font-medium ps-14">
            مراقبة فورية لصحة النظام، المقاييس التشغيلية، ومسارات التتبع.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#18B2B0]/30 bg-[#18B2B0]/10 px-3 py-1.5 text-xs font-bold text-[#18B2B0]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#18B2B0] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#18B2B0]" />
            </span>
            Live Monitoring
          </span>
          <button
            type="button"
            className="courier-btn-secondary"
            onClick={() => {
              refetchHealth();
              refetchMetrics();
              refetchSpans();
            }}
          >
            <RefreshCw className="w-4 h-4" />
            {t("courier.update")}
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="courier-stat-card"
        >
          <div
            className="courier-stat-card-icon"
            style={{
              backgroundColor: isUp ? "rgba(24,178,176,0.12)" : "rgba(224,82,82,0.12)",
              color: isUp ? "#18B2B0" : "#E05252",
            }}
          >
            <Heart className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#6B7280] mb-2">{t("courier.status_2")}</p>
            <div
              className={`rounded-xl px-3 py-2 flex items-center gap-2 justify-center text-sm font-extrabold border ${
                isUp
                  ? "bg-[#18B2B0]/10 border-[#18B2B0]/25 text-[#18B2B0]"
                  : "bg-[#E05252]/10 border-[#E05252]/25 text-[#E05252]"
              }`}
            >
              {isUp ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {isUp ? "READY / UP" : "DOWN"}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="courier-stat-card"
        >
          <div
            className="courier-stat-card-icon"
            style={{ backgroundColor: "rgba(24,178,176,0.12)", color: "#18B2B0" }}
          >
            <Database className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#6B7280] mb-2">{t("courier.data_1")}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#6B7280] font-medium">PostgreSQL</span>
              <HealthPill
                ok={Boolean(health?.details?.database)}
                okLabel={t("courier.completed_5")}
                badLabel={t("courier.item_11197")}
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="courier-stat-card"
        >
          <div
            className="courier-stat-card-icon"
            style={{ backgroundColor: "rgba(24,178,176,0.12)", color: "#18B2B0" }}
          >
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs font-semibold text-[#6B7280]">{t("courier.workers")}</p>
            <div className="flex justify-between items-center text-xs gap-2">
              <span className="text-[#6B7280]">Subscribers</span>
              <span
                className={`font-bold ${
                  health?.details?.subscribers ? "text-[#18B2B0]" : "text-[#E05252]"
                }`}
              >
                {health?.details?.subscribers ? "Active" : "Offline"}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs gap-2">
              <span className="text-[#6B7280]">Outbox Worker</span>
              <span
                className={`font-bold ${
                  health?.details?.outboxWorker ? "text-[#18B2B0]" : "text-[#E05252]"
                }`}
              >
                {health?.details?.outboxWorker ? "Active" : "Offline"}
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="courier-stat-card"
        >
          <div
            className="courier-stat-card-icon"
            style={{ backgroundColor: "rgba(24,178,176,0.12)", color: "#18B2B0" }}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#6B7280] mb-2">{t("courier.verification")}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#6B7280] font-medium">Feature Flags</span>
              <HealthPill
                ok={Boolean(health?.details?.featureFlags)}
                okLabel={t("courier.completed_5")}
                badLabel={t("courier.pending_loading")}
              />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {metricCards.map((card, index) => {
          const Icon = card.icon;
          const accent = card.danger ? "#E05252" : card.warn ? "#F4B740" : "#18B2B0";
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + index * 0.04 }}
              className="courier-stat-card !items-start"
            >
              <div
                className="courier-stat-card-icon"
                style={{ backgroundColor: `${accent}18`, color: accent }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wide">
                  {card.title}
                </p>
                <h3
                  className="text-3xl font-extrabold mt-1.5 tracking-tight"
                  style={{ color: card.danger || card.warn ? accent : "#2D3135" }}
                >
                  {card.value}
                </h3>
                {"bar" in card && typeof card.bar === "number" ? (
                  <div className="mt-3">
                    <div className="w-full bg-[#E6E8EC] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${card.bar}%`, backgroundColor: accent }}
                      />
                    </div>
                    <p className="text-[10px] text-[#6B7280] mt-1.5 font-medium">{card.hint}</p>
                  </div>
                ) : (
                  <p className="text-xs text-[#6B7280] mt-3 font-medium">{card.hint}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="courier-panel courier-panel-static p-5 md:p-6 lg:col-span-2"
        >
          <div className="text-sm font-bold text-[#2D3135] flex items-center gap-2 mb-4">
            <span className="courier-icon-badge !w-9 !h-9">
              <Clock className="w-4 h-4" />
            </span>
            Latency of Recent Spans (ms)
          </div>
          {spanChartData.length > 0 ? (
            <div className="h-64 rounded-2xl bg-[#F8FAFC]/80 border border-[rgba(24,178,176,0.1)] p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spanChartData}>
                  <XAxis dataKey="name" stroke="#6B7280" fontSize={10} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid rgba(24,178,176,0.2)",
                      borderRadius: "14px",
                      color: "#2D3135",
                      boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
                    }}
                    labelStyle={{ color: "#2D3135" }}
                  />
                  <Bar dataKey="duration" radius={[8, 8, 0, 0]}>
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
            <div className="flex items-center justify-center h-64 rounded-2xl border border-dashed border-[rgba(24,178,176,0.25)] text-[#6B7280] text-sm font-medium bg-[#F8FAFC]/60">
              {t("courier.no_data")}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="courier-panel courier-panel-static p-5 md:p-6 space-y-5"
        >
          <div className="text-sm font-bold text-[#2D3135] flex items-center gap-2">
            <span className="courier-icon-badge !w-9 !h-9">
              <ShieldCheck className="w-4 h-4" />
            </span>
            {t("courier.duplicate_requests")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="courier-quick-link !flex-col !items-stretch !justify-start !py-4 !px-3 text-center hover:!translate-y-0">
              <span className="text-[11px] text-[#6B7280] block mb-1 font-semibold">
                Idempotency Hits
              </span>
              <span className="text-2xl font-extrabold text-[#18B2B0]">{idempotencyHits}</span>
            </div>
            <div className="courier-quick-link !flex-col !items-stretch !justify-start !py-4 !px-3 text-center hover:!translate-y-0">
              <span className="text-[11px] text-[#6B7280] block mb-1 font-semibold">
                Idempotency Misses
              </span>
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
                  className="bg-[#18B2B0] h-2 rounded-full transition-all"
                  style={{
                    width: `${(idempotencyHits / (idempotencyHits + idempotencyMisses)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="courier-panel courier-panel-static p-5 md:p-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="text-lg font-extrabold text-[#2D3135] flex items-center gap-2">
            <span className="courier-icon-badge">
              <FileCode className="w-5 h-5" />
            </span>
            Distributed Spans & Traces
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
            <input
              placeholder={t("courier.code")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="courier-input pe-10"
            />
          </div>
        </div>

        {filteredSpans.length > 0 ? (
          <div className="courier-table-wrap rounded-2xl border border-[rgba(24,178,176,0.14)] bg-white/70">
            <table className="courier-table whitespace-nowrap">
              <thead>
                <tr>
                  <th>{t("courier.operation_1")}</th>
                  <th>Span ID</th>
                  <th>Parent ID</th>
                  <th>{t("courier.item_13067")}</th>
                  <th>{t("courier.status")}</th>
                  <th>{t("courier.item_16817")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpans.map((span) => (
                  <tr key={span.id}>
                    <td className="font-semibold text-sm">{span.name}</td>
                    <td className="font-mono text-xs text-[#6B7280]">{span.id}</td>
                    <td className="font-mono text-xs text-[#6B7280]">{span.parentId || "—"}</td>
                    <td className="font-mono text-sm text-[#18B2B0] font-bold">
                      {span.duration ? `${span.duration}ms` : "Active"}
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                          span.status === "ERROR"
                            ? "bg-[#E05252]/10 border-[#E05252]/25 text-[#E05252]"
                            : span.status === "OK"
                              ? "bg-[#18B2B0]/12 border-[#18B2B0]/25 text-[#18B2B0]"
                              : "bg-[#F3F4F6] border-[#E6E8EC] text-[#6B7280]"
                        }`}
                      >
                        {span.status}
                      </span>
                    </td>
                    <td className="max-w-xs truncate text-xs text-[#6B7280]">
                      {span.attributes ? JSON.stringify(span.attributes) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 rounded-2xl border border-dashed border-[rgba(24,178,176,0.25)] text-[#6B7280] text-sm font-medium bg-[#F8FAFC]/60">
            {t("courier.no_2")}
          </div>
        )}
      </motion.div>
    </div>
  );
}
