import { useTranslation } from "@/lib/language";
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
  const { t } = useTranslation();

  const statusConfig: Record<
    DeviceStatus,
    { text: string; badgeClass: string; footerHint: string }
  > = {
    pending: {
      text: t('reports.pending_review_1'),
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      footerHint: t('reports.review_details'),
    },
    approved: {
      text: t('reports.ok_1'),
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      footerHint: t('reports.returned_inventory'),
    },
    rejected: {
      text: t('reports.item_9566'),
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      footerHint: t('reports.completed_reject_returned_resu'),
    },
    maintenance: {
      text: t('reports.item_17595'),
      badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/30",
      footerHint: t('reports.completed_transfer_device_rout'),
    },
  };
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
          ? t('reports.request_technician')
          : log.action === "update"
            ? t('reports.update_data_returned')
            : log.action === "delete"
              ? t('reports.delete_log_returned')
              : t('reports.returned'),
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
        title: t('reports.log_returned'),
        description: t('reports.completed_log', { var_0: device.terminalId }),
        createdAt: String(device.createdAt || ""),
        active: true,
      },
    ];
  }, [device, logs]);

  const decisionMutation = useMutation({
    mutationFn: async (decision: DeviceStatus) => {
      if (!device?.id) throw new Error(t('reports.device_2'));

      const existingNotes = (device.notes || "t('reports.item_8663')").trim();

      const decisionText =
        decision === "approved"
          ? t('reports.ok_1')
          : decision === "rejected"
            ? t('reports.item_9566')
            : decision === "maintenance"
              ? t('reports.transfer')
              : t('reports.pending_review_1');

      const notes = t('reports.item_9344', { var_0: existingNotes, var_1: existingNotes ? " | " : "", var_2: decisionText });

      await apiRequest("PATCH", `/api/withdrawn-devices/${device.id}`, { notes });
      return decision;
    },
    onSuccess: (decision) => {
      queryClient.invalidateQueries({ queryKey: [id ? `/api/withdrawn-devices/${id}` : ""] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawn-devices"] });

      const title =
        decision === "approved"
          ? t('reports.item_17540')
          : decision === "rejected"
            ? t('reports.completed_reject')
            : t('reports.completed_transfer');

      toast({
        title,
        description: t('reports.completed_update_status_device'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('reports.operation_1'),
        description: error?.message || t('reports.error_1'),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!device?.id) throw new Error(t('reports.device_2'));
      await apiRequest("DELETE", `/api/withdrawn-devices/${device.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawn-devices"] });
      toast({
        title: t('reports.completed_delete_successfully'),
        description: t('reports.completed_delete_log_operation'),
      });
      setLocation("/withdrawn-devices");
    },
    onError: (error: any) => {
      toast({
        title: t('reports.delete_1'),
        description: error?.message || t('reports.error_delete_1'),
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (window.confirm(t('reports.delete_operation_returned'))) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-300">
        {t('reports.loading_device_details')}
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center">
        <XCircle className="h-10 w-10 text-rose-400" />
        <p className="text-slate-300">{t('reports.data_device')}</p>
        <Button onClick={() => setLocation("/withdrawn-devices")} className="bg-cyan-600 hover:bg-cyan-500 text-white">
          {t('reports.item_20713')}
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
        title: t('reports.completed_file_successfully'),
        description: t('reports.completed_download_report_oper'),
      });
    } catch (error: any) {
      toast({
        title: t('reports.file'),
        description: error?.message || t('reports.error_file_report'),
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
          {t('reports.item_20713')}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleExportReport}
          disabled={isExporting}
          className="border-white/10 bg-white/5 text-slate-300"
        >
          <Printer className="h-4 w-4 ml-1" />
          {isExporting ? t('reports.file_1') : t('reports.print_report')}
        </Button>
      </section>

      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-white">{t('reports.details_device')}{device.terminalId}</h2>
            <Badge className={`border ${statusUi.badgeClass}`}>{statusUi.text}</Badge>
          </div>
          <p className="text-sm text-slate-400">{t('reports.completed')}{formatDateTime(device.createdAt)}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="bg-slate-900/60 border-white/10 p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-cyan-300">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{t('reports.info_device_1')}</h3>
              <p className="text-sm text-slate-400">{t('reports.details_2')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('reports.number_serial')}</p>
              <p className="font-mono bg-black/30 px-2 py-1 rounded text-cyan-300">{device.serialNumber}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('reports.number_device')}</p>
              <p className="font-medium text-slate-200">{device.terminalId}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('reports.type_battery')}</p>
              <p className="font-medium text-slate-200">{device.battery || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('reports.type_sim')}</p>
              <p className="font-medium text-slate-200">{device.simCardType || t('reports.no')}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900/60 border-white/10 p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-300">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{t('reports.info_technician')}</h3>
              <p className="text-sm text-slate-400">{t('reports.data_admin')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('reports.name_technician_1')}</p>
              <p className="font-medium text-slate-200">{device.technicianName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('reports.region_city')}</p>
              <p className="font-medium text-slate-200">{device.city}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">{t('reports.update_1')}</p>
              <p className="font-medium text-slate-200">{formatDateTime(device.updatedAt || device.createdAt)}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Card className="bg-slate-900/60 border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 bg-slate-800/40 flex items-center justify-between">
              <h3 className="font-semibold text-white">{t('reports.review')}</h3>
              <span className="text-xs text-slate-400">
                {t('reports.accessories_available_of', { count: [hasBattery, hasCable, hasHead, hasSim].filter(Boolean).length })}
              </span>
            </div>

            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: "battery", label: t('reports.battery_1'), ok: hasBattery, icon: Battery },
                { key: "cable", label: t('reports.item_6393'), ok: hasCable, icon: Cable },
                { key: "head", label: t('reports.item_11125'), ok: hasHead, icon: Cable },
                { key: "sim", label: t('reports.sim'), ok: hasSim, icon: CreditCard },
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
              <h3 className="font-semibold text-white">{t('reports.status_1')}</h3>
            </div>

            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5" />
                <p className="text-slate-200">{t('reports.device_8')}{device.damagePart ? t('reports.item_15947') : t('reports.item_17593')}</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                {hasSim ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-amber-400 mt-0.5" />
                )}
                <p className="text-slate-200">{t('reports.status_sim_1')}{hasSim ? t('reports.item_9554') : t('reports.item_14375')}</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                <Settings className="h-4 w-4 text-cyan-400 mt-0.5" />
                <p className="text-slate-200">{t('reports.notes_technician_1')}{device.notes || t('reports.no_notes')}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="bg-slate-900/60 border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 bg-slate-800/40 flex items-center justify-between">
            <h3 className="font-semibold text-white">{t('reports.notes_1')}</h3>
            <Image className="h-4 w-4 text-slate-400" />
          </div>

          <div className="p-5 space-y-4">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <p className="text-sm text-slate-200 leading-relaxed">{device.damagePart || t('reports.no_device')}</p>
            </div>

            <h4 className="text-sm font-medium text-slate-400">{t('reports.images_proof')}</h4>
            <div className="grid grid-cols-2 gap-3">
              {[t('reports.device_3'), t('reports.item_23880'), t('reports.sim_1'), t('reports.device_4')].map((caption, index) => (
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
        <h3 className="font-semibold text-white mb-5">{t('reports.log_track')}</h3>

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
              {t('reports.delete_operation')}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => decisionMutation.mutate("rejected")}
              disabled={decisionMutation.isPending}
              className="border-rose-500/30 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20"
            >
              <XCircle className="h-4 w-4 ml-1" />
              {t('reports.reject_returned')}
            </Button>

            <Button
              type="button"
              onClick={() => decisionMutation.mutate("maintenance")}
              disabled={decisionMutation.isPending}
              className="bg-amber-400 hover:bg-amber-300 text-slate-900"
            >
              <Wrench className="h-4 w-4 ml-1" />
              {t('reports.transfer')}
            </Button>

            <Button
              type="button"
              onClick={() => decisionMutation.mutate("approved")}
              disabled={decisionMutation.isPending}
              className="bg-gradient-to-r from-emerald-400 to-primary text-slate-900 hover:opacity-90"
            >
              <CheckCircle2 className="h-4 w-4 ml-1" />
              {t('reports.item_28728')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

