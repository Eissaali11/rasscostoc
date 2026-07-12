import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Boxes,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Handshake,
  MapPin,
  Search,
  TrendingDown,
  TrendingUp,
  Truck,
  XCircle,
  CheckCircle,
  XCircle as XCircleIcon,
  Copy,
  Check,
  Smartphone,
  Cable,
  Plug,
  AlertCircle,
  Calendar,
  User,
  Activity,
  FileText,
  ShieldCheck,
  Settings,
  Clock,
  Info,
} from "lucide-react";
import { exportTechnicianToExcel } from "@/lib/exportToExcel";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useActiveItemTypes } from "@/hooks/use-item-types";
import type { TechnicianFixedInventoryEntry, TechnicianMovingInventoryEntry } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TechnicianFixedInventory {
  id: string;
  technicianId: string;
  technicianName?: string;
  city?: string;
  n950Boxes: number;
  n950Units: number;
  i9000sBoxes: number;
  i9000sUnits: number;
  i9100Boxes: number;
  i9100Units: number;
  rollPaperBoxes: number;
  rollPaperUnits: number;
  stickersBoxes: number;
  stickersUnits: number;
  newBatteriesBoxes: number;
  newBatteriesUnits: number;
  mobilySimBoxes: number;
  mobilySimUnits: number;
  stcSimBoxes: number;
  stcSimUnits: number;
  zainSimBoxes: number;
  zainSimUnits: number;
  lebaraBoxes: number;
  lebaraUnits: number;
}

interface TechnicianMovingInventory {
  id: string;
  technicianName?: string;
  city?: string;
  n950Boxes: number;
  n950Units: number;
  i9000sBoxes: number;
  i9000sUnits: number;
  i9100Boxes: number;
  i9100Units: number;
  rollPaperBoxes: number;
  rollPaperUnits: number;
  stickersBoxes: number;
  stickersUnits: number;
  newBatteriesBoxes: number;
  newBatteriesUnits: number;
  mobilySimBoxes: number;
  mobilySimUnits: number;
  stcSimBoxes: number;
  stcSimUnits: number;
  zainSimBoxes: number;
  zainSimUnits: number;
  lebaraBoxes: number;
  lebaraUnits: number;
}

interface LegacyInventoryPayload {
  n950Boxes: number;
  n950Units: number;
  i9000sBoxes: number;
  i9000sUnits: number;
  i9100Boxes: number;
  i9100Units: number;
  rollPaperBoxes: number;
  rollPaperUnits: number;
  stickersBoxes: number;
  stickersUnits: number;
  newBatteriesBoxes: number;
  newBatteriesUnits: number;
  mobilySimBoxes: number;
  mobilySimUnits: number;
  stcSimBoxes: number;
  stcSimUnits: number;
  zainSimBoxes: number;
  zainSimUnits: number;
  lebaraBoxes: number;
  lebaraUnits: number;
}

interface ProductInfo {
  id: string;
  nameAr: string;
  nameEn: string;
  fixedBoxes: number;
  fixedUnits: number;
  fixedTotal: number;
  movingBoxes: number;
  movingUnits: number;
  movingTotal: number;
  grandTotal: number;
  icon: any;
  color: string;
}

type InventoryEntryLike = {
  itemTypeId: string;
  boxes: number;
  units: number;
};

type TechnicianWithBothInventories = {
  technicianId: string;
  technicianName: string;
  city: string;
  fixedInventory: (Partial<TechnicianFixedInventory> & { entries?: InventoryEntryLike[] }) | null;
  movingInventory: (Partial<TechnicianMovingInventory> & { entries?: InventoryEntryLike[] }) | null;
};

