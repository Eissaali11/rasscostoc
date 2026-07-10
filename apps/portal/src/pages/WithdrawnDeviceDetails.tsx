import { useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { exportWithdrawnDeviceDetailsToPDF } from "@/features/withdrawn-devices/export-withdrawn-device-details-pdf";
import {
  ArrowRight,
  Battery,
  Cable,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Image,
  Package,
  Printer,
  Settings,
  ShieldAlert,
  Smartphone,
  Trash2,
  User,
  Wrench,
  XCircle,
} from "lucide-react";

type WithdrawnDevice = {
  id: string;
  city: string;
  technicianName: string;
  terminalId: string;
  serialNumber: string;
  battery: string;
  chargerCable: string;
  chargerHead: string;
  hasSim: string;
  simCardType: string | null;
  damagePart: string | null;
  notes: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

type SystemLogEntry = {
  id: string;
  action: string;
  description: string;
  userName: string;
  createdAt: string;
  severity: "info" | "warn" | "error";
};

type DeviceStatus = "pending" | "approved" | "rejected" | "maintenance";

const normalize = (value?: string | null): string => (value || "").trim().toLowerCase();

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

const inferStatus = (device?: WithdrawnDevice | null): DeviceStatus => {
  if (!device) return "pending";

  const combined = `${normalize(device.notes)} ${normalize(device.damagePart)}`;

  if (/(صيانة|maintenance|تحويل\s*للصيانة)/i.test(combined)) {
    return "maintenance";
  }

  if (/(مرفوض|رفض|rejected|reject)/i.test(combined)) {
    return "rejected";
  }

  if (/(موافق|تمت\s*الموافقة|approved|accept|مقبول)/i.test(combined)) {
    return "approved";
  }

  return "pending";
};

const statusConfig: Record<
  DeviceStatus,
  { text: string; badgeClass: string; footerHint: string }
> = {
  pending: {
    text: "قيد المراجعة",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    footerHint: "يرجى مراجعة كافة التفاصيل قبل اتخاذ القرار النهائي.",
  },
  approved: {
    text: "موافق عليها",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    footerHint: "تمت الموافقة على المرتجع وإعادته لمسار المخزون.",
  },
  rejected: {
    text: "مرفوضة",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    footerHint: "تم رفض المرتجع وفق نتائج المراجعة المندوبة.",
  },
  maintenance: {
    text: "محول للصيانة",
    badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    footerHint: "تم تحويل الجهاز إلى مسار الصيانة.",
  },
};

const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function WithdrawnDeviceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);

  const { data: device, isLoading } = useQuery<WithdrawnDevice>({
    queryKey: [id ? `/api/withdrawn-devices/${id}` : ""],
    enabled: !!id,
  });

  const { data: logs = [] } = useQuery<SystemLogEntry[]>({
    queryKey: [id ? `/api/system-logs?entityType=device&entityId=${id}&limit=20` : ""],
    enabled: !!id,
  });

  const status = inferStatus(device);
  const statusUi = statusConfig[status];

  const timeline = useMemo(() => {
    const validLogs = logs.filter((log) => !!log.createdAt).map((log) => ({
      id: log.id,
      title:
        log.action === "create"
          ? "طلب ارتجاع من المندوب"
          : log.action === "update"
            ? "تحديث بيانات المرتجع"
            : log.action === "delete"
              ? "حذف سجل المرتجع"
              : "حدث على المرتجع",
      description: log.description,
      createdAt: log.createdAt,
      active: false,
    }));

    if (validLogs.length > 0) {
      return validLogs.map((entry, index) => ({ ...entry, active: index === validLogs.length - 1 }));
    }

    if (!device) return [];

    return [
      {
        id: `fallback-${device.id}`,
        title: "إنشاء سجل المرتجع",
        description: `تم إنشاء سجل للجهاز ${device.terminalId}.`,
        createdAt: String(device.createdAt || ""),
        active: true,
      },
    ];
  }, [device, logs]);

  const decisionMutation = useMutation({
    mutationFn: async (decision: DeviceStatus) => {
      if (!device?.id) throw new Error("الجهاز غير متاح");

      const existingNotes = (device.notes || "").replace(/\s*\|\s*قرار:[^|]*/g, "").trim();

      const decisionText =
        decision === "approved"
          ? "موافق عليها"
          : decision === "rejected"
            ? "مرفوضة"
            : decision === "maintenance"
              ? "تحويل للصيانة"
              : "قيد المراجعة";

      const notes = `${existingNotes}${existingNotes ? " | " : ""}قرار: ${decisionText}`;

      await apiRequest("PATCH", `/api/withdrawn-devices/${device.id}`, { notes });
      return decision;
    },
    onSuccess: (decision) => {
      queryClient.invalidateQueries({ queryKey: [id ? `/api/withdrawn-devices/${id}` : ""] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawn-devices"] });

      const title =
        decision === "approved"
          ? "تمت الموافقة"
          : decision === "rejected"
            ? "تم الرفض"
            : "تم التحويل للصيانة";

      toast({
        title,
        description: "تم تحديث حالة الجهاز المرتجع بنجاح.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "تعذر تنفيذ العملية",
        description: error?.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!device?.id) throw new Error("الجهاز غير متاح");
      await apiRequest("DELETE", `/api/withdrawn-devices/${device.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawn-devices"] });
      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف سجل العملية المرتجعة بالكامل.",
      });
      setLocation("/withdrawn-devices");
    },
    onError: (error: any) => {
      toast({
        title: "تعذر الحذف",
        description: error?.message || "حدث خطأ أثناء محاولة الحذف",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (window.confirm("هل أنت متأكد من حذف هذه العملية المرتجعة نهائياً؟")) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-300">
        جاري تحميل تفاصيل الجهاز...
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center">
        <XCircle className="h-10 w-10 text-rose-400" />
        <p className="text-slate-300">تعذر العثور على بيانات الجهاز المطلوب.</p>
        <Button onClick={() => setLocation("/withdrawn-devices")} className="bg-cyan-600 hover:bg-cyan-500 text-white">
          العودة للقائمة
        </Button>
      </div>
    );
  }

  const hasBattery = hasAccessory(device.battery);
  const hasCable = hasAccessory(device.chargerCable);
  const hasHead = hasAccessory(device.chargerHead);
  const hasSim = hasAccessory(device.hasSim);

  const handleExportReport = async () => {
    if (!device || isExporting) return;

    setIsExporting(true);

    try {
      await exportWithdrawnDeviceDetailsToPDF({
        device,
        statusText: statusUi.text,
        timeline,
        hasBattery,
        hasCable,
        hasHead,
        hasSim,
      });

      toast({
        title: "تم إنشاء الملف بنجاح",
        description: "تم تنزيل تقرير PDF المنسق لتفاصيل العملية.",
      });
    } catch (error: any) {
      toast({
        title: "تعذر إنشاء الملف",
        description: error?.message || "حدث خطأ أثناء إنشاء ملف التقرير",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-full text-slate-100 space-y-6 pb-28">
      <section className="h-16 bg-slate-900/60 border border-white/10 rounded-xl flex items-center justify-between px-5">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setLocation("/withdrawn-devices")}
          className="text-slate-300 hover:bg-slate-800/70"
        >
          <ArrowRight className="h-4 w-4 ml-1" />
          العودة للقائمة
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleExportReport}
          disabled={isExporting}
          className="border-white/10 bg-white/5 text-slate-300"
        >
          <Printer className="h-4 w-4 ml-1" />
          {isExporting ? "جاري إنشاء الملف..." : "طباعة التقرير"}
        </Button>
      </section>

      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-white">تفاصيل الجهاز المسحوب : #{device.terminalId}</h2>
            <Badge className={`border ${statusUi.badgeClass}`}>{statusUi.text}</Badge>
          </div>
          <p className="text-sm text-slate-400">تم الإنشاء في: {formatDateTime(device.createdAt)}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="bg-slate-900/60 border-white/10 p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-cyan-300">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">معلومات الجهاز</h3>
              <p className="text-sm text-slate-400">تفاصيل التعريف والحالة</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-1">الرقم التسلسلي</p>
              <p className="font-mono bg-black/30 px-2 py-1 rounded text-cyan-300">{device.serialNumber}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">رقم الجهاز</p>
              <p className="font-medium text-slate-200">{device.terminalId}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">نوع البطارية</p>
              <p className="font-medium text-slate-200">{device.battery || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">نوع الشريحة</p>
              <p className="font-medium text-slate-200">{device.simCardType || "لا يوجد"}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900/60 border-white/10 p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-300">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">معلومات المندوب</h3>
              <p className="text-sm text-slate-400">بيانات المسؤول عن الارتجاع</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-1">اسم المندوب</p>
              <p className="font-medium text-slate-200">{device.technicianName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">المنطقة / المدينة</p>
              <p className="font-medium text-slate-200">{device.city}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">آخر تحديث</p>
              <p className="font-medium text-slate-200">{formatDateTime(device.updatedAt || device.createdAt)}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Card className="bg-slate-900/60 border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 bg-slate-800/40 flex items-center justify-between">
              <h3 className="font-semibold text-white">مراجعة الملحقات المستلمة</h3>
              <span className="text-xs text-slate-400">
                {[hasBattery, hasCable, hasHead, hasSim].filter(Boolean).length} من 4 متوفرة
              </span>
            </div>

            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: "battery", label: "بطارية", ok: hasBattery, icon: Battery },
                { key: "cable", label: "كيبل", ok: hasCable, icon: Cable },
                { key: "head", label: "رأس شاحن", ok: hasHead, icon: Cable },
                { key: "sim", label: "شريحة", ok: hasSim, icon: CreditCard },
              ].map((acc) => {
                const Icon = acc.icon;
                return (
                  <div
                    key={acc.key}
                    className={`rounded-xl border p-3 flex flex-col items-center gap-2 ${
                      acc.ok
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-rose-500/30 bg-rose-500/5 opacity-80"
                    }`}
                  >
                    {acc.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                    <Icon className="h-6 w-6 text-slate-300" />
                    <span className={`text-xs ${acc.ok ? "text-slate-200" : "text-slate-400 line-through"}`}>{acc.label}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="bg-slate-900/60 border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 bg-slate-800/40">
              <h3 className="font-semibold text-white">الحالة المندوبة المبدئية</h3>
            </div>

            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5" />
                <p className="text-slate-200">فحص أولي لهيكل الجهاز: {device.damagePart ? "يوجد ملاحظة" : "سليم ظاهرياً"}</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                {hasSim ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-amber-400 mt-0.5" />
                )}
                <p className="text-slate-200">حالة الشريحة: {hasSim ? "متوفرة" : "غير متوفرة"}</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                <Settings className="h-4 w-4 text-cyan-400 mt-0.5" />
                <p className="text-slate-200">ملاحظات المندوب: {device.notes || "لا توجد ملاحظات إضافية"}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="bg-slate-900/60 border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 bg-slate-800/40 flex items-center justify-between">
            <h3 className="font-semibold text-white">ملاحظات الأضرار والأدلة</h3>
            <Image className="h-4 w-4 text-slate-400" />
          </div>

          <div className="p-5 space-y-4">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <p className="text-sm text-slate-200 leading-relaxed">{device.damagePart || "لا توجد أضرار موثقة على هذا الجهاز."}</p>
            </div>

            <h4 className="text-sm font-medium text-slate-400">الصور المرفقة (أدلة الإثبات)</h4>
            <div className="grid grid-cols-2 gap-3">
              {["زاوية الجهاز", "الواجهة الأمامية", "مكان الشريحة", "ملحقات الجهاز"].map((caption, index) => (
                <div key={caption} className="relative rounded-xl overflow-hidden border border-white/10 aspect-square bg-slate-800 flex items-center justify-center">
                  <Image className="h-8 w-8 text-slate-600" />
                  <div className="absolute bottom-2 right-2 text-xs bg-black/50 px-2 py-1 rounded text-white">{caption}</div>
                  <div className="absolute top-2 left-2 text-[10px] text-slate-400">#{index + 1}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className="bg-slate-900/60 border border-white/10 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-5">سجل التتبع للارتجاع</h3>

        <div className="relative pr-4">
          <div className="absolute right-[13px] top-2 bottom-2 w-[2px] bg-slate-700/80" />
          <div className="space-y-5">
            {timeline.map((item) => (
              <div key={item.id} className="relative flex items-start gap-3">
                <div
                  className={`w-7 h-7 rounded-full border-2 shrink-0 z-10 mt-0.5 flex items-center justify-center ${
                    item.active
                      ? "bg-amber-400/15 border-amber-400 text-amber-300"
                      : "bg-emerald-500/15 border-emerald-400 text-emerald-300"
                  }`}
                >
                  {item.active ? <Clock3 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${item.active ? "text-amber-300" : "text-slate-200"}`}>{item.title}</p>
                  <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatDateTime(item.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sticky bottom-0 p-4 bg-slate-900/85 backdrop-blur-xl border border-white/10 rounded-xl z-20">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-400 hidden lg:block">{statusUi.footerHint}</p>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={deleteMutation.isPending || decisionMutation.isPending}
              className="border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4 ml-1" />
              حذف العملية
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => decisionMutation.mutate("rejected")}
              disabled={decisionMutation.isPending}
              className="border-rose-500/30 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20"
            >
              <XCircle className="h-4 w-4 ml-1" />
              رفض المرتجع
            </Button>

            <Button
              type="button"
              onClick={() => decisionMutation.mutate("maintenance")}
              disabled={decisionMutation.isPending}
              className="bg-amber-400 hover:bg-amber-300 text-slate-900"
            >
              <Wrench className="h-4 w-4 ml-1" />
              تحويل للصيانة
            </Button>

            <Button
              type="button"
              onClick={() => decisionMutation.mutate("approved")}
              disabled={decisionMutation.isPending}
              className="bg-gradient-to-r from-emerald-400 to-primary text-slate-900 hover:opacity-90"
            >
              <CheckCircle2 className="h-4 w-4 ml-1" />
              موافقة وإعادة للمخزن
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

