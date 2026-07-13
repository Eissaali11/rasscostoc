import { useTranslation } from "@/lib/language";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  CircleEllipsis,
  FileClock,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Trash2,
  TriangleAlert,
  User,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { WithdrawnDevice } from "@shared/schema";
import AddWithdrawnDeviceModal from "@/components/add-withdrawn-device-modal";
import EditWithdrawnDeviceModal from "@/components/edit-withdrawn-device-modal";

type DeviceReviewStatus = "pending" | "approved" | "rejected";



const normalize = (value?: string | null): string => (value || "").trim().toLowerCase();

const inferDeviceReviewStatus = (device: WithdrawnDevice & { status?: string }): DeviceReviewStatus => {
  if (device.status === "approved" || device.status === "rejected" || device.status === "pending") {
    return device.status as DeviceReviewStatus;
  }

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

export default function WithdrawnDevicesManagementPage() {
  const { t } = useTranslation();

  const statusConfig: Record<
    DeviceReviewStatus,
    {
      text: string;
      borderClass: string;
      badgeClass: string;
      icon: React.ComponentType<{ className?: string }>;
      progressClass: string;
      progressWidth: string;
    }
  > = {
    pending: {
      text: t('reports.pending_review_1'),
      borderClass: "border-r-4 border-r-amber-400",
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      icon: TriangleAlert,
      progressClass: "bg-amber-400",
      progressWidth: "w-1/3",
    },
    approved: {
      text: t('reports.ok_1'),
      borderClass: "border-r-4 border-r-emerald-400",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      icon: CheckCircle2,
      progressClass: "bg-emerald-400",
      progressWidth: "w-2/3",
    },
    rejected: {
      text: t('reports.item_9566'),
      borderClass: "border-r-4 border-r-rose-400",
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      icon: XCircle,
      progressClass: "bg-rose-400",
      progressWidth: "w-full",
    },
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<DeviceReviewStatus>("pending");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<WithdrawnDevice | null>(null);

  const { data: devices, isLoading } = useQuery<WithdrawnDevice[]>({
    queryKey: ["/api/withdrawn-devices"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/withdrawn-devices/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawn-devices"] });
      toast({
        title: t('reports.completed_delete_successfully'),
        description: t('reports.completed_delete_device'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('reports.error_delete'),
        description: error.message || t('reports.error_delete_device'),
        variant: "destructive",
      });
    },
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

  const filteredDevices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return allDevices
      .filter((device) => {
        if (!term) return true;

        return (
          device.technicianName.toLowerCase().includes(term) ||
          device.city.toLowerCase().includes(term) ||
          device.terminalId.toLowerCase().includes(term) ||
          device.serialNumber.toLowerCase().includes(term)
        );
      })
      .map((device) => ({
        ...device,
        reviewStatus: inferDeviceReviewStatus(device),
      }))
      .filter((device) => device.reviewStatus === activeTab);
  }, [activeTab, allDevices, searchTerm]);

  const handleEdit = (device: WithdrawnDevice) => {
    setSelectedDevice(device);
    setShowEditModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('reports.delete_data'))) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-slate-300">{t('reports.loading')}</div>;
  }

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-2xl border border-cyan-500/10 bg-slate-900/55 backdrop-blur-md p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-100 tracking-tight">{t('reports.management_devices')}</h2>
              <p className="text-slate-400 text-sm mt-1">{t('reports.track_devices_branches')}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowAddModal(true)}
                className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold"
                data-testid="button-add-top"
              >
                <Plus className="h-4 w-4 ml-2" />
                {t('reports.add_device_new')}
              </Button>
              <Button asChild variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20">
                <Link href="/withdrawn-devices/all">
                  <FileClock className="h-4 w-4 ml-2" />
                  {t('reports.log_operations_returned')}
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20">
                <Link href="/withdrawn-devices">{t('reports.item_19160')}</Link>
              </Button>
            </div>
          </div>

          <div className="mt-5 relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
            <Input
              type="text"
              placeholder={t('reports.search_1')}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pr-9 bg-slate-950/40 border-cyan-500/15 text-white placeholder:text-slate-500"
              data-testid="input-search"
            />
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/55 border border-amber-500/20 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">{t('reports.pending_review_1')}</p>
                <p className="text-3xl font-black text-slate-100 mt-1">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <TriangleAlert className="h-6 w-6" />
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900/55 border border-emerald-500/20 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">{t('reports.ok_1')}</p>
                <p className="text-3xl font-black text-slate-100 mt-1">{stats.approved}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900/55 border border-rose-500/20 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">{t('reports.item_9566')}</p>
                <p className="text-3xl font-black text-slate-100 mt-1">{stats.rejected}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                <XCircle className="h-6 w-6" />
              </div>
            </div>
          </Card>
        </section>

        <section className="flex items-center gap-2 border-b border-cyan-500/10 overflow-x-auto">
          {([
            { key: "pending", label: t('reports.pending_review_1') },
            { key: "approved", label: t('reports.ok_2') },
            { key: "rejected", label: t('reports.rejected') },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? "px-7 py-3.5 text-sm font-bold text-cyan-300 border-b-2 border-cyan-300"
                  : "px-7 py-3.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
              }
              data-testid={`tab-${tab.key}`}
            >
              {tab.label}
            </button>
          ))}
        </section>

        <section className="space-y-4">
          {filteredDevices.length > 0 ? (
            filteredDevices.map((device) => {
              const cfg = statusConfig[device.reviewStatus as DeviceReviewStatus];
              const StatusIcon = cfg.icon;
              const hasBattery = hasAccessory(device.battery);
              const hasCable = hasAccessory(device.chargerCable);
              const hasHead = hasAccessory(device.chargerHead);
              const hasSim = hasAccessory(device.hasSim);

              return (
                <Card
                  key={device.id}
                  className={`bg-slate-900/55 border border-cyan-500/10 overflow-hidden ${cfg.borderClass}`}
                  data-testid={`card-device-${device.id}`}
                >
                  <div className="p-5">
                    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full border ${cfg.badgeClass}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {cfg.text}
                          </span>
                          <span className="text-slate-400 text-xs">{formatCardDate(device.createdAt)}</span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-100 mt-2" dir="ltr">
                          ID: <span className="text-cyan-300">{device.terminalId}</span>
                          <span className="text-slate-500 mx-2">|</span>
                          SN: <span className="text-slate-300">{device.serialNumber}</span>
                        </h3>

                        <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                          <User className="h-4 w-4" />
                          <span>{device.technicianName}</span>
                          <span className="text-cyan-300">•</span>
                          <span>{device.city}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => handleEdit(device)}
                          className="h-9 w-9 border-white/10 bg-slate-800 text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-300"
                          data-testid={`button-edit-${device.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => handleDelete(device.id)}
                          className="h-9 w-9 border-white/10 bg-slate-800 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300"
                          data-testid={`button-delete-${device.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                          data-testid={`button-details-${device.id}`}
                        >
                          <Link href={`/withdrawn-devices/${device.id}`}>
                            <CircleEllipsis className="h-4 w-4 ml-1" />
                            {t('reports.details_1')}
                          </Link>
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs font-bold text-slate-500 mb-3">{t('reports.item_23905')}</p>
                        <div className="flex flex-wrap gap-2">
                          <div className="flex items-center gap-2 bg-slate-950/45 px-3 py-2 rounded-lg border border-cyan-500/10 text-slate-300 text-xs">
                            {hasBattery ? <CheckCircle2 className="h-4 w-4 text-cyan-300" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                            {t('reports.battery_1')}
                          </div>
                          <div className="flex items-center gap-2 bg-slate-950/45 px-3 py-2 rounded-lg border border-cyan-500/10 text-slate-300 text-xs">
                            {hasCable ? <CheckCircle2 className="h-4 w-4 text-cyan-300" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                            {t('reports.item_6358_1')}
                          </div>
                          <div className="flex items-center gap-2 bg-slate-950/45 px-3 py-2 rounded-lg border border-cyan-500/10 text-slate-300 text-xs">
                            {hasHead ? <CheckCircle2 className="h-4 w-4 text-cyan-300" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                            {t('reports.item_4743')}
                          </div>
                          <div className="flex items-center gap-2 bg-slate-950/45 px-3 py-2 rounded-lg border border-cyan-500/10 text-slate-300 text-xs">
                            {hasSim ? <CheckCircle2 className="h-4 w-4 text-cyan-300" /> : <XCircle className="h-4 w-4 text-rose-400" />}
                            SIM
                          </div>
                        </div>
                        {device.simCardType && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                            <Smartphone className="h-3.5 w-3.5" />
                            {t('reports.sim_type_label', { type: device.simCardType })}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-2">{t('reports.status_damage_1')}</p>
                          <div className="flex items-center gap-2 text-sm text-slate-300 bg-rose-500/5 p-2.5 rounded-lg border border-rose-500/15">
                            <TriangleAlert className="h-4 w-4 text-rose-400" />
                            <span>{device.damagePart || t('reports.no_notes_damage')}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-2">{t('reports.notes')}</p>
                          <p className="text-sm text-slate-400 italic">{device.notes || t('reports.no_notes_1')}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="h-1 bg-slate-800 w-full overflow-hidden">
                    <div className={`h-full ${cfg.progressClass} ${cfg.progressWidth}`} />
                  </div>
                </Card>
              );
            })
          ) : (
            <Card className="p-12 border-2 border-dashed border-cyan-500/10 bg-slate-900/40 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800/70 flex items-center justify-center text-slate-500 mx-auto mb-4">
                <Smartphone className="h-8 w-8" />
              </div>
              <h4 className="text-slate-300 font-bold">{t('reports.no_devices_category')}</h4>
              <p className="text-slate-500 text-sm max-w-xs mt-2 mx-auto">{t('reports.devices')}</p>
              <Button onClick={() => setShowAddModal(true)} className="mt-5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold">
                <Plus className="h-4 w-4 ml-2" />
                {t('reports.add_device_new')}
              </Button>
            </Card>
          )}
        </section>
      </div>

      <AddWithdrawnDeviceModal open={showAddModal} onOpenChange={setShowAddModal} />
      <EditWithdrawnDeviceModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        device={selectedDevice}
      />
    </>
  );
}
