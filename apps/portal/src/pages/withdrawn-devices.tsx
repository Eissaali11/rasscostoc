import { useTranslation } from "@/lib/language";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleEllipsis,
  ClipboardCheck,
  FileClock,
  PackageX,
  Search,
  Settings2,
  Smartphone,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  User,
  XCircle,
} from "lucide-react";
import { WithdrawnDevice } from "@shared/schema";

type DeviceReviewStatus = "pending" | "approved" | "rejected";
type ReasonKey = "damaged" | "mismatch" | "warranty";



const normalize = (value?: string | null): string => (value || "").trim().toLowerCase();

const inferDeviceReviewStatus = (device: WithdrawnDevice): DeviceReviewStatus => {
  const combined = `${normalize(device.notes)} ${normalize(device.damagePart)}`;

  if (/(مرفوض|رفض|rejected|reject)/i.test(combined)) {
    return "rejected";
  }

  if (/(موافق|تمت\s*الموافقة|approved|accept|مقبول)/i.test(combined)) {
    return "approved";
  }

  return "pending";
};

const inferReasonKey = (device: WithdrawnDevice): ReasonKey => {
  const source = `${normalize(device.damagePart)} ${normalize(device.notes)}`;

  if (/(تالف|كسر|مكسور|ضرر|damag|broken|fault)/i.test(source)) {
    return "damaged";
  }

  if (/(عدم\s*تطابق|مختلف|wrong|mismatch|خطأ)/i.test(source)) {
    return "mismatch";
  }

  return "warranty";
};

const getDeviceFamily = (terminalId: string, t: any): string => {
  const value = String(terminalId || "").trim();
  if (!value) return t('reports.item_11222');
  const family = value.split(/[-_\s]/)[0]?.trim();
  return family ? family.toUpperCase() : t('reports.item_11222');
};