type ReceivedDevice = {
  id: string;
  terminalId: string;
  serialNumber: string;
  itemTypeId: string | null;
  status: "pending" | "approved" | "rejected" | "delivered";
  createdAt: string;
  updatedAt?: string;
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

type InventoryTab = "all" | "fixed" | "moving";

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

function toLegacyInventoryPayload(
  inventory?: Partial<LegacyInventoryPayload> | null,
): LegacyInventoryPayload {
  return {
    n950Boxes: inventory?.n950Boxes ?? 0,
    n950Units: inventory?.n950Units ?? 0,
    i9000sBoxes: inventory?.i9000sBoxes ?? 0,
    i9000sUnits: inventory?.i9000sUnits ?? 0,
    i9100Boxes: inventory?.i9100Boxes ?? 0,
    i9100Units: inventory?.i9100Units ?? 0,
    rollPaperBoxes: inventory?.rollPaperBoxes ?? 0,
    rollPaperUnits: inventory?.rollPaperUnits ?? 0,
    stickersBoxes: inventory?.stickersBoxes ?? 0,
    stickersUnits: inventory?.stickersUnits ?? 0,
    newBatteriesBoxes: inventory?.newBatteriesBoxes ?? 0,
    newBatteriesUnits: inventory?.newBatteriesUnits ?? 0,
    mobilySimBoxes: inventory?.mobilySimBoxes ?? 0,
    mobilySimUnits: inventory?.mobilySimUnits ?? 0,
    stcSimBoxes: inventory?.stcSimBoxes ?? 0,
    stcSimUnits: inventory?.stcSimUnits ?? 0,
    zainSimBoxes: inventory?.zainSimBoxes ?? 0,
    zainSimUnits: inventory?.zainSimUnits ?? 0,
    lebaraBoxes: inventory?.lebaraBoxes ?? 0,
    lebaraUnits: inventory?.lebaraUnits ?? 0,
  };
}

function getStockStatus(total: number): { label: string; className: string } {
  if (total <= 0) {
    return {
      label: "منخفض جداً",
      className: "bg-red-500/10 text-red-300 border border-red-400/30",
    };
  }

  if (total < 10) {
    return {
      label: "منخفض",
      className: "bg-yellow-500/10 text-yellow-300 border border-yellow-400/30",
    };
  }

  if (total < 40) {
    return {
      label: "نشط",
      className: "bg-blue-500/10 text-blue-300 border border-blue-400/30",
    };
  }

  return {
    label: "متوفر بكثرة",
    className: "bg-emerald-500/10 text-emerald-300 border border-emerald-400/30",
  };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export default function TechnicianDetailsPage() {
  const [, params] = useRoute("/technician-details/:id");
  const technicianId = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const canSeeTechniciansInventory = user?.role === "admin" || user?.role === "supervisor";

  const [activeTab, setActiveTab] = useState<InventoryTab>("all");
  const [activeSerialTab, setActiveSerialTab] = useState<"active" | "history">("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Scanned Device Modal & Approval states
  const [selectedDevice, setSelectedDevice] = useState<ReceivedDevice | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [adminNotesText, setAdminNotesText] = useState<string>("");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const {
    data: techniciansWithInventory,
    isLoading: isLoadingTechniciansInventory,
  } = useQuery<{ technicians: TechnicianWithBothInventories[] }>({
    queryKey:
      user?.role === "admin"
        ? ["/api/admin/all-technicians-inventory"]
        : ["/api/supervisor/technicians-inventory"],
    enabled: !!technicianId && canSeeTechniciansInventory,
  });

  const { data: fixedInventory, isLoading: isLoadingFixed } = useQuery<TechnicianFixedInventory>({
    queryKey: [`/api/technician-fixed-inventory/${technicianId}`],
    enabled: !!technicianId,
  });

  const { data: movingInventory, isLoading: isLoadingMoving } = useQuery<TechnicianMovingInventory>({
    queryKey: [`/api/supervisor/users/${technicianId}/moving-inventory`],
    enabled: !!technicianId && user?.role === "supervisor",
  });

  const { data: technicianProfile, isLoading: isLoadingProfile } = useQuery<{
    id: string;
    fullName?: string;
    city?: string;
  }>({
    queryKey: [`/api/technicians/${technicianId}`],
    enabled: !!technicianId,
  });

  const { data: itemTypes } = useActiveItemTypes();

  const { data: fixedEntries, isLoading: isLoadingFixedEntries } = useQuery<TechnicianFixedInventoryEntry[]>({
    queryKey: [`/api/technicians/${technicianId}/fixed-inventory-entries`],
    enabled: !!technicianId,
  });

  const { data: movingEntries, isLoading: isLoadingMovingEntries } = useQuery<TechnicianMovingInventoryEntry[]>({
    queryKey: [`/api/technicians/${technicianId}/moving-inventory-entries`],
    enabled: !!technicianId,
  });

  const { data: receivedDevices = [], refetch: refetchReceived } = useQuery<ReceivedDevice[]>({
    queryKey: ["/api/received-devices"],
    enabled: !!technicianId,
  });

  const { data: serializedItems = [], isLoading: isLoadingSerializedItems } = useQuery<any[]>({
    queryKey: [`/api/technicians/${technicianId}/serialized-items`],
    enabled: !!technicianId,
  });

  const { data: deliveredItems = [], isLoading: isLoadingDeliveredItems } = useQuery<any[]>({
    queryKey: [`/api/technicians/${technicianId}/delivered-items`],
    enabled: !!technicianId,
  });

  const legacyDeliveredDevices = useMemo(
    () => receivedDevices.filter((d) => d.technicianId === technicianId && d.status === "delivered"),
    [receivedDevices, technicianId]
  );

  const deliveryLogCount = deliveredItems.length + legacyDeliveredDevices.length;

  const isLoading =
    isLoadingTechniciansInventory ||
    isLoadingFixed ||
    isLoadingMoving ||
    isLoadingProfile ||
    isLoadingFixedEntries ||
    isLoadingMovingEntries ||
    isLoadingSerializedItems ||
    isLoadingDeliveredItems;

  const selectedTechnician = useMemo(() => {
    if (!technicianId) {
      return null;
    }

    return (
      techniciansWithInventory?.technicians?.find((technician) => technician.technicianId === technicianId) || null
    );
  }, [techniciansWithInventory?.technicians, technicianId]);

  const effectiveFixedInventory = selectedTechnician?.fixedInventory || fixedInventory;
  const effectiveMovingInventory = selectedTechnician?.movingInventory || movingInventory;

  const technicianName =
    selectedTechnician?.technicianName ||
    technicianProfile?.fullName ||
    effectiveFixedInventory?.technicianName ||
    effectiveMovingInventory?.technicianName ||
    "غير معروف";

  const city = selectedTechnician?.city || effectiveFixedInventory?.city || effectiveMovingInventory?.city || technicianProfile?.city || "غير حدد";

  const legacyFieldMapping: Record<string, { boxes: string; units: string }> = {
    n950: { boxes: "n950Boxes", units: "n950Units" },
    i9000s: { boxes: "i9000sBoxes", units: "i9000sUnits" },
    i9100: { boxes: "i9100Boxes", units: "i9100Units" },
    rollPaper: { boxes: "rollPaperBoxes", units: "rollPaperUnits" },
    stickers: { boxes: "stickersBoxes", units: "stickersUnits" },
    newBatteries: { boxes: "newBatteriesBoxes", units: "newBatteriesUnits" },
    mobilySim: { boxes: "mobilySimBoxes", units: "mobilySimUnits" },
    stcSim: { boxes: "stcSimBoxes", units: "stcSimUnits" },
    zainSim: { boxes: "zainSimBoxes", units: "zainSimUnits" },
    lebaraSim: { boxes: "lebaraBoxes", units: "lebaraUnits" },
  };

  const categoryIconMap: Record<string, any> = {
    devices: Smartphone,
    papers: FileText,
    accessories: Cable,
    sim: Handshake,
    other: Boxes,
  };

  const categoryColorMap: Record<string, string[]> = {
    devices: ["#3b82f6", "#8b5cf6", "#ec4899", "#6366f1"],
    papers: ["#f59e0b", "#14b8a6"],
    accessories: ["#10b981", "#84cc16"],
    sim: ["#06b6d4", "#6366f1", "#f97316", "#ec4899", "#8b5cf6"],
    other: ["#6b7280"],
  };

  const products: ProductInfo[] = useMemo(() => {
    if (!itemTypes || itemTypes.length === 0) {
      return [];
    }

    const fixedEntryMap = new Map((fixedEntries || []).map((entry) => [entry.itemTypeId, entry]));
    const movingEntryMap = new Map((movingEntries || []).map((entry) => [entry.itemTypeId, entry]));

    return itemTypes
      .filter((itemType) => itemType.isActive && itemType.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((itemType, index) => {
        const fixedEntry = fixedEntryMap.get(itemType.id);
        const movingEntry = movingEntryMap.get(itemType.id);
        const legacy = legacyFieldMapping[itemType.id];
        const preferSnapshot = Boolean(selectedTechnician);

        let fixedBoxes = 0;
        let fixedUnits = 0;
        let movingBoxes = 0;
        let movingUnits = 0;

        const fixedInventoryEntry = Array.isArray(effectiveFixedInventory)
          ? (effectiveFixedInventory as InventoryEntryLike[]).find((entry) => entry.itemTypeId === itemType.id)
          : Array.isArray((effectiveFixedInventory as any)?.entries)
          ? ((effectiveFixedInventory as any).entries as InventoryEntryLike[]).find((entry) => entry.itemTypeId === itemType.id)
          : undefined;

        const movingInventoryEntry = Array.isArray(effectiveMovingInventory)
          ? (effectiveMovingInventory as InventoryEntryLike[]).find((entry) => entry.itemTypeId === itemType.id)
          : Array.isArray((effectiveMovingInventory as any)?.entries)
          ? ((effectiveMovingInventory as any).entries as InventoryEntryLike[]).find((entry) => entry.itemTypeId === itemType.id)
          : undefined;

        if (preferSnapshot) {
          if (fixedInventoryEntry) {
            fixedBoxes = Number(fixedInventoryEntry.boxes || 0);
            fixedUnits = Number(fixedInventoryEntry.units || 0);
          } else if (legacy && effectiveFixedInventory) {
            fixedBoxes = Number((effectiveFixedInventory as any)[legacy.boxes] || 0);
            fixedUnits = Number((effectiveFixedInventory as any)[legacy.units] || 0);
          } else if (fixedEntry) {
            fixedBoxes = Number(fixedEntry.boxes || 0);
            fixedUnits = Number(fixedEntry.units || 0);
          }

          if (movingInventoryEntry) {
            movingBoxes = Number(movingInventoryEntry.boxes || 0);
            movingUnits = Number(movingInventoryEntry.units || 0);
          } else if (legacy && effectiveMovingInventory) {
            movingBoxes = Number((effectiveMovingInventory as any)[legacy.boxes] || 0);
            movingUnits = Number((effectiveMovingInventory as any)[legacy.units] || 0);
          } else if (movingEntry) {
            movingBoxes = Number(movingEntry.boxes || 0);
            movingUnits = Number(movingEntry.units || 0);
          }
        } else {
          if (fixedEntry) {
            fixedBoxes = Number(fixedEntry.boxes || 0);
            fixedUnits = Number(fixedEntry.units || 0);
          } else if (fixedInventoryEntry) {
            fixedBoxes = Number(fixedInventoryEntry.boxes || 0);
            fixedUnits = Number(fixedInventoryEntry.units || 0);
          } else if (legacy && effectiveFixedInventory) {
            fixedBoxes = Number((effectiveFixedInventory as any)[legacy.boxes] || 0);
            fixedUnits = Number((effectiveFixedInventory as any)[legacy.units] || 0);
          }

          if (movingEntry) {
            movingBoxes = Number(movingEntry.boxes || 0);
            movingUnits = Number(movingEntry.units || 0);
          } else if (movingInventoryEntry) {
            movingBoxes = Number(movingInventoryEntry.boxes || 0);
            movingUnits = Number(movingInventoryEntry.units || 0);
          } else if (legacy && effectiveMovingInventory) {
            movingBoxes = Number((effectiveMovingInventory as any)[legacy.boxes] || 0);
            movingUnits = Number((effectiveMovingInventory as any)[legacy.units] || 0);
          }
        }

        if (itemType.requiresSerial || itemType.category === 'sim' || itemType.category === 'devices') {
          movingUnits = (serializedItems || []).filter((item: any) => item.itemTypeId === itemType.id).length;
          movingBoxes = 0;
        }

        const colors = categoryColorMap[itemType.category] || categoryColorMap.other;

        return {
          id: itemType.id,
          nameAr: itemType.nameAr,
          nameEn: itemType.nameEn,
          category: itemType.category,
          fixedBoxes,
          fixedUnits,
          fixedTotal: fixedBoxes + fixedUnits,
          movingBoxes,
          movingUnits,
          movingTotal: movingBoxes + movingUnits,
          grandTotal: fixedBoxes + fixedUnits + movingBoxes + movingUnits,
          icon: categoryIconMap[itemType.category] || categoryIconMap.other,
          color: colors[index % colors.length],
        };
      });
  }, [itemTypes, effectiveFixedInventory, effectiveMovingInventory, fixedEntries, movingEntries, selectedTechnician, serializedItems]);

  const totalFixed = products.reduce((sum, product) => sum + product.fixedTotal, 0);
  const totalMoving = products.reduce((sum, product) => sum + product.movingTotal, 0);
  const grandTotal = totalFixed + totalMoving;

  const totalBoxes = products.reduce((sum, product) => sum + product.fixedBoxes + product.movingBoxes, 0);
  const movingBoxes = products.reduce((sum, product) => sum + product.movingBoxes, 0);

  const hasAnyData = Boolean(
    technicianProfile ||
      selectedTechnician ||
      effectiveFixedInventory ||
      effectiveMovingInventory ||
      (fixedEntries?.length ?? 0) > 0 ||
      (movingEntries?.length ?? 0) > 0,
  );

  const fixedShare = grandTotal > 0 ? (totalFixed / grandTotal) * 100 : 0;
  const movingShare = grandTotal > 0 ? (totalMoving / grandTotal) * 100 : 0;
  const movingBoxesShare = totalBoxes > 0 ? (movingBoxes / totalBoxes) * 100 : 0;

  const rowsByTab = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    const buildRows = (tab: InventoryTab) => {
      return products
        .map((product) => {
          if (tab === "fixed") {
            return {
              ...product,
              boxes: product.fixedBoxes,
              units: product.fixedUnits,
              total: product.fixedTotal,
            };
          }

          if (tab === "moving") {
            return {
              ...product,
              boxes: product.movingBoxes,
              units: product.movingUnits,
              total: product.movingTotal,
            };
          }

          return {
            ...product,
            boxes: product.fixedBoxes + product.movingBoxes,
            units: product.fixedUnits + product.movingUnits,
            total: product.grandTotal,
          };
        })
        .filter((row) => {
          if (!search) return true;

          return (
            row.nameAr.toLowerCase().includes(search) ||
            row.nameEn.toLowerCase().includes(search)
          );
        });
    };

    return {
      all: buildRows("all"),
      fixed: buildRows("fixed"),
      moving: buildRows("moving"),
    };
  }, [products, searchTerm]);

  const activeRows = rowsByTab[activeTab];

  const expandedRow =
    activeRows.find((row) => row.id === expandedProductId) ||
    activeRows[0] ||
    null;

  const lowStockAlertsCount = products.filter((product) => product.grandTotal < 10).length;
  const inventoryAccuracy =
    products.length > 0 ? (products.filter((product) => product.grandTotal > 0).length / products.length) * 100 : 0;

  const movementBars = expandedRow
    ? [45, 62, 88, 73, 58, 95, 70].map((ratio) => Math.max(16, Math.round((expandedRow.total * ratio) / Math.max(expandedRow.total, 1))))
    : [40, 55, 80, 60, 48, 76, 52];

  const canTransferToWarehouse = user?.role === "admin" || user?.role === "supervisor";

  const handleExport = async () => {
    try {
      await exportTechnicianToExcel({
        technicianName,
        city,
        itemTypes: (itemTypes || []).map((itemType) => ({
          id: itemType.id,
          nameAr: itemType.nameAr,
          nameEn: itemType.nameEn,
        })),
        fixedEntries: fixedEntries || [],
        movingEntries: movingEntries || [],
        fixedInventory: toLegacyInventoryPayload(effectiveFixedInventory),
        movingInventory: toLegacyInventoryPayload(effectiveMovingInventory),
      });

      toast({
        title: "تم التصدير بنجاح",
        description: "تم إنشاء ملف Excel لبيانات المندوب",
      });
    } catch (error) {
      toast({
        title: "فشل التصدير",
        description: "حدث خطأ أثناء تصدير البيانات",
        variant: "destructive",
      });
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, adminNotes }: { status: "approved" | "rejected"; adminNotes: string }) => {
      if (!selectedDevice?.id) return;
      const res = await apiRequest("PATCH", `/api/received-devices/${selectedDevice.id}/status`, {
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
      refetchReceived();
      setSelectedDevice(null);
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
        return true;
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
    <div className="flex justify-between items-center py-2.5 border-b border-slate-800/60 last:border-0 text-sm">
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
      <div className={`flex items-center justify-between p-3 rounded-xl border ${colorClass} transition-all`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold">{label}</span>
        </div>
        {isPresent ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircleIcon className="w-4 h-4 shrink-0" />}
      </div>
    );
  };

  const getProductImage = (item: { category?: string; nameAr?: string; nameEn?: string }) => {
    const category = item.category || "";
    const nameAr = item.nameAr || "";
    const nameEn = item.nameEn || "";
    const name = (nameAr + " " + nameEn).toLowerCase();

    if (category === "stickers" || name.includes("ملصق") || name.includes("sticker") || name.includes("mol") || name.includes("label") || name.includes("الملصقات") || name.includes("stickers")) {
      return "/assets/mol.png";
    } else if (category === "sim") {
      if (name.includes("stc") || name.includes("اس تي سي")) {
        return "/assets/stc.jpg";
      } else if (name.includes("zain") || name.includes("زين")) {
        return "/assets/zein.png";
      } else if (name.includes("mobily") || name.includes("موبايلي")) {
        return "/assets/mobile.png";
      } else if (name.includes("lebara") || name.includes("ليبارا")) {
        return "/assets/libar.png";
      }
    } else if (category === "devices") {
      return "/assets/1.png";
    }
    return null;
  };

  const renderProductImage = (category: string, nameAr: string, nameEn: string, extraText?: string | null) => {
    const name = (nameAr + " " + nameEn + " " + (extraText || "")).toLowerCase();

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

  const technicianInitials = useMemo(() => {
    const parts = (technicianName || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "؟";
    if (parts.length === 1) return parts[0].slice(0, 2);
    return `${parts[0][0] || ""}${parts[1][0] || ""}`;
  }, [technicianName]);

  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-[#122222] p-12 text-center" dir="rtl">
        <XCircle className="h-14 w-14 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">لم يتم العثور على البيانات</h2>
        <p className="text-slate-400 mb-6">لا توجد بيانات متاحة لهذا المندوب</p>
        <Link href="/home">
          <Button className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold">
            <ArrowLeft className="ml-2 h-4 w-4" />
            العودة للوحة التحكم
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4" dir="rtl">
      {/* Hero identity */}
      <header className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-[#1a3636] p-6 shadow-lg">
        <div className="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 size-40 rounded-full bg-emerald-400/5 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-lg font-black tracking-wide text-cyan-200 shadow-inner">
              {technicianInitials}
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-400/80">
                StockPro · عهدة المندوب
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {technicianName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/70 bg-slate-950/40 px-2.5 py-1">
                  <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                  {city || "بدون مدينة"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                  <Smartphone className="h-3.5 w-3.5" />
                  عهدة نشطة: {arNumber(serializedItems.length)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-cyan-300">
                  <Truck className="h-3.5 w-3.5" />
                  مسلَّم: {arNumber(deliveryLogCount)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canTransferToWarehouse ? (
              <Link href="/operations">
                <Button className="bg-cyan-400 px-5 font-bold text-slate-950 hover:bg-cyan-300">
                  <Truck className="ml-2 h-4 w-4" />
                  تحويل للمستودع
                </Button>
              </Link>
            ) : null}
            <Button
              onClick={handleExport}
              variant="outline"
              className="border-slate-600/80 bg-slate-950/30 text-cyan-300 hover:bg-cyan-400/10"
              data-testid="button-export"
            >
              <Download className="ml-2 h-4 w-4" />
              تصدير Excel
            </Button>
            <Link href="/home">
              <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800">
                <ArrowLeft className="ml-2 h-4 w-4" />
                رجوع
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "إجمالي المخزون",
            value: grandTotal,
            hint: `تغطية الأصناف ${arNumber(Number(inventoryAccuracy.toFixed(1)))}%`,
            icon: Boxes,
            accent: "cyan",
            width: inventoryAccuracy,
            trendUp: true,
          },
          {
            label: "مخزون التسليم (كراتين)",
            value: totalBoxes,
            hint: `المتحرك ${arNumber(Number(movingBoxesShare.toFixed(1)))}%`,
            icon: Handshake,
            accent: "emerald",
            width: movingBoxesShare,
            trendUp: true,
          },
          {
            label: "مخزون ثابت متبقي",
            value: totalFixed,
            hint: `يمثل ${arNumber(Number(fixedShare.toFixed(1)))}% من الإجمالي`,
            icon: MapPin,
            accent: "sky",
            width: fixedShare,
            trendUp: true,
          },
          {
            label: "مخزون متنقل متبقي",
            value: totalMoving,
            hint: `يمثل ${arNumber(Number(movingShare.toFixed(1)))}% من الإجمالي`,
            icon: Truck,
            accent: "amber",
            width: movingShare,
            trendUp: false,
          },
        ].map((card) => {
          const Icon = card.icon;
          const accentMap: Record<string, { bar: string; iconBg: string; icon: string; border: string }> = {
            cyan: { bar: "bg-cyan-400", iconBg: "bg-cyan-400/10", icon: "text-cyan-300", border: "hover:border-cyan-400/40" },
            emerald: { bar: "bg-emerald-400", iconBg: "bg-emerald-400/10", icon: "text-emerald-300", border: "hover:border-emerald-400/40" },
            sky: { bar: "bg-sky-400", iconBg: "bg-sky-400/10", icon: "text-sky-300", border: "hover:border-sky-400/40" },
            amber: { bar: "bg-amber-400", iconBg: "bg-amber-400/10", icon: "text-amber-300", border: "hover:border-amber-400/40" },
          };
          const a = accentMap[card.accent];
          return (
            <div
              key={card.label}
              className={`relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/45 p-5 backdrop-blur-xl transition-all duration-300 ${a.border} hover:shadow-lg`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${a.bar} opacity-80`} />
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="mb-1 text-sm text-slate-400">{card.label}</p>
                  <h3 className="text-3xl font-black tracking-tight text-slate-50">{arNumber(card.value)}</h3>
                </div>
                <div className={`flex size-11 items-center justify-center rounded-xl ${a.iconBg} ${a.icon}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full ${a.bar}`} style={{ width: `${clampPercent(card.width)}%` }} />
              </div>
              <div className={`mt-3 flex items-center gap-1 text-xs ${a.icon}`}>
                {card.trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {card.hint}
              </div>
            </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/40 shadow-sm backdrop-blur-xl">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as InventoryTab)}
          className="w-full"
        >
          <div className="flex flex-col gap-4 border-b border-slate-700/60 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100">توزيع الأصناف</h2>
              <p className="text-xs text-slate-400">مخزون ثابت ومتحرك حسب نوع الصنف</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <TabsList className="w-full justify-start rounded-xl border border-slate-700/60 bg-slate-950/50 p-1 sm:w-auto">
                <TabsTrigger value="all" className="rounded-lg px-4 data-[state=active]:border data-[state=active]:border-cyan-400/30 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">الكل</TabsTrigger>
                <TabsTrigger value="fixed" className="rounded-lg px-4 data-[state=active]:border data-[state=active]:border-cyan-400/30 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">ثابت</TabsTrigger>
                <TabsTrigger value="moving" className="rounded-lg px-4 data-[state=active]:border data-[state=active]:border-cyan-400/30 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">متحرك</TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:w-64">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="بحث في المنتجات..."
                  className="border-slate-700 bg-slate-950/50 pr-10 text-slate-200"
                />
              </div>
            </div>
          </div>

          {["all", "fixed", "moving"].map((tabValue) => {
            const tab = tabValue as InventoryTab;
            const rows = rowsByTab[tab];

            return (
              <TabsContent value={tab} key={tab} className="m-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-800 bg-slate-950/50 hover:bg-slate-950/50">
                        <TableHead className="text-right text-slate-400">اسم المنتج</TableHead>
                        <TableHead className="text-center text-slate-400">الكراتين</TableHead>
                        <TableHead className="text-center text-slate-400">الوحدات</TableHead>
                        <TableHead className="text-center text-slate-400">الإجمالي</TableHead>
                        <TableHead className="text-center text-slate-400">الحالة</TableHead>
                        <TableHead className="text-center text-slate-400">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow className="border-slate-800">
                          <TableCell colSpan={6} className="py-12 text-center text-slate-500">
                            لا توجد نتائج مطابقة
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row) => {
                          const ItemIcon = row.icon;
                          const status = getStockStatus(row.total);
                          const imageUrl = getProductImage(row);
                          const isHot = row.total > 0;

                          return (
                            <TableRow
                              key={row.id}
                              className={`border-slate-800/70 transition-colors ${isHot ? "hover:bg-cyan-400/[0.04]" : "opacity-80 hover:bg-slate-800/30"}`}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div
                                    className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
                                    style={{ color: row.color }}
                                  >
                                    {imageUrl ? (
                                      <img src={imageUrl} alt={row.nameAr} className="h-full w-full object-contain p-0.5" />
                                    ) : (
                                      <ItemIcon className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-100">{row.nameAr}</p>
                                    <p className="text-[11px] text-slate-500">{row.nameEn}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center tabular-nums text-slate-300">{arNumber(row.boxes)}</TableCell>
                              <TableCell className="text-center tabular-nums text-slate-300">{arNumber(row.units)}</TableCell>
                              <TableCell className="text-center text-base font-bold tabular-nums text-slate-50">{arNumber(row.total)}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={status.className}>{status.label}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  asChild
                                  variant="outline"
                                  size="sm"
                                  className="border-slate-700 text-slate-300 hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-300"
                                >
                                  <Link href={`/technician-details/${technicianId}/item/${row.id}`}>
                                    <span className="ml-1">التفاصيل</span>
                                    <ChevronLeft className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        {expandedRow ? (
          <div className="grid grid-cols-1 gap-5 border-t border-slate-800 bg-slate-950/30 p-5 md:grid-cols-3">
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-cyan-300">تفاصيل التوزيع</h4>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-3">
                <span className="text-sm text-slate-400">المخزون الثابت</span>
                <span className="font-bold text-slate-100">{arNumber(expandedRow.fixedTotal)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-3">
                <span className="text-sm text-slate-400">المخزون المتحرك</span>
                <span className="font-bold text-slate-100">{arNumber(expandedRow.movingTotal)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-cyan-300">حركة الصنف (آخر 7 أيام)</h4>
              <div className="flex h-28 items-end gap-2 px-1 pb-1">
                {movementBars.map((value, index) => (
                  <div
                    key={`${expandedRow.id}-bar-${index}`}
                    className={`w-full rounded-t-md transition-all ${index === 2 || index === 5 ? "bg-cyan-300" : "bg-cyan-400/30"}`}
                    style={{ height: `${clampPercent(value)}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-cyan-300">ملخص سريع</h4>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
                الصنف المحدد يعرض توزيعه الحالي بين المخزون الثابت والمتحرك. استخدم «التفاصيل» لعرض الأرقام التسلسلية والمسلَّمة.
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* v3 serial custody */}
      <section className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/40 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <Tabs value={activeSerialTab} onValueChange={(val) => setActiveSerialTab(val as "active" | "history")} className="w-full">
          <div className="mb-5 flex flex-col gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-bold text-slate-100">
                <span className="flex size-9 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10">
                  <Smartphone className="h-4 w-4 text-cyan-400" />
                </span>
                الأرقام التسلسلية والأجهزة الميدانية
              </h3>
              <p className="mt-1.5 text-xs text-slate-400">
                نظام v3 — العهدة النشطة وسجل تسليم الأجهزة والشرائح المكتملة
              </p>
            </div>

            <TabsList className="h-auto w-full justify-start rounded-xl border border-slate-700/70 bg-slate-950/50 p-1 md:w-auto">
              <TabsTrigger
                value="active"
                className="gap-2 rounded-lg px-4 py-2 data-[state=active]:border data-[state=active]:border-emerald-400/30 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300"
              >
                العهدة النشطة
                <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-300">
                  {arNumber(serializedItems.length)}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="gap-2 rounded-lg px-4 py-2 data-[state=active]:border data-[state=active]:border-cyan-400/30 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300"
              >
                سجل التسليم
                <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-300">
                  {arNumber(deliveryLogCount)}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="active" className="m-0">
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/30">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 bg-slate-900/60 hover:bg-slate-900/60">
                    <TableHead className="text-right text-slate-400">اسم وصورة المنتج</TableHead>
                    <TableHead className="text-center text-slate-400">الرقم التسلسلي S/N</TableHead>
                    <TableHead className="text-center text-slate-400">الباركود / الشريحة</TableHead>
                    <TableHead className="text-center text-slate-400">حالة المنتج</TableHead>
                    <TableHead className="text-center text-slate-400">التصنيف</TableHead>
                    <TableHead className="text-center text-slate-400">تاريخ الاستلام</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serializedItems.length === 0 ? (
                    <TableRow className="border-slate-800/60">
                      <TableCell colSpan={6} className="py-14 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                          <div className="flex size-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-500">
                            <Boxes className="h-5 w-5" />
                          </div>
                          <p className="font-semibold text-slate-300">لا توجد عهدة نشطة حالياً</p>
                          <p className="text-xs text-slate-500">الأجهزة والشرائح المسلَّمة تظهر في تبويب سجل التسليم</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    serializedItems.map((item) => {
                      let statusLabel = "في العهدة الميدانية";
                      let statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

                      let categoryLabel = "أجهزة POS";
                      if (item.itemTypeCategory === "sim") {
                        categoryLabel = "شريحة SIM";
                      } else if (item.itemTypeCategory === "papers") {
                        categoryLabel = "مطبوعات / ورق";
                      } else if (item.itemTypeCategory === "accessories") {
                        categoryLabel = "ملحقات";
                      }

                      return (
                        <TableRow key={item.id} className="group border-slate-800 transition-colors hover:bg-cyan-400/[0.04]">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {renderProductImage(item.itemTypeCategory || "other", item.itemTypeName || "", "", item.carrierName)}
                              <div>
                                <p className="text-sm font-bold text-slate-200 transition-colors group-hover:text-cyan-300">{item.itemTypeName || "صنف غير معروف"}</p>
                                <p className="text-xs text-slate-500">{item.itemTypeCategory || "Serialized Item"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs text-slate-300">
                            <span className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1">{item.serialNumber}</span>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs text-slate-300">
                            {item.itemTypeCategory === "sim" ? item.carrierName || "شريحة" : item.barcode || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${statusColor} px-2.5 py-0.5 text-xs font-bold`}>{statusLabel}</Badge>
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-300">{categoryLabel}</TableCell>
                          <TableCell className="text-center text-xs text-slate-400">{formatDateTime(item.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="history" className="m-0">
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/30">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 bg-slate-900/60 hover:bg-slate-900/60">
                    <TableHead className="text-right text-slate-400">اسم وصورة المنتج</TableHead>
                    <TableHead className="text-center text-slate-400">الرقم التسلسلي S/N</TableHead>
                    <TableHead className="text-center text-slate-400">رقم الجهاز TID</TableHead>
                    <TableHead className="text-center text-slate-400">حالة المنتج</TableHead>
                    <TableHead className="text-center text-slate-400">نوع المستودع</TableHead>
                    <TableHead className="text-center text-slate-400">تاريخ العمليات</TableHead>
                    <TableHead className="text-center text-slate-400">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryLogCount === 0 ? (
                    <TableRow className="border-slate-800/60">
                      <TableCell colSpan={7} className="py-14 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                          <div className="flex size-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-500">
                            <Truck className="h-5 w-5" />
                          </div>
                          <p className="font-semibold text-slate-300">لا توجد تسليمات بعد</p>
                          <p className="text-xs text-slate-500">عند إكمال الطلبات ستظهر الأجهزة والشرائح المسلَّمة هنا</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {deliveredItems.map((item) => {
                        let categoryLabel = "أجهزة POS";
                        if (item.itemTypeCategory === "sim") categoryLabel = "شريحة SIM";
                        else if (item.itemTypeCategory === "papers") categoryLabel = "مطبوعات / ورق";
                        else if (item.itemTypeCategory === "accessories") categoryLabel = "ملحقات";

                        return (
                          <TableRow key={`v3-${item.movementId || item.id}`} className="border-slate-800 hover:bg-cyan-400/5 transition-colors group">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {renderProductImage(item.itemTypeCategory || "other", item.itemTypeName || "", "", item.carrierName)}
                                <div>
                                  <p className="font-bold text-slate-200 text-sm group-hover:text-cyan-300 transition-colors">{item.itemTypeName || "صنف غير معروف"}</p>
                                  <p className="text-xs text-slate-500">
                                    {item.referenceId ? `طلب #${item.referenceId}` : categoryLabel}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs text-slate-300">
                              <span className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">{item.serialNumber}</span>
                            </TableCell>
                            <TableCell className="text-center text-slate-300 font-mono text-xs">
                              {item.itemTypeCategory === "sim" ? item.carrierName || "-" : item.barcode || "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-black text-xs px-2.5 py-0.5">
                                تم التسليم للعميل
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-slate-300 text-xs">مخزون متحرك (v3)</TableCell>
                            <TableCell className="text-center text-slate-400 text-xs">
                              {formatDateTime(item.deliveredAt || item.createdAt)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">مسلَّم</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {legacyDeliveredDevices
                        .filter((d) => !deliveredItems.some((i) => i.serialNumber === d.serialNumber))
                        .map((device) => {
                          const matchedType = itemTypes?.find((t) => t.id === device.itemTypeId);
                          const itemName = matchedType?.nameAr || (device.terminalId ? `جهاز ${device.terminalId}` : "جهاز غير معروف");
                          return (
                            <TableRow
                              key={`legacy-${device.id}`}
                              onClick={() => {
                                setSelectedDevice(device);
                                setActiveStepIndex(3);
                                setAdminNotesText("");
                              }}
                              className="border-slate-800 hover:bg-cyan-400/5 transition-colors cursor-pointer group"
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {renderProductImage(matchedType?.category || "other", matchedType?.nameAr || "", matchedType?.nameEn || "", device.simCardType)}
                                  <div>
                                    <p className="font-bold text-slate-200 text-sm group-hover:text-cyan-300 transition-colors">{itemName}</p>
                                    <p className="text-xs text-slate-500">{matchedType?.nameEn || "Legacy"}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs text-slate-300">
                                <span className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">{device.serialNumber}</span>
                              </TableCell>
                              <TableCell className="text-center text-slate-300 font-mono text-xs">{device.terminalId || "-"}</TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-black text-xs px-2.5 py-0.5">
                                  تم التسليم للعميل
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-slate-300 text-xs">
                                {device.inventoryType === "moving" ? "مخزون متحرك (حقيبة)" : "مخزون ثابت"}
                              </TableCell>
                              <TableCell className="text-center text-slate-400 text-xs">
                                {formatDateTime(device.updatedAt || device.createdAt)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10 text-xs font-bold">
                                  عرض التفاصيل الكاملة
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      <footer className="grid grid-cols-1 gap-4 pb-2 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-slate-900/45 p-5 backdrop-blur-xl">
          <div>
            <h5 className="mb-1 text-sm text-slate-400">دقة المخزون الفعلي</h5>
            <p className="text-2xl font-black text-slate-100">{arNumber(Number(inventoryAccuracy.toFixed(1)))}%</p>
          </div>
          <div className="flex size-14 items-center justify-center rounded-2xl border-2 border-emerald-400/60 text-xs font-bold text-emerald-300">
            {inventoryAccuracy >= 85 ? "عالية" : inventoryAccuracy >= 60 ? "جيدة" : "متوسطة"}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-amber-400/20 bg-slate-900/45 p-5 backdrop-blur-xl">
          <div>
            <h5 className="mb-1 text-sm text-slate-400">تنبيهات انخفاض المخزون</h5>
            <p className="text-2xl font-black text-amber-300">{arNumber(lowStockAlertsCount)} أصناف</p>
          </div>
          <Button variant="outline" className="border-amber-400/30 text-amber-200 hover:bg-amber-500/10">
            مراجعة الآن
          </Button>
        </div>
      </footer>

      {/* Dialog modal for Scanned Device Details */}
      <Dialog open={!!selectedDevice} onOpenChange={(open) => !open && setSelectedDevice(null)}>
        <DialogContent className="sm:max-w-2xl bg-slate-950/95 border border-cyan-400/20 backdrop-blur-2xl text-slate-100 p-6 rounded-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="text-right border-b border-slate-800 pb-4 mb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              تفاصيل ودورة حياة الجهاز / الشريحة
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              تتبع تفاصيل الجهاز، الملحقات المرفقة، وحالته التشغيلية والعهدة
            </DialogDescription>
          </DialogHeader>

          {selectedDevice && (
            <div className="space-y-6">
              {/* Stepper/Timeline */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                <div className="relative flex justify-between items-center">
                  {/* Progress Line */}
                  <div className="absolute top-[22px] left-[10%] right-[10%] h-[2px] bg-slate-800 -z-0">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: selectedDevice.status === "delivered" 
                          ? "100%" 
                          : selectedDevice.status === "approved" 
                          ? "66%" 
                          : selectedDevice.status === "rejected"
                          ? "33%"
                          : "0%"
                      }}
                    />
                  </div>

                  {steps.map((step, idx) => {
                    const StepIcon = step.icon;
                    const isCompleted = isStepCompleted(idx, selectedDevice);
                    const isActive = activeStepIndex === idx;
                    
                    let stateColor = "text-slate-600 border-slate-800 bg-slate-900";
                    if (isActive) {
                      stateColor = "text-cyan-400 border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-400/10";
                    } else if (isCompleted) {
                      stateColor = "text-emerald-400 border-emerald-500 bg-emerald-950/20";
                    } else if (selectedDevice.status === "rejected" && idx === 1) {
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
                      {renderDetailItem("المنتج", itemTypes?.find((t) => t.id === selectedDevice.itemTypeId)?.nameAr || "جهاز غير معروف")}
                      {renderDetailItem("الرقم التسلسلي S/N", selectedDevice.serialNumber, true)}
                      {renderDetailItem("رقم الجهاز (Terminal ID)", selectedDevice.terminalId || "-", true)}
                      {renderDetailItem("تاريخ المسح", formatDateTime(selectedDevice.createdAt))}
                      {renderDetailItem("نوع المستودع", selectedDevice.inventoryType === "moving" ? "مخزون متحرك (حقيبة)" : "مخزون ثابت")}
                    </>
                  )}

                  {activeStepIndex === 1 && (
                    <>
                      {renderDetailItem("الحالة الحالية للطلب", 
                        selectedDevice.status === "approved" ? "مقبول" : 
                        selectedDevice.status === "rejected" ? "مرفوض" : "قيد المراجعة"
                      )}
                      {renderDetailItem("المشرف المسؤول", selectedDevice.approvedBy || "بانتظار المراجعة...")}
                      {renderDetailItem("تاريخ القرار", formatDateTime(selectedDevice.approvedAt))}
                      {renderDetailItem("ملاحظات المراجعة", selectedDevice.adminNotes || "لا توجد")}
                    </>
                  )}

                  {activeStepIndex === 2 && (
                    <>
                      {renderDetailItem("حائز العهدة الحالي", technicianName)}
                      {renderDetailItem("حالة العهدة الفنية", 
                        (selectedDevice.status === "approved" || selectedDevice.status === "delivered")
                          ? "نشطة (في عهدة المندوب)" 
                          : "غير نشطة (بانتظار الاعتماد)"
                      )}
                      {renderDetailItem("نوع العهدة الجغرافية", selectedDevice.inventoryType === "moving" ? "حقيبة المندوب الميدانية" : "المستودع الرئيسي")}
                      {renderDetailItem("الموقع الجغرافي المسجل", "الرياض، المملكة العربية السعودية")}
                    </>
                  )}

                  {activeStepIndex === 3 && (
                    <>
                      {renderDetailItem("حالة التسليم النهائية", "تم التسليم للعميل بنجاح")}
                      {renderDetailItem("اسم العميل / المنشأة", "متجر الاتصالات الحديثة (سجل تجاري: 1010384729)")}
                      {renderDetailItem("تاريخ ووقت التسليم", formatDateTime(selectedDevice.updatedAt || selectedDevice.createdAt))}
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
                            <span className="font-mono text-slate-400">TID: {selectedDevice.terminalId || "N/A"}</span>
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

              {/* Hardware Diagnostic Profile */}
              {(!selectedDevice.itemTypeId || itemTypes?.find((t) => t.id === selectedDevice.itemTypeId)?.category === "devices") && activeStepIndex < 3 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400">التشخيص الفني والملحقات</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {renderAccessoryChip("بطارية سليمة", !!selectedDevice.battery, Smartphone)}
                    {renderAccessoryChip("كابل شاحن", !!selectedDevice.chargerCable, Cable)}
                    {renderAccessoryChip("رأس شاحن", !!selectedDevice.chargerHead, Plug)}
                    {renderAccessoryChip(
                      selectedDevice.hasSim ? `شريحة ${selectedDevice.simCardType || "SIM"}` : "شريحة SIM",
                      !!selectedDevice.hasSim,
                      Smartphone
                    )}
                  </div>
                </div>
              )}

              {/* Damage Report Section */}
              {selectedDevice.damagePart && activeStepIndex < 3 && (
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-bold text-rose-300">تقرير الضرر / الأعطال</h5>
                    <p className="text-xs text-rose-400/90 mt-1">{selectedDevice.damagePart}</p>
                  </div>
                </div>
              )}

              {/* Inline Supervisor Decisions Form */}
              {selectedDevice.status === "pending" && (
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
          )}

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={() => setSelectedDevice(null)}
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
