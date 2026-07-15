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
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    },
    approved: {
      label: t('common.item_7964'),
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    rejected: {
      label: t('common.rejected'),
      badgeClass: "bg-red-50 text-red-700 border-red-200",
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
        <Skeleton className="h-12 w-72 bg-slate-100" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-28 bg-slate-100" />
          ))}
        </div>
        <Skeleton className="h-80 bg-slate-100" />
      </div>
    );
  }

  if (!itemType) {
    return (
      <Card className="rounded-2xl bg-white border-slate-200/80 shadow-sm">
        <CardContent className="p-10 text-center space-y-4">
          <Package className="h-12 w-12 text-slate-400 mx-auto" />
          <h2 className="text-xl font-bold text-slate-800">{t('common.item_20812')}</h2>
          <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
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
      <div className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-md p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <Link href="/item-types" className="hover:text-[#18B2B0] transition-colors">
                {t('common.management_1')}
              </Link>
              <span>/</span>
              <span className="text-[#18B2B0]">{t('common.details')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">{itemType.nameAr}</h1>
            <p className="text-slate-500">{itemType.nameEn} • SKU: {itemType.id}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-[#18B2B0]/10 text-[#18B2B0] border-[#18B2B0]/20">
              {CATEGORY_LABELS[itemType.category] ?? itemType.category}
            </Badge>
            <Badge className="bg-slate-100 text-slate-700 border-slate-200">
              {t('inventory.count_carton', { count: t('common.unit_4', { count: itemType.unitsPerBox }) })}
            </Badge>
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <Link href="/item-types">
                <ArrowLeft className="h-4 w-4 ml-2" />
                {t('common.item_6366')}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {!isTrackableCategory ? (
        <Card className="rounded-2xl bg-white border-slate-200/80 shadow-sm">
          <CardContent className="p-10 text-center space-y-3">
            <Package className="h-12 w-12 text-slate-400 mx-auto" />
            <h2 className="text-xl font-bold text-slate-800">{t('common.track_serial')}</h2>
            <p className="text-slate-500">{t('common.track_serial_devices')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="rounded-2xl bg-white border-slate-200/80 shadow-sm overflow-hidden">
              <div className="h-1 bg-[#18B2B0]" />
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{t('common.total')}</p>
                  <p className="text-2xl font-extrabold text-slate-900">{stats.total}</p>
                </div>
                <Smartphone className="h-7 w-7 text-[#18B2B0]" />
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-white border-slate-200/80 shadow-sm overflow-hidden">
              <div className="h-1 bg-amber-500" />
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{t('common.pending_review')}</p>
                  <p className="text-2xl font-extrabold text-slate-900">{stats.pending}</p>
                </div>
                <Clock3 className="h-7 w-7 text-amber-600" />
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-white border-slate-200/80 shadow-sm overflow-hidden">
              <div className="h-1 bg-emerald-500" />
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{t('common.item_7964')}</p>
                  <p className="text-2xl font-extrabold text-slate-900">{stats.approved}</p>
                </div>
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-white border-slate-200/80 shadow-sm overflow-hidden">
              <div className="h-1 bg-red-500" />
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{t('common.rejected')}</p>
                  <p className="text-2xl font-extrabold text-slate-900">{stats.rejected}</p>
                </div>
                <XCircle className="h-7 w-7 text-red-600" />
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl bg-white border-slate-200/80 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-slate-800 text-lg sm:text-xl">{t('common.log_track_serial')}</CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-sm">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={t('common.search_serial_number_device_1')}
                    className="pr-10 bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-[#18B2B0] focus:ring-[#18B2B0]"
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
                          ? "border-[#18B2B0]/40 bg-[#18B2B0]/10 text-[#18B2B0]"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
                    <Skeleton key={index} className="h-12 bg-slate-100" />
                  ))}
                </div>
              ) : filteredDevices.length === 0 ? (
                <div className="p-12 text-center">
                  <Smartphone className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-800 mb-1">{t('common.no_logs')}</h3>
                  <p className="text-slate-500">{t('common.search_status_filter_results')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 hover:bg-transparent bg-slate-50/75">
                        <TableHead className="text-right text-slate-500 font-bold">{t('common.number_serial')}</TableHead>
                        <TableHead className="text-right text-slate-500 font-bold">{t('common.number_device')}</TableHead>
                        <TableHead className="text-right text-slate-500 font-bold">{t('common.technician')}</TableHead>
                        <TableHead className="text-right text-slate-500 font-bold">{t('common.status')}</TableHead>
                        <TableHead className="text-right text-slate-500 font-bold">{t('common.date_1')}</TableHead>
                        <TableHead className="text-right text-slate-500 font-bold">{t('common.item_14214')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDevices.map((device) => {
                        const status = STATUS_META[device.status];
                        const createdAt = new Date(device.createdAt);

                        return (
                          <TableRow key={device.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <TableCell className="font-mono text-[#18B2B0] font-semibold">{device.serialNumber}</TableCell>
                            <TableCell className="font-mono text-slate-800">{device.terminalId}</TableCell>
                            <TableCell className="text-slate-600 text-xs">
                              {device.technicianName || device.technicianId}
                            </TableCell>
                            <TableCell>
                              <Badge className={status.badgeClass}>{status.label}</Badge>
                            </TableCell>
                            <TableCell className="text-slate-600 text-sm">
                              {createdAt.toLocaleDateString("ar-SA")} {createdAt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                            </TableCell>
                            <TableCell>
                              <Button asChild variant="ghost" size="sm" className="text-[#18B2B0] hover:text-[#149d9b] hover:bg-[#18B2B0]/10">
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

