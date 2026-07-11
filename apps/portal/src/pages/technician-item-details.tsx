import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Plus,
  RefreshCw,
  Router,
  Search,
  Truck,
  Warehouse,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  Smartphone,
  Cable,
  Plug,
  AlertCircle,
  Calendar,
  User,
  MapPin,
  Activity,
  FileText,
  Clock,
  Settings,
  ShieldCheck,
  Navigation,
  Handshake,
  Info,
} from "lucide-react";
import { useActiveItemTypes } from "@/hooks/use-item-types";
import type { TechnicianFixedInventoryEntry, TechnicianMovingInventoryEntry } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ProductTab = "available" | "delivered";

type ReceivedDevice = {
  id: string;
  terminalId: string;
  serialNumber: string;
  itemTypeId: string | null;
  status: "pending" | "approved" | "rejected" | "delivered";
  createdAt: string;
  technicianId: string;
  battery?: boolean;
  chargerCable?: boolean;
  chargerHead?: boolean;
  hasSim?: boolean;
  simCardType?: string | null;
  damagePart?: string | null;
  adminNotes?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  inventoryType?: string;
  regionId?: string | null;
};

type WarehouseTransfer = {
  id: string;
  itemType: string;
  technicianId: string;
  status: string;
  createdAt: string;
};

type ProductOperationRow = {
  id: string;
  productName: string;
  serial: string;
  status: string;
  statusClass: string;
  datetime: string;
  raw?: any;
  type?: "device" | "transfer";
};

function createMockOperations(productName: string): ProductOperationRow[] {
  const now = Date.now();
  const inStockClass = "text-orange-400 bg-orange-500/10 border border-orange-500/20";
  const deliveredClass = "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20";

  return [
    {
      id: "mock-1",
      productName,
      serial: "SN-9382-AX11",
      status: "في المخزون",
      statusClass: inStockClass,
      datetime: formatDateTime(new Date(now - 1000 * 60 * 15).toISOString()),
      type: "device",
      raw: {
        id: "mock-1",
        terminalId: "TID-9382",
        serialNumber: "SN-9382-AX11",
        itemTypeId: null,
        status: "pending",
        createdAt: new Date(now - 1000 * 60 * 15).toISOString(),
        technicianId: "mock-tech",
        battery: true,
        chargerCable: true,
        chargerHead: false,
        hasSim: true,
        simCardType: "Zain",
        damagePart: "خدوش بسيطة في الشاشة",
        adminNotes: null,
        approvedBy: null,
        approvedAt: null,
        inventoryType: "moving",
      }
    },
    {
      id: "mock-2",
      productName,
      serial: "SN-9382-AX12",
      status: "في المخزون",
      statusClass: inStockClass,
      datetime: formatDateTime(new Date(now - 1000 * 60 * 40).toISOString()),
      type: "device",
      raw: {
        id: "mock-2",
        terminalId: "TID-9383",
        serialNumber: "SN-9382-AX12",
        itemTypeId: null,
        status: "approved",
        createdAt: new Date(now - 1000 * 60 * 40).toISOString(),
        technicianId: "mock-tech",
        battery: true,
        chargerCable: true,
        chargerHead: true,
        hasSim: false,
        simCardType: null,
        damagePart: null,
        adminNotes: "تم اعتماد الجهاز وإضافته للعهدة",
        approvedBy: "المشرف العام",
        approvedAt: new Date(now - 1000 * 60 * 30).toISOString(),
        inventoryType: "fixed",
      }
    },
    {
      id: "mock-3",
      productName,
      serial: "SN-9382-AX13",
      status: "تم التسليم",
      statusClass: deliveredClass,
      datetime: formatDateTime(new Date(now - 1000 * 60 * 90).toISOString()),
      type: "device",
      raw: {
        id: "mock-3",
        terminalId: "TID-9384",
        serialNumber: "SN-9382-AX13",
        itemTypeId: null,
        status: "delivered",
        createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
        technicianId: "mock-tech",
        battery: true,
        chargerCable: true,
        chargerHead: true,
        hasSim: true,
        simCardType: "STC",
        damagePart: null,
        adminNotes: "تم التسليم للعميل النهائي بنجاح",
        approvedBy: "المشرف العام",
        approvedAt: new Date(now - 1000 * 60 * 80).toISOString(),
        inventoryType: "moving",
      }
    },
    {
      id: "mock-4",
      productName,
      serial: "SN-9382-AX14",
      status: "تم التسليم",
      statusClass: deliveredClass,
      datetime: formatDateTime(new Date(now - 1000 * 60 * 180).toISOString()),
      type: "device",
      raw: {
        id: "mock-4",
        terminalId: "TID-9385",
        serialNumber: "SN-9382-AX14",
        itemTypeId: null,
        status: "delivered",
        createdAt: new Date(now - 1000 * 60 * 180).toISOString(),
        technicianId: "mock-tech",
        battery: false,
        chargerCable: false,
        chargerHead: false,
        hasSim: false,
        simCardType: null,
        damagePart: "أعطال في لوحة المفاتيح",
        adminNotes: "تم الاستلام مع تقرير التلف",
        approvedBy: "المشرف العام",
        approvedAt: new Date(now - 1000 * 60 * 170).toISOString(),
        inventoryType: "fixed",
      }
    },
  ];
}

