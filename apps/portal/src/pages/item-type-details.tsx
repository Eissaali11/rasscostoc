import { useTranslation } from "@/lib/language";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  Package,
  Smartphone,
  Clock3,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";
import type { ItemType } from "@shared/schema";

type DeviceStatus = "pending" | "approved" | "rejected";

interface ReceivedDevice {
  id: string;
  itemTypeId?: string | null;
  terminalId: string;
  serialNumber: string;
  status: DeviceStatus;
  technicianId: string;
  technicianName?: string | null;
  regionId?: string | null;
  createdAt: string | Date;
}

type StatusFilter = "all" | DeviceStatus;

export default function ItemTypeDetailsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const CATEGORY_LABELS = useMemo<Record<string, string>>(() => ({
    devices: t('common.devices'),
    papers: t('common.item_12737'),
    sim: t('common.sims'),
    accessories: t('common.item_17450'),
  }), [t]);

  const STATUS_META = useMemo<Record<DeviceStatus, { label: string; badgeClass: string }>>(() => ({
    pending: {
      label: t('common.pending_review'),
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    },
    approved: {
      label: t('common.item_7964'),
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    },
    rejected: {
      label: t('common.rejected'),
      badgeClass: "bg-red-500/15 text-red-300 border-red-500/25",
    },
  }), [t]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: itemType, isLoading: itemLoading } = useQuery<ItemType>({
    queryKey: [`/api/item-types/${id}`],
    enabled: !!id,
  });

  const isTrackableCategory = itemType?.category === "devices";

  const { data: receivedDevices = [], isLoading: devicesLoading } = useQuery<ReceivedDevice[]>({
    queryKey: [`/api/item-types/${id}/serial-tracking`],
    enabled: !!itemType && isTrackableCategory,
  });

  const filteredDevices = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return receivedDevices
      .filter((device) => {
        if (statusFilter !== "all" && device.status !== statusFilter) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        return (
          device.serialNumber.toLowerCase().includes(keyword) ||
          device.terminalId.toLowerCase().includes(keyword) ||
          device.technicianId.toLowerCase().includes(keyword) ||
          (device.technicianName || "").toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [receivedDevices, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = receivedDevices.length;
    const pending = receivedDevices.filter((device) => device.status === "pending").length;
    const approved = receivedDevices.filter((device) => device.status === "approved").length;
    const rejected = receivedDevices.filter((device) => device.status === "rejected").length;

    return { total, pending, approved, rejected };
  }, [receivedDevices]);

  if (itemLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-72 bg-slate-800/70" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-28 bg-slate-800/60" />
          ))}
        </div>
        <Skeleton className="h-80 bg-slate-800/60" />
      </div>
    );
  }

  if (!itemType) {
    return (
      <Card className="rounded-2xl bg-slate-900/45 border-slate-700/60 backdrop-blur-xl">
        <CardContent className="p-10 text-center space-y-4">
          <Package className="h-12 w-12 text-slate-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">{t('common.item_20812')}</h2>
          <Button asChild variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700">
            <Link href="/item-types">
              <ArrowLeft className="h-4 w-4 ml-2" />
              {t('common.item_30222')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/45 backdrop-blur-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <Link href="/item-types" className="hover:text-cyan-300 transition-colors">
                {t('common.management_1')}
              </Link>
              <span>/</span>
              <span className="text-cyan-300">{t('common.details')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{itemType.nameAr}</h1>
            <p className="text-slate-400">{itemType.nameEn} • SKU: {itemType.id}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-cyan-400/15 text-cyan-300 border-cyan-400/25">
              {CATEGORY_LABELS[itemType.category] ?? itemType.category}
            </Badge>
            <Badge className="bg-slate-800 text-slate-200 border-slate-600">
              {t('inventory.count_carton', { count: t('common.unit_4', { count: itemType.unitsPerBox }) })}
            </Badge>
            <Button asChild variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700">
              <Link href="/item-types">
                <ArrowLeft className="h-4 w-4 ml-2" />
                {t('common.item_6366')}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {!isTrackableCategory ? (
        <Card className="rounded-2xl bg-slate-900/45 border-slate-700/60 backdrop-blur-xl">
          <CardContent className="p-10 text-center space-y-3">
            <Package className="h-12 w-12 text-slate-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">{t('common.track_serial')}</h2>
            <p className="text-slate-400">{t('common.track_serial_devices')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="rounded-2xl bg-slate-900/45 border-slate-700/60 backdrop-blur-xl overflow-hidden">
              <div className="h-1 bg-cyan-400/80" />
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{t('common.total')}</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <Smartphone className="h-7 w-7 text-cyan-300" />
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-slate-900/45 border-slate-700/60 backdrop-blur-xl overflow-hidden">
              <div className="h-1 bg-amber-400/80" />
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{t('common.pending_review')}</p>
                  <p className="text-2xl font-bold text-white">{stats.pending}</p>
                </div>
                <Clock3 className="h-7 w-7 text-amber-300" />
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-slate-900/45 border-slate-700/60 backdrop-blur-xl overflow-hidden">
              <div className="h-1 bg-emerald-400/80" />
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{t('common.item_7964')}</p>
                  <p className="text-2xl font-bold text-white">{stats.approved}</p>
                </div>
                <CheckCircle2 className="h-7 w-7 text-emerald-300" />
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-slate-900/45 border-slate-700/60 backdrop-blur-xl overflow-hidden">
              <div className="h-1 bg-red-400/80" />
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{t('common.rejected')}</p>
                  <p className="text-2xl font-bold text-white">{stats.rejected}</p>
                </div>
                <XCircle className="h-7 w-7 text-red-300" />
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl bg-slate-900/45 border-slate-700/60 backdrop-blur-xl overflow-hidden">
            <CardHeader className="border-b border-slate-700/60 bg-slate-900/40">
              <CardTitle className="text-white text-lg sm:text-xl">{t('common.log_track_serial')}</CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-700/60 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-sm">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={t('common.search_serial_number_device_1')}
                    className="pr-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { value: "all", label: t('common.all') },
                    { value: "pending", label: t('common.pending_review') },
                    { value: "approved", label: t('common.item_7964') },
                    { value: "rejected", label: t('common.rejected') },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      variant="outline"
                      size="sm"
                      onClick={() => setStatusFilter(option.value as StatusFilter)}
                      className={
                        statusFilter === option.value
                          ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-300"
                          : "border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700"
                      }
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {devicesLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map((index) => (
                    <Skeleton key={index} className="h-12 bg-slate-800/60" />
                  ))}
                </div>
              ) : filteredDevices.length === 0 ? (
                <div className="p-12 text-center">
                  <Smartphone className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-white mb-1">{t('common.no_logs')}</h3>
                  <p className="text-slate-400">{t('common.search_status_filter_results')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700/60 hover:bg-transparent bg-slate-900/25">
                        <TableHead className="text-right text-slate-400">{t('common.number_serial')}</TableHead>
                        <TableHead className="text-right text-slate-400">{t('common.number_device')}</TableHead>
                        <TableHead className="text-right text-slate-400">{t('common.technician')}</TableHead>
                        <TableHead className="text-right text-slate-400">{t('common.status')}</TableHead>
                        <TableHead className="text-right text-slate-400">{t('common.date_1')}</TableHead>
                        <TableHead className="text-right text-slate-400">{t('common.item_14214')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDevices.map((device) => {
                        const status = STATUS_META[device.status];
                        const createdAt = new Date(device.createdAt);

                        return (
                          <TableRow key={device.id} className="border-slate-700/50 hover:bg-slate-800/35 transition-colors">
                            <TableCell className="font-mono text-cyan-300">{device.serialNumber}</TableCell>
                            <TableCell className="font-mono text-white">{device.terminalId}</TableCell>
                            <TableCell className="text-slate-300 text-xs">
                              {device.technicianName || device.technicianId}
                            </TableCell>
                            <TableCell>
                              <Badge className={status.badgeClass}>{status.label}</Badge>
                            </TableCell>
                            <TableCell className="text-slate-300 text-sm">
                              {createdAt.toLocaleDateString("ar-SA")} {createdAt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                            </TableCell>
                            <TableCell>
                              <Button asChild variant="ghost" size="sm" className="text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10">
                                <Link href={`/received-devices/${device.id}`}>
                                  <Eye className="h-4 w-4 ml-1" />
                                  {t('common.view')}
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

