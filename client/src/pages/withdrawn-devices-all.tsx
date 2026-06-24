import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  CheckCircle2,
  CircleEllipsis,
  FileClock,
  MapPin,
  Search,
  Smartphone,
  TriangleAlert,
  User,
  XCircle,
} from "lucide-react";
import { WithdrawnDevice } from "@shared/schema";

type DeviceReviewStatus = "pending" | "approved" | "rejected";

const statusConfig: Record<
  DeviceReviewStatus,
  {
    text: string;
    borderClass: string;
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
    cardBg: string;
  }
> = {
  pending: {
    text: "قيد المراجعة",
    borderClass: "border-r-4 border-r-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: TriangleAlert,
    cardBg: "bg-slate-900/40",
  },
  approved: {
    text: "موافق عليها",
    borderClass: "border-r-4 border-r-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: CheckCircle2,
    cardBg: "bg-slate-900/40",
  },
  rejected: {
    text: "مرفوضة",
    borderClass: "border-r-4 border-r-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    icon: XCircle,
    cardBg: "bg-slate-900/40",
  },
};

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

const hasAccessory = (value?: string | null): boolean => {
  const normalized = normalize(value);
  if (!normalized) return false;
  if (
    /^(لا|no|false|0|بدون)$/i.test(normalized) ||
    /(غير\s*موجود|غير\s*متوفر|غير\s*مرفق|cancel|none|n\/a)/i.test(normalized)
  ) {
    return false;
  }
  return true;
};