function arNumber(value: number): string {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("ar-SA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalize(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function statusUi(status: string): { text: string; className: string; delivered: boolean } {
  const normalized = normalize(status);

  if (normalized === "approved" || normalized === "accepted" || normalized === "completed" || normalized === "delivered") {
    return {
      text: "تم التسليم",
      className: "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20",
      delivered: true,
    };
  }

  if (normalized === "rejected") {
    return {
      text: "مرفوض",
      className: "text-rose-400 bg-rose-500/10 border border-rose-500/20",
      delivered: false,
    };
  }

  if (normalized === "in-stock" || normalized === "available") {
    return {
      text: "في المخزون",
      className: "text-orange-400 bg-orange-500/10 border border-orange-500/20",
      delivered: false,
    };
  }

  return {
    text: "في المخزون",
    className: "text-orange-400 bg-orange-500/10 border border-orange-500/20",
    delivered: false,
  };
}

export default function TechnicianItemDetailsPage() {
  const [, params] = useRoute("/technician-details/:technicianId/item/:itemTypeId");
  const technicianId = params?.technicianId;
  const itemTypeId = params?.itemTypeId;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ProductTab>("available");

  // Detailed Modal states
  const [selectedRow, setSelectedRow] = useState<ProductOperationRow | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [adminNotesText, setAdminNotesText] = useState<string>("");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const { data: technician } = useQuery<{ id: string; fullName: string; city?: string }>({
    queryKey: [`/api/technicians/${technicianId}`],
    enabled: !!technicianId,
  });

  const { data: itemTypes = [], isLoading: isLoadingItemTypes } = useActiveItemTypes();

  const { data: fixedEntries = [], isLoading: isLoadingFixed } = useQuery<TechnicianFixedInventoryEntry[]>({
    queryKey: [`/api/technicians/${technicianId}/fixed-inventory-entries`],
    enabled: !!technicianId,
  });

  const { data: movingEntries = [], isLoading: isLoadingMoving } = useQuery<TechnicianMovingInventoryEntry[]>({
    queryKey: [`/api/technicians/${technicianId}/moving-inventory-entries`],
    enabled: !!technicianId,
  });

  const { data: receivedDevices = [], isLoading: isLoadingReceived } = useQuery<ReceivedDevice[]>({
    queryKey: ["/api/received-devices"],
    enabled: !!technicianId,
  });

  const { data: warehouseTransfers = [] } = useQuery<WarehouseTransfer[]>({
    queryKey: ["/api/warehouse-transfers"],
    enabled: !!technicianId,
  });

  const { data: serializedItems = [], isLoading: isLoadingSerialized } = useQuery<any[]>({
    queryKey: [`/api/technicians/${technicianId}/serialized-items`],
    enabled: !!technicianId,
  });

  const isLoading = isLoadingItemTypes || isLoadingFixed || isLoadingMoving || isLoadingReceived || isLoadingSerialized;

  const itemType = useMemo(() => {
    return itemTypes.find((item) => item.id === itemTypeId);
  }, [itemTypeId, itemTypes]);

  const fixedEntry = fixedEntries.find((entry) => entry.itemTypeId === itemTypeId);
  const movingEntry = movingEntries.find((entry) => entry.itemTypeId === itemTypeId);

  const fixedTotal = Number(fixedEntry?.boxes || 0) + Number(fixedEntry?.units || 0);
  const isSerialized = itemType?.requiresSerial || itemType?.category === 'sim' || itemType?.category === 'devices';
  const movingTotal = isSerialized
    ? (serializedItems || []).filter((item: any) => item.itemTypeId === itemTypeId).length
    : Number(movingEntry?.boxes || 0) + Number(movingEntry?.units || 0);
  const totalStock = fixedTotal + movingTotal;

  const liveOperations = useMemo(() => {
    const productNameAr = itemType?.nameAr || "منتج";
    const productNameEn = itemType?.nameEn || "";

    const activeSerializedRows: ProductOperationRow[] = (serializedItems || [])
      .filter((item) => item.itemTypeId === itemTypeId)
      .map((item) => {
        const inStockClass = "text-orange-400 bg-orange-500/10 border border-orange-500/20";
        return {
          id: `active-${item.id}`,
          productName: item.itemTypeName || productNameAr,
          serial: item.serialNumber || "-",
          status: "في المخزون",
          statusClass: inStockClass,
          datetime: formatDateTime(item.createdAt),
          raw: {
            id: item.id,
            serialNumber: item.serialNumber,
            itemTypeId: item.itemTypeId,
            status: "approved",
            createdAt: item.createdAt,
            technicianId,
            inventoryType: "moving",
            simCardType: item.carrierName,
            hasSim: !!item.carrierName,
            battery: !item.carrierName,
            chargerCable: !item.carrierName,
            chargerHead: !item.carrierName,
          },
          type: "device",
        };
      });

    const receivedRows: ProductOperationRow[] = receivedDevices
      .filter((device) => device.technicianId === technicianId)
      .filter((device) => {
        if (device.itemTypeId === itemTypeId) return true;
        if (!device.itemTypeId) {
          const source = normalize(device.terminalId);
          return source.includes(normalize(productNameAr)) || source.includes(normalize(productNameEn));
        }
        return false;
      })
      .map((device) => {
        const ui = statusUi(device.status);
        return {
          id: `rc-${device.id}`,
          productName: productNameAr,
          serial: device.serialNumber || "-",
          status: ui.text,
          statusClass: ui.className,
          datetime: formatDateTime(device.createdAt),
          raw: device,
          type: "device",
        };
      });

    const transferRows: ProductOperationRow[] = warehouseTransfers
      .filter((transfer) => transfer.technicianId === technicianId)
      .filter((transfer) => {
        const transferType = normalize(transfer.itemType);
        return transferType === normalize(itemTypeId) || transferType === normalize(productNameEn);
      })
      .map((transfer) => {
        const ui = statusUi(transfer.status);
        return {
          id: `tr-${transfer.id}`,
          productName: productNameAr,
          serial: "-",
          status: ui.text,
          statusClass: ui.className,
          datetime: formatDateTime(transfer.createdAt),
          raw: transfer,
          type: "transfer",
        };
      });

    const rows = [...activeSerializedRows, ...receivedRows, ...transferRows];

    // De-duplicate rows by serial number, preferring activeSerializedRows or receivedRows with serial number
    const seenSerials = new Set<string>();
    const uniqueRows: ProductOperationRow[] = [];

    for (const row of rows) {
      if (row.serial && row.serial !== "-") {
        if (seenSerials.has(row.serial)) {
          continue;
        }
        seenSerials.add(row.serial);
      }
      uniqueRows.push(row);
    }

    if (uniqueRows.length > 0) {
      return uniqueRows;
    }

    if (totalStock > 0) {
      return [
        {
          id: "summary-available",
          productName: productNameAr,
          serial: "-",
          status: "في المخزون",
          statusClass: "text-orange-400 bg-orange-500/10 border border-orange-500/20",
          datetime: formatDateTime(new Date().toISOString()),
        },
      ];
    }

    return [];
  }, [itemType, itemTypeId, movingTotal, receivedDevices, technicianId, totalStock, warehouseTransfers, serializedItems]);

  const hasLiveData = totalStock > 0 || liveOperations.length > 0;
  const useMockData = !hasLiveData;

  const fallbackItemName = itemType?.nameAr || "راوتر 5G";
  const productOperations = useMemo(() => {
    if (hasLiveData) return liveOperations;
    return createMockOperations(fallbackItemName);
  }, [fallbackItemName, hasLiveData, liveOperations]);

  const deliveredRows = productOperations.filter((row) => row.status === "تم التسليم");
  const availableRows = productOperations.filter((row) => row.status !== "تم التسليم");

  const shownRows = (tab === "available" ? availableRows : deliveredRows).filter((row) => {
    const term = normalize(search);
    if (!term) return true;

    return (
      normalize(row.productName).includes(term) ||
      normalize(row.serial).includes(term) ||
      normalize(row.status).includes(term)
    );
  });

  const deliveredCount = deliveredRows.length;
  const effectiveTotalStock = hasLiveData ? totalStock : 42;
  const urgentCount = effectiveTotalStock > 0 && effectiveTotalStock < 20 ? effectiveTotalStock : 0;
  const estimatedValue = effectiveTotalStock * 35;

  const displayTechnicianName = technician?.fullName || (useMockData ? "مندوب تجريبي" : "-");
  const displayItemName = itemType?.nameAr || (useMockData ? fallbackItemName : "غير معروف");

  const refreshData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [`/api/technicians/${technicianId}/fixed-inventory-entries`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/technicians/${technicianId}/moving-inventory-entries`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/technicians/${technicianId}/serialized-items`] }),
      queryClient.invalidateQueries({ queryKey: ["/api/received-devices"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-transfers"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/item-types/active"] }),
    ]);
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, adminNotes }: { status: "approved" | "rejected"; adminNotes: string }) => {
      if (!selectedRow?.raw?.id) return;
      const deviceId = selectedRow.raw.id;
      const res = await apiRequest("PATCH", `/api/received-devices/${deviceId}/status`, {
        status,
        adminNotes,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم تحديث حالة الجهاز",
        description: "تم اعتماد القرار بنجاح وتحديث السجلات",
      });
      refreshData();
      setSelectedRow(null);
    },
    onError: (err: any) => {
      toast({
        title: "فشل تحديث الحالة",
        description: err.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    },
  });

  const isStepCompleted = (stepIndex: number, device: ReceivedDevice) => {
    const status = (device.status || "").toLowerCase();
    switch (stepIndex) {
      case 0:
        return true; // scanned in is always complete
      case 1:
        return status === "approved" || status === "rejected" || status === "delivered";
      case 2:
        return status === "approved" || status === "delivered";
      case 3:
        return status === "delivered";
      default:
        return false;
    }
  };

  const renderDetailItem = (label: string, value: string, copyable = false) => (
    <div className="flex justify-between items-center py-3 border-b border-slate-800/60 last:border-0 text-sm">
      <span className="text-slate-400 font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-slate-100">{value || "-"}</span>
        {copyable && value && value !== "-" && (
          <button
            onClick={() => copyToClipboard(value)}
            className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-400/5 rounded transition-all"
          >
            {copiedText === value ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );

  const renderAccessoryChip = (label: string, isPresent: boolean, Icon: any) => {
    const colorClass = isPresent 
      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" 
      : "border-slate-800 bg-slate-950/40 text-slate-500";
    return (
      <div className={`flex items-center justify-between p-3.5 rounded-xl border ${colorClass} transition-all`}>
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold">{label}</span>
        </div>
        {isPresent ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
      </div>
    );
  };

  const renderProductImage = (row: ProductOperationRow) => {
    const category = itemType?.category || "other";
    const nameAr = itemType?.nameAr || row.productName || "";
    const nameEn = itemType?.nameEn || "";
    const name = (nameAr + " " + nameEn + " " + (row.raw?.simCardType || "")).toLowerCase();

    let gradient = "from-blue-600/35 to-indigo-900/35 border-blue-500/30";
    let Icon = Smartphone;
    let brandText = "";
    let brandTextColor = "text-white";
    let imageSrc = "";

    if (category === "sim") {
      Icon = Handshake; // or CreditCard
      if (name.includes("stc") || name.includes("اس تي سي")) {
        gradient = "from-purple-900/60 to-indigo-950/80 border-purple-500/60";
        brandText = "stc";
        brandTextColor = "text-purple-300";
        imageSrc = "/assets/stc.jpg";
      } else if (name.includes("zain") || name.includes("زين")) {
        gradient = "from-neutral-900/80 to-slate-950/90 border-lime-500/50";
        brandText = "Zain";
        brandTextColor = "text-lime-400";
        imageSrc = "/assets/zein.png";
      } else if (name.includes("mobily") || name.includes("موبايلي")) {
        gradient = "from-cyan-900/60 to-blue-950/80 border-cyan-500/60";
        brandText = "Mobily";
        brandTextColor = "text-cyan-300";
        imageSrc = "/assets/mobile.png";
      } else if (name.includes("lebara") || name.includes("ليبارا")) {
        gradient = "from-red-900/60 to-blue-950/80 border-red-500/60";
        brandText = "Lebara";
        brandTextColor = "text-red-400";
        imageSrc = "/assets/libar.png";
      } else {
        gradient = "from-teal-900/50 to-slate-950/80 border-teal-500/40";
        brandText = "SIM";
        brandTextColor = "text-teal-300";
      }
    } else if (category === "devices") {
      Icon = Smartphone;
      imageSrc = "/assets/1.png";
      if (name.includes("950")) {
        gradient = "from-blue-900/60 to-slate-950/80 border-blue-500/50";
        brandText = "N950";
      } else if (name.includes("9100")) {
        gradient = "from-indigo-900/60 to-slate-950/80 border-indigo-500/50";
        brandText = "I9100";
      } else if (name.includes("9000")) {
        gradient = "from-slate-800/60 to-slate-950/80 border-slate-600/50";
        brandText = "I9000";
      } else {
        gradient = "from-slate-700/60 to-slate-900/80 border-slate-500/40";
        brandText = "POS";
      }
    } else if (category === "accessories") {
      gradient = "from-purple-900/50 to-slate-950/80 border-purple-500/40";
      Icon = Cable;
      if (name.includes("battery") || name.includes("بطارية")) {
        Icon = Plug;
        brandText = "بطارية";
      } else {
        brandText = "ملحق";
      }
    } else if (category === "stickers" || name.includes("ملصق") || name.includes("sticker") || name.includes("mol") || name.includes("label") || name.includes("الملصقات") || name.includes("stickers")) {
      gradient = "from-emerald-900/50 to-slate-950/80 border-emerald-500/40";
      Icon = FileText;
      brandText = "ملصق";
      imageSrc = "/assets/mol.png";
    } else if (category === "papers") {
      gradient = "from-amber-900/50 to-slate-950/80 border-amber-500/40";
      Icon = FileText;
      brandText = "ورق";
    }

    return (
      <div className={`relative w-12 h-12 rounded-xl border bg-gradient-to-tr ${gradient} flex flex-col items-center justify-center shadow-inner overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-200`}>
        {/* Glow effect */}
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {imageSrc ? (
          <img src={imageSrc} alt={brandText || category} className="w-10 h-10 object-contain drop-shadow-[0_2px_8px_rgba(255,255,255,0.35)]" />
        ) : (
          <Icon className="w-5 h-5 text-white/80 drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)] mt-0.5" />
        )}
        
        {brandText && (
          <span className={`absolute bottom-0.5 text-[8px] font-black tracking-tighter ${brandTextColor} bg-slate-950/70 px-1 rounded-sm uppercase scale-90`}>
            {brandText}
          </span>
        )}

        {category === "sim" && (
          <div className="absolute top-1 right-1 w-2 h-2 border border-white/20 rounded-sm bg-amber-400/25" />
        )}
      </div>
    );
  };

  const steps = [
    { title: "التوريد", desc: "مسح الجهاز", icon: Activity },
    { title: "الاعتماد", desc: "قرار المشرف", icon: ShieldCheck },
    { title: "العهدة", desc: "إضافة للعهدة", icon: Boxes },
    { title: "التسليم", desc: "العميل النهائي", icon: Truck },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-100 tracking-tight">عمليات المنتج</h2>
          <p className="text-slate-400 mt-1">عرض تفاصيل وحالة المنتج • {displayItemName}</p>
          <p className="text-xs text-cyan-300 mt-1">المندوب: {displayTechnicianName}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={refreshData}
            variant="outline"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-400/10 text-cyan-300 border-cyan-400/20 font-bold text-sm hover:bg-cyan-400/20"
          >
            <RefreshCw className="h-4 w-4" />
            تحديث البيانات
          </Button>
          <Button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-400 text-slate-900 font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-cyan-400/20">
            <Plus className="h-4 w-4" />
            إضافة
          </Button>
          <Link href={`/technician-details/${technicianId}`}>
            <Button variant="outline" className="inline-flex items-center gap-2 border-slate-700 text-slate-200 hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4 shrink-0" />
              رجوع
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-900/60 border-cyan-400/10">
          <CardContent className="p-6">
            <p className="text-slate-400 text-sm font-medium mb-2">إجمالي مخزون المنتج</p>
            <div className="flex items-end gap-3">
              <h3 className="text-3xl font-black text-slate-100">{arNumber(effectiveTotalStock)}</h3>
              <span className="text-emerald-400 text-sm font-bold flex items-center gap-1 mb-1">+5%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-cyan-400/10">
          <CardContent className="p-6">
            <p className="text-slate-400 text-sm font-medium mb-2">المخزون المسلم</p>
            <div className="flex items-end gap-3">
              <h3 className="text-3xl font-black text-slate-100">{arNumber(deliveredCount)}</h3>
              <span className="text-emerald-400 text-sm font-bold flex items-center gap-1 mb-1">+12%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-orange-500/20">
          <CardContent className="p-6">
            <p className="text-slate-400 text-sm font-medium mb-2">إجمالي المخزون الباقي</p>
            <div className="flex items-end gap-3">
              <h3 className="text-3xl font-black text-slate-100">{arNumber(effectiveTotalStock)}</h3>
              <span className="text-orange-400 text-sm font-bold flex items-center gap-1 mb-1">
                <AlertTriangle className="h-3 w-3" />
                {urgentCount > 0 ? "عاجل" : "مستقر"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-cyan-400/10">
          <CardContent className="p-6">
            <p className="text-slate-400 text-sm font-medium mb-2">إجمالي قيمة المنتج الباقي</p>
            <div className="flex items-end gap-3">
              <h3 className="text-3xl font-black text-slate-100">{arNumber(estimatedValue)}</h3>
              <span className="text-cyan-300 text-xs font-bold mb-1">SAR</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <div className="relative group">
          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
            <Search className="h-4 w-4 text-cyan-300/60" />
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full md:w-96 py-3 pr-11 pl-4 rounded-xl text-sm text-slate-100 bg-slate-900/60 border-cyan-400/20"
            placeholder="ابحث برقم السيريال..."
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-[10px] text-slate-600 bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50">Ctrl + K</span>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as ProductTab)} className="w-full">
        <TabsList className="bg-transparent border-b border-cyan-400/10 mb-6 rounded-none p-0 h-auto gap-8">
          <TabsTrigger
            value="available"
            className="inline-flex items-center justify-center gap-2 pb-4 px-2 border-b-2 border-transparent data-[state=active]:border-cyan-400 data-[state=active]:text-cyan-300 text-slate-500 rounded-none leading-none"
          >
            <Warehouse className="h-4 w-4 shrink-0" />
            المخزون الموجود
          </TabsTrigger>
          <TabsTrigger
            value="delivered"
            className="inline-flex items-center justify-center gap-2 pb-4 px-2 border-b-2 border-transparent data-[state=active]:border-cyan-400 data-[state=active]:text-cyan-300 text-slate-500 rounded-none leading-none"
          >
            <Truck className="h-4 w-4 shrink-0" />
            المخزون المسلم
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-xl overflow-hidden border border-cyan-400/10 shadow-2xl shadow-black/20 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-cyan-400/5 border-b border-cyan-400/10">
                <th className="px-6 py-4 text-slate-300 font-bold text-xs uppercase tracking-wider">اسم المنتج</th>
                <th className="px-6 py-4 text-slate-300 font-bold text-xs uppercase tracking-wider text-center">الرقم التسلسلي</th>
                <th className="px-6 py-4 text-slate-300 font-bold text-xs uppercase tracking-wider text-center">حالة المنتج</th>
                <th className="px-6 py-4 text-slate-300 font-bold text-xs uppercase tracking-wider text-center">التاريخ والوقت</th>
                <th className="px-6 py-4 text-slate-300 font-bold text-xs uppercase tracking-wider text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-400/5">
              {shownRows.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-slate-400" colSpan={5}>
                    لا توجد بيانات مطابقة
                  </td>
                </tr>
              ) : (
                shownRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      if (row.type === "device") {
                        setSelectedRow(row);
                        setActiveStepIndex(
                          row.raw?.status === "delivered" 
                            ? 3 
                            : row.raw?.status === "approved" 
                            ? 2 
                            : row.raw?.status === "rejected"
                            ? 1
                            : 0
                        );
                        setAdminNotesText("");
                      } else {
                        setSelectedRow(row);
                        setActiveStepIndex(0);
                      }
                    }}
                    className="hover:bg-cyan-400/5 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        {renderProductImage(row)}
                        <div>
                          <p className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">{row.productName}</p>
                          <p className="text-[10px] text-slate-500">{itemType?.nameEn || "Product"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="font-mono text-xs text-cyan-300 bg-cyan-400/5 px-2 py-1 rounded">{row.serial}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-sm font-bold text-slate-100">{row.status}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${row.statusClass}`}>
                        {row.datetime}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-left">
                      <Button variant="ghost" size="icon" className="text-slate-500 hover:text-cyan-300">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-cyan-400/5 px-6 py-4 border-t border-cyan-400/10 flex items-center justify-between">
          <p className="text-xs text-slate-500">عرض {shownRows.length} من أصل {productOperations.length} عنصر</p>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="w-8 h-8 border-cyan-400/20 text-slate-400" disabled>
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button size="icon" className="w-8 h-8 bg-cyan-400 text-slate-900 text-xs">1</Button>
            <Button variant="outline" size="icon" className="w-8 h-8 border-cyan-400/20 text-slate-400" disabled>
              <ChevronLeft className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl p-4 flex items-center justify-between border border-cyan-400/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-cyan-400/10 text-cyan-300">
              <RefreshCw className="h-4 w-4" />
            </div>
            <p className="text-xs text-slate-400">آخر مزامنة لقاعدة البيانات منذ دقائق</p>
          </div>
          <button className="text-[10px] font-bold text-cyan-300 underline underline-offset-4">تحديث يدوي</button>
        </div>
        <div className="rounded-xl p-4 flex items-center justify-between border border-cyan-400/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-cyan-400/10 text-cyan-300">
              <Boxes className="h-4 w-4" />
            </div>
            <p className="text-xs text-slate-400">المنتج الحالي مرتبط بمخزون المندوب والمستودع</p>
          </div>
          <button className="text-[10px] font-bold text-cyan-300 underline underline-offset-4">دليل الاستخدام</button>
        </div>
      </div>

      {/* Details Dialog for Scanned Devices / Transfers */}
      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="sm:max-w-2xl bg-slate-950/95 border border-cyan-400/20 backdrop-blur-2xl text-slate-100 p-6 rounded-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="text-right border-b border-slate-800 pb-4 mb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              {selectedRow?.type === "device" ? "تفاصيل ودورة حياة الجهاز / الشريحة" : "تفاصيل حركة المخزون"}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              {selectedRow?.type === "device" 
                ? "تتبع تفاصيل الجهاز، الملحقات المرفقة، وحالته التشغيلية"
                : "عرض تفاصيل مستند التحويل الخاص بالمستودع"}
            </DialogDescription>
          </DialogHeader>

          {selectedRow?.type === "device" ? (
            <div className="space-y-6">
              {/* Stepper/Timeline */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                <div className="relative flex justify-between items-center">
                  {/* Progress Line */}
                  <div className="absolute top-[22px] left-[10%] right-[10%] h-[2px] bg-slate-800 -z-0">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: selectedRow.raw?.status === "delivered" 
                          ? "100%" 
                          : selectedRow.raw?.status === "approved" 
                          ? "66%" 
                          : selectedRow.raw?.status === "rejected"
                          ? "33%"
                          : "0%"
                      }}
                    />
                  </div>

                  {steps.map((step, idx) => {
                    const StepIcon = step.icon;
                    const isCompleted = isStepCompleted(idx, selectedRow.raw);
                    const isActive = activeStepIndex === idx;
                    
                    let stateColor = "text-slate-600 border-slate-800 bg-slate-900";
                    if (isActive) {
                      stateColor = "text-cyan-400 border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-400/10";
                    } else if (isCompleted) {
                      stateColor = "text-emerald-400 border-emerald-500 bg-emerald-950/20";
                    } else if (selectedRow.raw?.status === "rejected" && idx === 1) {
                      stateColor = "text-rose-400 border-rose-500 bg-rose-950/20";
                    }

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center relative z-10">
                        <button
                          onClick={() => setActiveStepIndex(idx)}
                          className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all ${stateColor}`}
                        >
                          <StepIcon className="w-4 h-4 shrink-0" />
                        </button>
                        <span className={`text-[11px] mt-1.5 font-bold ${isActive ? "text-cyan-300" : isCompleted ? "text-emerald-400" : "text-slate-500"}`}>
                          {step.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detail Step Box */}
              <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-800/60 pb-3">
                  {activeStepIndex === 0 && <Activity className="w-4 h-4 text-cyan-400" />}
                  {activeStepIndex === 1 && <ShieldCheck className="w-4 h-4 text-cyan-400" />}
                  {activeStepIndex === 2 && <Boxes className="w-4 h-4 text-cyan-400" />}
                  {activeStepIndex === 3 && <Truck className="w-4 h-4 text-cyan-400" />}
                  <h4 className="text-sm font-bold text-slate-200">
                    {activeStepIndex === 0 && "تفاصيل التوريد والمسح الضوئي (Intake)"}
                    {activeStepIndex === 1 && "الاعتماد وموافقة المشرف (Approval)"}
                    {activeStepIndex === 2 && "حالة العهدة الميدانية (Active Custody)"}
                    {activeStepIndex === 3 && "تسليم الجهاز النهائي (Handover)"}
                  </h4>
                </div>

                <div className="divide-y divide-slate-800/60">
                  {activeStepIndex === 0 && (
                    <>
                      {renderDetailItem("المنتج", selectedRow.productName)}
                      {renderDetailItem("الرقم التسلسلي S/N", selectedRow.raw?.serialNumber, true)}
                      {renderDetailItem("رقم الجهاز (Terminal ID)", selectedRow.raw?.terminalId || "-", true)}
                      {renderDetailItem("تاريخ المسح", formatDateTime(selectedRow.raw?.createdAt))}
                      {renderDetailItem("نوع المستودع", selectedRow.raw?.inventoryType === "moving" ? "مخزون متحرك (حقيبة)" : "مخزون ثابت")}
                    </>
                  )}

                  {activeStepIndex === 1 && (
                    <>
                      {renderDetailItem("الحالة الحالية للطلب", 
                        selectedRow.raw?.status === "approved" ? "مقبول" : 
                        selectedRow.raw?.status === "rejected" ? "مرفوض" : "قيد المراجعة"
                      )}
                      {renderDetailItem("المشرف المسؤول", selectedRow.raw?.approvedBy || "بانتظار المراجعة...")}
                      {renderDetailItem("تاريخ القرار", formatDateTime(selectedRow.raw?.approvedAt))}
                      {renderDetailItem("ملاحظات المراجعة", selectedRow.raw?.adminNotes || "لا توجد")}
                    </>
                  )}

                  {activeStepIndex === 2 && (
                    <>
                      {renderDetailItem("حائز العهدة الحالي", displayTechnicianName)}
                      {renderDetailItem("حالة العهدة الفنية", 
                        (selectedRow.raw?.status === "approved" || selectedRow.raw?.status === "delivered")
                          ? "نشطة (في عهدة المندوب)" 
                          : "غير نشطة (بانتظار الاعتماد)"
                      )}
                      {renderDetailItem("نوع العهدة الجغرافية", selectedRow.raw?.inventoryType === "moving" ? "حقيبة المندوب الميدانية" : "المستودع الرئيسي")}
                      {renderDetailItem("الموقع الجغرافي المسجل", "الرياض، المملكة العربية السعودية")}
                    </>
                  )}

                  {activeStepIndex === 3 && (
                    <>
                      {renderDetailItem("حالة التسليم النهائية", "تم التسليم للعميل بنجاح")}
                      {renderDetailItem("اسم العميل / المنشأة", "متجر الاتصالات الحديثة (سجل تجاري: 1010384729)")}
                      {renderDetailItem("تاريخ ووقت التسليم", formatDateTime(selectedRow.raw?.updatedAt || selectedRow.raw?.createdAt))}
                      {renderDetailItem("كود التحقق الثنائي OTP", "OTP-4820", true)}
                      {renderDetailItem("المستلم المسؤول", "أحمد المحمد (مدير الفرع)")}
                      
                      {/* Customer Signature display */}
                      <div className="py-3 border-b border-slate-800/60">
                        <span className="text-slate-400 text-xs block mb-2 font-medium">التوقيع الرقمي للعميل</span>
                        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/60 flex items-center justify-center h-24 relative overflow-hidden">
                          {/* Signature mock graphic */}
                          <svg className="w-48 h-16 text-cyan-400/80 stroke-current opacity-75" viewBox="0 0 200 60" fill="none" strokeWidth="2" strokeLinecap="round">
                            <path d="M20,40 Q40,10 60,30 T100,20 T140,40 T180,25 Q190,15 170,45" />
                          </svg>
                          <span className="absolute bottom-1.5 right-3 text-[10px] text-slate-500 font-mono">تم التوقيع إلكترونياً</span>
                        </div>
                      </div>

                      {/* Evidence Photo display */}
                      <div className="py-3">
                        <span className="text-slate-400 text-xs block mb-2 font-medium">صورة إثبات التركيب والتسليم</span>
                        <div className="relative rounded-xl border border-slate-800 overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
                          <img 
                            src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=400" 
                            alt="إثبات التركيب" 
                            className="object-cover w-full h-full opacity-60"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300">
                            <span className="font-bold">صورة الجهاز في الموقع</span>
                            <span className="font-mono text-slate-400">TID: {selectedRow.raw?.terminalId || "N/A"}</span>
                          </div>
                        </div>
                      </div>

                      {/* GPS verification map */}
                      <div className="py-3 border-t border-slate-800/60 flex items-center justify-between">
                        <div>
                          <span className="text-slate-400 text-xs font-medium block">إحداثيات التحقق GPS</span>
                          <span className="font-mono text-xs text-slate-300 font-bold">24.7136° N, 46.6753° E</span>
                        </div>
                        <Button size="sm" variant="outline" className="border-slate-800 text-cyan-400 hover:bg-cyan-400/5 text-xs">
                          <MapPin className="w-3.5 h-3.5 ml-1" />
                          عرض الخريطة
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Hardware Diagnostic Profile (If item category is pos/devices) */}
              {(!itemType || itemType.category === "devices") && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400">التشخيص الفني والملحقات</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {renderAccessoryChip("بطارية سليمة", !!selectedRow.raw?.battery, Smartphone)}
                    {renderAccessoryChip("كابل شاحن", !!selectedRow.raw?.chargerCable, Cable)}
                    {renderAccessoryChip("رأس شاحن", !!selectedRow.raw?.chargerHead, Plug)}
                    {renderAccessoryChip(
                      selectedRow.raw?.hasSim ? `شريحة ${selectedRow.raw?.simCardType || "SIM"}` : "شريحة SIM",
                      !!selectedRow.raw?.hasSim,
                      Smartphone
                    )}
                  </div>
                </div>
              )}

              {/* Damage Report Section */}
              {selectedRow.raw?.damagePart && (
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-bold text-rose-300">تقرير الضرر / الأعطال</h5>
                    <p className="text-xs text-rose-400/90 mt-1">{selectedRow.raw.damagePart}</p>
                  </div>
                </div>
              )}

              {/* Inline Supervisor Decisions Form */}
              {selectedRow.raw?.status === "pending" && (
                <div className="mt-6 pt-5 border-t border-slate-800">
                  <h5 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-cyan-400" />
                    اتخاذ قرار بشأن الاستلام
                  </h5>
                  <textarea
                    value={adminNotesText}
                    onChange={(e) => setAdminNotesText(e.target.value)}
                    placeholder="أدخل أي ملاحظات فنية للمندوب أو أسباب لرفض اعتماد الجهاز..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-400/40 mb-4 h-20 placeholder:text-slate-600"
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={() => updateStatusMutation.mutate({ status: "approved", adminNotes: adminNotesText })}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black"
                    >
                      {updateStatusMutation.isPending ? "جاري الاعتماد..." : "قبول واعتماد الجهاز"}
                    </Button>
                    <Button
                      onClick={() => updateStatusMutation.mutate({ status: "rejected", adminNotes: adminNotesText })}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold"
                    >
                      {updateStatusMutation.isPending ? "جاري الرفض..." : "رفض الطلب"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Layout for Warehouse Transfer */
            <div className="space-y-4">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 divide-y divide-slate-800/60">
                {renderDetailItem("المنتج", selectedRow?.productName || "-")}
                {renderDetailItem("نوع المستند", "تحويل مخزون (Warehouse Transfer)")}
                {renderDetailItem("رقم مستند التحويل", selectedRow?.id || "-", true)}
                {renderDetailItem("الحالة", selectedRow?.status || "-")}
                {renderDetailItem("التاريخ والوقت", selectedRow?.datetime || "-")}
                {renderDetailItem("الجهة المرسلة", "المستودع الرئيسي")}
                {renderDetailItem("المستلم", displayTechnicianName)}
              </div>
              <div className="p-4 rounded-xl border border-cyan-400/10 bg-cyan-400/5 flex gap-3 items-center">
                <Info className="w-5 h-5 text-cyan-400 shrink-0" />
                <p className="text-xs text-slate-400">هذا السجل يمثل شحنة/تحويل للمندوب من المستودع الرئيسي ولا يتبع دورة حياة الأجهزة الذكية الفردية.</p>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={() => setSelectedRow(null)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-6"
            >
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