const formatCardDate = (value?: unknown): string => {
  if (!value) return "-";
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("ar-SA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCardTime = (value?: unknown): string => {
  if (!value) return "-";
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export default function WithdrawnDevicesPage() {
  const { t } = useTranslation();

  const statusConfig: Record<
    DeviceReviewStatus,
    {
      text: string;
      badgeClass: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  > = {
    pending: {
      text: t('reports.pending_review_1'),
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      icon: TriangleAlert,
    },
    approved: {
      text: t('reports.ok_1'),
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      icon: CheckCircle2,
    },
    rejected: {
      text: t('reports.item_9566'),
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      icon: XCircle,
    },
  };

  const reasonLabels: Record<ReasonKey, string> = {
    damaged: t('reports.item_12759'),
    mismatch: t('reports.item_12735'),
    warranty: t('reports.item_15976'),
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);

  const { data: devices, isLoading } = useQuery<WithdrawnDevice[]>({
    queryKey: ["/api/withdrawn-devices"],
  });

  const allDevices = devices || [];

  const stats = useMemo(() => {
    return allDevices.reduce(
      (acc, device) => {
        const status = inferDeviceReviewStatus(device);
        acc[status] += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 } as Record<DeviceReviewStatus, number>
    );
  }, [allDevices]);

  const analytics = useMemo(() => {
    const total = allDevices.length;
    const approvalRate = total > 0 ? Math.round((stats.approved / total) * 100) : 0;
    const estimatedLoss = stats.rejected * 350;

    const reasonCounts = allDevices.reduce<Record<ReasonKey, number>>(
      (acc, device) => {
        const reason = inferReasonKey(device);
        acc[reason] += 1;
        return acc;
      },
      { damaged: 0, mismatch: 0, warranty: 0 }
    );

    const reasons = (Object.keys(reasonCounts) as ReasonKey[]).map((key) => {
      const count = reasonCounts[key];
      return {
        key,
        label: reasonLabels[key],
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });

    const now = new Date();
    const monthBuckets = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      return {
        key,
        label: date.toLocaleDateString("ar-SA", { month: "long" }),
        count: 0,
      };
    });

    const monthIndex = new Map(monthBuckets.map((bucket, idx) => [bucket.key, idx]));

    allDevices.forEach((device) => {
      const created = new Date(device.createdAt || "");
      if (Number.isNaN(created.getTime())) return;

      const bucketKey = `${created.getFullYear()}-${created.getMonth()}`;
      const index = monthIndex.get(bucketKey);
      if (index === undefined) return;
      monthBuckets[index].count += 1;
    });

    const maxMonthCount = Math.max(1, ...monthBuckets.map((bucket) => bucket.count));
    const chartMaxHeightPx = 160;
    const monthlyTrend = monthBuckets.map((bucket, index) => ({
      ...bucket,
      barHeightPx:
        bucket.count <= 0
          ? 10
          : Math.max(20, Math.round((bucket.count / maxMonthCount) * chartMaxHeightPx)),
      isCurrentMonth: index === monthBuckets.length - 1,
    }));

    const currentMonth = monthBuckets[monthBuckets.length - 1]?.count || 0;
    const previousMonth = monthBuckets[monthBuckets.length - 2]?.count || 0;
    const monthlyDelta =
      previousMonth === 0
        ? currentMonth > 0
          ? 100
          : 0
        : Math.round(((currentMonth - previousMonth) / previousMonth) * 100);

    const topFamiliesMap = allDevices.reduce<Record<string, number>>((acc, device) => {
      const family = getDeviceFamily(device.terminalId, t);
      acc[family] = (acc[family] || 0) + 1;
      return acc;
    }, {});

    const topFamilies = Object.entries(topFamiliesMap)
      .map(([family, count]) => ({ family, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topFamilyMax = Math.max(1, ...topFamilies.map((item) => item.count));

    return {
      total,
      approvalRate,
      pending: stats.pending,
      estimatedLoss,
      monthlyDelta,
      monthlyTrend,
      reasons,
      topFamilies,
      topFamilyMax,
    };
  }, [allDevices, stats]);

  const latestOperations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return allDevices
      .map((device) => ({
        ...device,
        reviewStatus: inferDeviceReviewStatus(device),
      }))
      .filter((device) => {
        if (!term) return true;

        return (
          device.technicianName.toLowerCase().includes(term) ||
          device.city.toLowerCase().includes(term) ||
          device.terminalId.toLowerCase().includes(term) ||
          device.serialNumber.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime())
      .slice(0, 8);
  }, [allDevices, searchTerm]);

  const activeTrendPoint = useMemo(() => {
    if (!analytics.monthlyTrend.length) return null;

    if (hoveredMonthKey) {
      const hovered = analytics.monthlyTrend.find((month) => month.key === hoveredMonthKey);
      if (hovered) return hovered;
    }

    return analytics.monthlyTrend[analytics.monthlyTrend.length - 1];
  }, [analytics.monthlyTrend, hoveredMonthKey]);

  const chartScale = useMemo(() => {
    const maxValue = Math.max(0, ...analytics.monthlyTrend.map((month) => month.count));
    const midValue = Math.round(maxValue / 2);
    return { maxValue, midValue };
  }, [analytics.monthlyTrend]);

  if (isLoading) {
    return <div className="text-center py-8 text-slate-300">{t('reports.loading')}</div>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-700/60 bg-slate-900/50 backdrop-blur-md p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-800/70 hover:text-white w-fit">
              <Link href="/home" data-testid="button-back-home">
                <ArrowRight className="h-4 w-4 ml-2" />
                <span>{t('reports.item_22323')}</span>
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                  {t('reports.text')} <span className="text-cyan-300">Returns Analytics</span>
                </h2>
                <p className="text-sm text-slate-400">{t('reports.finance')}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20">
              <Link href="/withdrawn-devices/all">
                <FileClock className="h-4 w-4 ml-2" />
                {t('reports.log_operations_returned')}
              </Link>
            </Button>
            <Button asChild className="bg-cyan-600 hover:bg-cyan-500 text-white">
              <Link href="/withdrawn-devices/management" data-testid="button-open-management">
                <Settings2 className="h-4 w-4 ml-2" />
                {t('reports.management_returned')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-cyan-500/25 bg-slate-900/50">
          <div className="p-5 flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">{t('reports.total')}</p>
              <h3 className="text-3xl font-bold text-white">{analytics.total}</h3>
              <p className={`text-xs mt-2 flex items-center gap-1 ${analytics.monthlyDelta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {analytics.monthlyDelta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {t('common.vs_previous_month', { delta: `${analytics.monthlyDelta >= 0 ? "+" : ""}${analytics.monthlyDelta}` })}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-cyan-500/15 text-cyan-300 flex items-center justify-center">
              <PackageX className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="border-emerald-500/25 bg-slate-900/50">
          <div className="p-5 flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">{t('reports.rate')}</p>
              <h3 className="text-3xl font-bold text-white">{analytics.approvalRate}%</h3>
              <p className="text-xs text-emerald-300 mt-2 flex items-center gap-1">
                <ClipboardCheck className="h-3.5 w-3.5" />
                {t('reports.journey')}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="border-amber-500/25 bg-slate-900/50">
          <div className="p-5 flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">{t('reports.item_20736')}</p>
              <h3 className="text-3xl font-bold text-white">{analytics.pending}</h3>
              <p className="text-xs text-amber-300 mt-2">{t('reports.followup_supervisor')}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/15 text-amber-300 flex items-center justify-center">
              <TriangleAlert className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="border-rose-500/25 bg-slate-900/50">
          <div className="p-5 flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">{t('reports.item_20660')}</p>
              <h3 className="text-3xl font-bold text-rose-300">
                {analytics.estimatedLoss.toLocaleString("en-US")} <span className="text-sm text-slate-400">SAR</span>
              </h3>
              <p className="text-xs text-rose-300 mt-2">{t('reports.item_51106')}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-500/15 text-rose-300 flex items-center justify-center">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 border-white/10 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-bold">{t('reports.item_34991')}</h3>
            <div className="text-left">
              <span className="text-xs text-slate-400 block">{t('reports.item_11206')}</span>
              <span className="text-xs text-cyan-300 block mt-1">
                {activeTrendPoint ? t('reports.item_19846', { var_0: activeTrendPoint.label, var_1: activeTrendPoint.count }) : t('reports.item_9664')}
              </span>
            </div>
          </div>
          <div className="h-[240px] px-2">
            <div className="h-[185px] grid grid-cols-[42px_1fr] gap-2">
              <div className="flex flex-col justify-between pb-2 text-[11px] text-slate-500">
                <span>{chartScale.maxValue}</span>
                <span>{chartScale.midValue}</span>
                <span>0</span>
              </div>

              <div className="h-full flex items-end gap-3 border-b border-cyan-500/15 pb-2">
                {analytics.monthlyTrend.map((month) => (
                  <div
                    key={month.key}
                    className="flex-1 min-w-[56px] flex flex-col items-center justify-end gap-2"
                    onMouseEnter={() => setHoveredMonthKey(month.key)}
                    onMouseLeave={() => setHoveredMonthKey(null)}
                  >
                    <div className="relative w-full flex flex-col items-center">
                      {hoveredMonthKey === month.key && (
                        <div className="absolute -top-8 text-[11px] px-2 py-1 rounded bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 whitespace-nowrap">
                          {t('reports.operation_2', { count: month.count })}
                        </div>
                      )}
                      <span className={`text-[11px] font-mono mb-1 ${month.isCurrentMonth ? "text-cyan-200" : "text-slate-400"}`}>{month.count}</span>
                      <div
                        className={
                          month.isCurrentMonth
                            ? "w-full rounded-t-md bg-gradient-to-t from-cyan-600 to-cyan-300 border border-cyan-300/50 shadow-[0_0_18px_rgba(6,249,249,0.35)] transition-all"
                            : "w-full rounded-t-md bg-cyan-500/55 border border-cyan-300/25 transition-all"
                        }
                        style={{ height: `${month.barHeightPx}px` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-2 ml-[44px] flex items-start gap-3">
              {analytics.monthlyTrend.map((month) => (
                <div key={`${month.key}-label`} className="flex-1 min-w-[56px] text-center">
                  <span className={`text-xs ${month.isCurrentMonth ? "text-slate-200 font-semibold" : "text-slate-500"}`}>{month.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="border-white/10 bg-slate-900/50 p-5">
          <h3 className="text-white font-bold mb-5">{t('reports.item_22190')}</h3>
          <div className="space-y-4">
            {analytics.reasons.map((reason) => (
              <div key={reason.key}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-300">{reason.label}</span>
                  <span className="text-white font-semibold">{reason.percentage}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={
                      reason.key === "damaged"
                        ? "h-full bg-cyan-400"
                        : reason.key === "mismatch"
                          ? "h-full bg-amber-400"
                          : "h-full bg-rose-400"
                    }
                    style={{ width: `${Math.max(3, reason.percentage)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{t('reports.item_15941')}{reason.count}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="rounded-2xl border border-slate-700/60 bg-slate-900/45 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <h3 className="text-xl font-bold text-white">{t('reports.operations_1')}</h3>
          <div className="relative w-full sm:w-80">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
            <Input
              type="text"
              placeholder={t('reports.operations_2')}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pr-9 bg-slate-950/40 border-white/10 text-white placeholder:text-slate-500"
              data-testid="input-search-latest"
            />
          </div>
        </div>

        {latestOperations.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {latestOperations.map((device) => {
              const cfg = statusConfig[device.reviewStatus as DeviceReviewStatus];
              const StatusIcon = cfg.icon;

              return (
                <Card key={device.id} className="bg-slate-900/55 border border-white/10 overflow-hidden" data-testid={`card-latest-${device.id}`}>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded border ${cfg.badgeClass}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {cfg.text}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatCardDate(device.createdAt)} - {formatCardTime(device.createdAt)}
                      </span>
                    </div>

                    <h4 className="text-sm md:text-base font-bold text-cyan-300" dir="ltr">
                      ID: {device.terminalId} | SN: {device.serialNumber}
                    </h4>

                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <User className="h-4 w-4 text-cyan-300" />
                      <span>{device.technicianName}</span>
                      <span className="text-slate-500">•</span>
                      <span>{device.city}</span>
                      {device.simCardType ? (
                        <>
                          <span className="text-slate-500">•</span>
                          <span className="inline-flex items-center gap-1">
                            <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                            {device.simCardType}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/40 border-t border-white/10 flex justify-end">
                    <Button
                      asChild
                      variant="outline"
                      className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                      data-testid={`button-latest-details-${device.id}`}
                    >
                      <Link href={`/withdrawn-devices/${device.id}`}>
                        <CircleEllipsis className="h-4 w-4 ml-1" />
                        {t('reports.details_1')}
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-slate-900/40 border-white/10">
            <div className="py-10 text-center">
              <p className="text-slate-300">{t('reports.no_1')}</p>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