const formatCardDate = (value?: unknown): string => {
  if (!value) return "-";
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("ar-SA", {
    day: "2-digit",
    month: "long",
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

export default function WithdrawnDevicesAllPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");

  const { data: devices, isLoading } = useQuery<(WithdrawnDevice & { regionName?: string })[]>({
    queryKey: ["/api/withdrawn-devices"],
  });

  const allDevices = devices || [];

  // Extract unique regions for filter
  const uniqueRegions = useMemo(() => {
    const regionNames = new Set<string>();
    allDevices.forEach((d) => {
      if (d.regionName) regionNames.add(d.regionName);
    });
    return Array.from(regionNames);
  }, [allDevices]);

  const filteredDevices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return allDevices
      .map((device) => ({
        ...device,
        reviewStatus: inferDeviceReviewStatus(device),
      }))
      .filter((device) => {
        // Status filter
        if (statusFilter !== "all" && device.reviewStatus !== statusFilter) {
          return false;
        }

        // Region filter
        if (regionFilter !== "all" && device.regionName !== regionFilter) {
          return false;
        }

        // Search term
        if (!term) return true;
        return (
          device.technicianName.toLowerCase().includes(term) ||
          device.city.toLowerCase().includes(term) ||
          (device.regionName || "").toLowerCase().includes(term) ||
          device.terminalId.toLowerCase().includes(term) ||
          device.serialNumber.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime());
  }, [allDevices, searchTerm, statusFilter, regionFilter]);

  if (isLoading) {
    return <div className="text-center py-12 text-slate-300">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <section className="rounded-2xl border border-slate-700/60 bg-slate-900/50 backdrop-blur-md p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-800/70 hover:text-white w-fit">
              <Link href="/withdrawn-devices">
                <ArrowRight className="h-4 w-4 ml-2" />
                <span>العودة للملخص</span>
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                <FileClock className="h-6 w-6 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                  سجل العمليات المرتجعة <span className="text-cyan-300">Operations History</span>
                </h2>
                <p className="text-sm text-slate-400">سجل كامل بجميع عمليات الأجهزة المرتجعة الموافق عليها والمرفوضة بالتفصيل</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/60">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
            <Input
              type="text"
              placeholder="ابحث باسم الفني، الرقم التسلسلي، أو المدينة..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pr-9 bg-slate-950/40 border-slate-800 text-white placeholder:text-slate-500"
            />
          </div>

          <div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-950/40 border-slate-800 text-white">
                <SelectValue placeholder="تصفية حسب الحالة" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="all">جميع الحالات (موافق ومرفوض وقيد المراجعة)</SelectItem>
                <SelectItem value="approved">موافق عليها فقط</SelectItem>
                <SelectItem value="rejected">مرفوضة فقط</SelectItem>
                <SelectItem value="pending">قيد المراجعة فقط</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="bg-slate-950/40 border-slate-800 text-white">
                <SelectValue placeholder="تصفية حسب المنطقة" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="all">جميع المناطق</SelectItem>
                {uniqueRegions.map((reg) => (
                  <SelectItem key={reg} value={reg}>
                    {reg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Main Grid View */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredDevices.length > 0 ? (
          filteredDevices.map((device) => {
            const cfg = statusConfig[device.reviewStatus];
            const StatusIcon = cfg.icon;
            const hasBattery = hasAccessory(device.battery);
            const hasCable = hasAccessory(device.chargerCable);
            const hasHead = hasAccessory(device.chargerHead);
            const hasSim = hasAccessory(device.hasSim);

            return (
              <Card
                key={device.id}
                className={`${cfg.cardBg} ${cfg.borderClass} border border-slate-800/80 rounded-xl overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between`}
              >
                {/* Card Main Body */}
                <div className="p-5 space-y-4">
                  {/* Status & Time row */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.badgeClass}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {cfg.text}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {formatCardDate(device.createdAt)} - {formatCardTime(device.createdAt)}
                    </span>
                  </div>

                  {/* Technician & Region Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300 bg-slate-950/20 p-3 rounded-lg border border-slate-800/30">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-cyan-400 shrink-0" />
                      <div>
                        <p className="text-[11px] text-slate-500 leading-none">اسم الفني</p>
                        <p className="font-semibold text-slate-200 mt-0.5">{device.technicianName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
                      <div>
                        <p className="text-[11px] text-slate-500 leading-none">المنطقة / المدينة</p>
                        <p className="font-semibold text-slate-200 mt-0.5">
                          {device.regionName || "غير محددة"} • <span className="text-xs text-slate-400 font-normal">{device.city}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Device info */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-400">معلومات الجهاز:</h3>
                    <p className="text-base font-bold text-slate-100 font-mono tracking-wide bg-slate-950/40 px-3 py-2 rounded-md border border-slate-800/60" dir="ltr">
                      ID: <span className="text-cyan-400">{device.terminalId}</span>
                      <span className="text-slate-600 mx-2">|</span>
                      SN: <span className="text-slate-300">{device.serialNumber}</span>
                    </p>
                  </div>

                  {/* Accessories grid */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 mb-2">الملحقات المرفقة:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="flex items-center gap-1.5 bg-slate-950/30 px-2 py-1.5 rounded border border-slate-800/40 text-slate-300 text-xs">
                        {hasBattery ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-rose-400" />}
                        <span>بطارية ({device.battery})</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-950/30 px-2 py-1.5 rounded border border-slate-800/40 text-slate-300 text-xs">
                        {hasCable ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-rose-400" />}
                        <span>كابل شاحن</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-950/30 px-2 py-1.5 rounded border border-slate-800/40 text-slate-300 text-xs">
                        {hasHead ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-rose-400" />}
                        <span>رأس شاحن</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-950/30 px-2 py-1.5 rounded border border-slate-800/40 text-slate-300 text-xs">
                        {hasSim ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-rose-400" />}
                        <span>شريحة ({device.simCardType || "لا يوجد"})</span>
                      </div>
                    </div>
                  </div>

                  {/* Damage & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 mb-1">حالة الضرر / التلف:</h4>
                      <p className="text-xs text-slate-300 font-semibold bg-rose-500/5 px-2 py-1.5 rounded border border-rose-500/10 flex items-center gap-1.5">
                        <TriangleAlert className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                        {device.damagePart || "لا يوجد أجزاء متضررة"}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 mb-1">ملاحظات العملية:</h4>
                      <p className="text-xs text-slate-400 bg-slate-950/20 px-2 py-1.5 rounded border border-slate-800/40 min-h-[32px] italic">
                        {device.notes || "لا توجد ملاحظات إضافية"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Action footer */}
                <div className="px-5 py-3 bg-slate-950/30 border-t border-slate-800/60 flex justify-end">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                  >
                    <Link href={`/withdrawn-devices/${device.id}`}>
                      <CircleEllipsis className="h-4 w-4 ml-1.5" />
                      تفاصيل كاملة
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })
        ) : (
          <div className="col-span-2 p-12 border-2 border-dashed border-slate-800 bg-slate-900/20 text-center rounded-xl">
            <p className="text-slate-400">لا توجد أجهزة مرتجعة مطابقة للتصفية والبحث حالياً.</p>
          </div>
        )}
      </section>
    </div>
  );
}
