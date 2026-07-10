import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileDown,
  Hourglass,
  Loader2,
  Package,
  Search,
  Truck,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useActiveItemTypes } from "@/hooks/use-item-types";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SystemLog, UserSafe } from "@shared/schema";

interface WarehouseTransfer {
  id: string;
  warehouseId: string;
  technicianId: string;
  itemType: string;
  packagingType: string;
  quantity: number;
  performedBy: string;
  notes?: string;
  status: "pending" | "accepted" | "rejected";
  rejectionReason?: string;
  respondedAt?: Date | string;
  createdAt: Date | string;
  warehouseName?: string;
  technicianName?: string;
  performedByName?: string;
  itemNameAr?: string;
}

interface StockMovement {
  id: string;
  technicianId: string;
  itemType: string;
  packagingType: "box" | "unit";
  quantity: number;
  fromInventory: "fixed" | "moving";
  toInventory: "fixed" | "moving";
  reason?: string;
  notes?: string;
  performedBy: string;
  createdAt: Date | string;
  technicianName?: string;
  performedByName?: string;
  itemNameAr?: string;
}

type TechnicianWithBothInventories = {
  technicianId: string;
  technicianName: string;
  fixedInventory: unknown;
  movingInventory: unknown;
};

type WarehouseWithStats = {
  id: string;
  name: string;
  totalItems?: number;
  inventory?: Record<string, unknown> | null;
};

type TechnicianInventory = Record<string, unknown> & {
  entries?: Array<{ boxes?: number; units?: number }>;
};

type SystemOperationFilter =
  | "all"
  | "stock-request"
  | "stock-transfer"
  | "stock-depletion-technician"
  | "stock-depletion-warehouse";

type GroupedOperation = {
  groupId: string;
  sourceType: "technician-transfer" | "warehouse-movement" | "system-event";
  warehouseId: string;
  warehouseName?: string;
  technicianName?: string;
  technicianId: string;
  createdAt: Date | string;
  respondedAt?: Date | string;
  notes?: string;
  status: "pending" | "accepted" | "rejected";
  rejectionReason?: string;
  performedBy: string;
  items: Array<{
    id: string;
    itemType: string;
    itemNameAr: string;
    packagingType: string;
    quantity: number;
  }>;
  systemMeta?: {
    action?: string;
    entityType?: string;
    entityName?: string;
    description?: string;
    userRole?: string;
    success?: boolean;
    severity?: string;
    category?: SystemOperationFilter;
  };
};

const systemActionLabels: Record<string, string> = {
  create: "إنشاء",
  update: "تحديث",
  delete: "حذف",
  approve: "موافقة",
  reject: "رفض",
  login: "تسجيل دخول",
  logout: "تسجيل خروج",
  transfer: "نقل مخزون",
  depletion: "نفاذ مخزون",
};

const systemEntityLabels: Record<string, string> = {
  user: "مستخدم",
  users: "المستخدمين",
  region: "منطقة",
  regions: "المناطق",
  warehouse: "مستودع",
  warehouses: "المستودعات",
  transfer: "عملية نقل",
  stock: "المخزون",
  item: "صنف",
  inventory_request: "طلب مخزون",
  stock_transfer: "نقل مخزون",
  technician_inventory: "مخزون مندوب",
  warehouse_inventory: "مخزون مستودع",
};

const systemFilterLabels: Record<SystemOperationFilter, string> = {
  all: "الكل",
  "stock-request": "طلب مخزون",
  "stock-transfer": "نقل مخزون",
  "stock-depletion-technician": "نفاذ مخزون مندوب",
  "stock-depletion-warehouse": "نفاذ مخزون مستودع",
};

function sumInventoryValue(inventory: unknown): number {
  if (!inventory || typeof inventory !== "object") return 0;

  const typed = inventory as TechnicianInventory;
  if (Array.isArray(typed.entries) && typed.entries.length > 0) {
    return typed.entries.reduce(
      (sum, entry) => sum + Number(entry.boxes || 0) + Number(entry.units || 0),
      0,
    );
  }

  return Object.entries(typed)
    .filter(([key, value]) =>
      (key.endsWith("Boxes") || key.endsWith("Units")) && typeof value === "number",
    )
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);
}

function sumWarehouseInventory(inventory: Record<string, unknown> | null | undefined): number {
  if (!inventory || typeof inventory !== "object") return 0;

  return Object.entries(inventory)
    .filter(([key, value]) =>
      (key.endsWith("Boxes") || key.endsWith("Units")) && typeof value === "number",
    )
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);
}

function getSystemOperationCategory(group: GroupedOperation): SystemOperationFilter {
  const category = group.systemMeta?.category;
  if (category && category !== "all") return category;

  const entityType = (group.systemMeta?.entityType || "").toLowerCase();
  const action = (group.systemMeta?.action || "").toLowerCase();
  const description = (group.systemMeta?.description || group.notes || "").toLowerCase();

  if (entityType === "inventory_request" || description.includes("طلب مخزون")) {
    return "stock-request";
  }

  if (
    action === "transfer" ||
    entityType === "stock_transfer" ||
    description.includes("نقل مخزون") ||
    description.includes("تم سحب")
  ) {
    return "stock-transfer";
  }

  if (description.includes("نفاذ") && description.includes("مندوب")) {
    return "stock-depletion-technician";
  }

  if (description.includes("نفاذ") && description.includes("مستودع")) {
    return "stock-depletion-warehouse";
  }

  return "all";
}

function getStatusBadge(status: GroupedOperation["status"]) {
  if (status === "pending") {
    return <span className="px-3 py-1 rounded-full bg-[#00F2FF]/10 text-[#00F2FF] text-[10px] font-bold border border-[#00F2FF]/20">قيد التنفيذ</span>;
  }

  if (status === "accepted") {
    return <span className="px-3 py-1 rounded-full bg-[#BC13FE]/10 text-[#BC13FE] text-[10px] font-bold border border-[#BC13FE]/20">مكتمل</span>;
  }

  return <span className="px-3 py-1 rounded-full bg-[#FF8C00]/10 text-[#FF8C00] text-[10px] font-bold border border-[#FF8C00]/20">قيد الانتظار</span>;
}

function getProgressForGroup(group: GroupedOperation): number {
  if (group.status === "accepted") return 100;
  if (group.status === "rejected") return 15;

  const totalQty = group.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  return Math.min(90, Math.max(35, totalQty * 4));
}

function getProgressClass(group: GroupedOperation): string {
  if (group.status === "accepted") return "bg-[#BC13FE] shadow-[0_0_10px_#BC13FE66]";
  if (group.status === "rejected") return "bg-white/20";
  return "bg-gradient-to-r from-[#00F2FF] to-[#0077ff] shadow-[0_0_10px_rgba(0,242,255,0.5)]";
}

export default function OperationsPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [searchText, setSearchText] = useState("");
  const [operationView, setOperationView] = useState<"technicians" | "warehouses" | "system">("technicians");
  const [systemOperationFilter, setSystemOperationFilter] = useState<SystemOperationFilter>("all");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRejectGroup, setSelectedRejectGroup] = useState<GroupedOperation | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedDetailsGroup, setSelectedDetailsGroup] = useState<GroupedOperation | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingGroupId, setProcessingGroupId] = useState<string | null>(null);

  const { data: itemTypesData } = useActiveItemTypes();

  const { data: allTransfers, isLoading: isTransfersLoading } = useQuery<WarehouseTransfer[]>({
    queryKey: ["/api/warehouse-transfers"],
  });

  const { data: stockMovements, isLoading: isStockMovementsLoading } = useQuery<StockMovement[]>({
    queryKey: ["/api/stock-movements"],
  });

  const { data: systemLogs = [], isLoading: isSystemLogsLoading } = useQuery<SystemLog[]>({
    queryKey: ["/api/system-logs"],
    enabled: currentUser?.role === "admin",
  });

  const usersQueryKey = currentUser?.role === "admin" ? "/api/users" : "/api/supervisor/technicians";
  const { data: systemUsers = [], isLoading: isUsersLoading } = useQuery<UserSafe[]>({
    queryKey: [usersQueryKey],
    enabled: !!currentUser,
  });

  const canSeeGlobalData = currentUser?.role === "admin" || currentUser?.role === "supervisor";

  const { data: techniciansData } = useQuery<{ technicians: TechnicianWithBothInventories[] }>({
    queryKey: currentUser?.role === "admin" ? ["/api/admin/all-technicians-inventory"] : ["/api/supervisor/technicians-inventory"],
    enabled: !!currentUser?.id && canSeeGlobalData && operationView === "system",
  });

  const { data: warehousesData = [] } = useQuery<WarehouseWithStats[]>({
    queryKey: currentUser?.role === "admin" ? ["/api/warehouses"] : ["/api/supervisor/warehouses"],
    enabled: !!currentUser?.id && canSeeGlobalData && operationView === "system",
  });

  const getItemNameAr = (itemType: string) => {
    if (itemTypesData) {
      const dynamicItem = itemTypesData.find(
        (item) => item.nameEn.toLowerCase() === itemType.toLowerCase() || item.id === itemType,
      );
      if (dynamicItem) return dynamicItem.nameAr;
    }

    const itemNames: Record<string, string> = {
      n950: "N950",
      i9000s: "I9000s",
      i9100: "I9100",
      rollPaper: "ورق",
      stickers: "ملصقات",
      newBatteries: "بطاريات جديدة",
      mobilySim: "شرائح موبايلي",
      stcSim: "شرائح STC",
      zainSim: "شرائح زين",
      lebara: "شرائح ليبارا",
      lebaraSim: "شرائح ليبارا",
    };

    return itemNames[itemType] || itemType;
  };

  const transfers = useMemo(() => {
    if (!allTransfers) return [];

    const normalized = searchText.trim().toLowerCase();
    if (!normalized) return allTransfers;

    return allTransfers.filter((transfer) => {
      const technician = transfer.technicianName?.toLowerCase() || "";
      const warehouse = transfer.warehouseName?.toLowerCase() || "";
      return technician.includes(normalized) || warehouse.includes(normalized);
    });
  }, [allTransfers, searchText]);

  const filteredStockMovements = useMemo(() => {
    if (!stockMovements) return [];

    const normalized = searchText.trim().toLowerCase();
    if (!normalized) return stockMovements;

    return stockMovements.filter((movement) => {
      const technician = movement.technicianName?.toLowerCase() || "";
      const fromInventory = movement.fromInventory.toLowerCase();
      const toInventory = movement.toInventory.toLowerCase();
      const item = getItemNameAr(movement.itemType).toLowerCase();
      return (
        technician.includes(normalized) ||
        fromInventory.includes(normalized) ||
        toInventory.includes(normalized) ||
        item.includes(normalized)
      );
    });
  }, [stockMovements, searchText]);

  const pendingTransfers = transfers.filter((transfer) => transfer.status === "pending");
  const processedTransfers = transfers.filter((transfer) => transfer.status !== "pending");

  const groupedPendingTransfersList = useMemo(() => {
    const grouped = pendingTransfers.reduce((acc, transfer) => {
      const date = new Date(transfer.createdAt);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const key = `${transfer.warehouseId}-${dayKey}-${transfer.performedBy}-${transfer.notes || "no-notes"}`;

      if (!acc[key]) {
        acc[key] = {
          groupId: key,
          sourceType: "technician-transfer",
          warehouseId: transfer.warehouseId,
          warehouseName: transfer.warehouseName,
          technicianName: transfer.technicianName,
          technicianId: transfer.technicianId,
          createdAt: transfer.createdAt,
          notes: transfer.notes,
          status: transfer.status,
          performedBy: transfer.performedBy,
          items: [],
        } as GroupedOperation;
      }

      acc[key].items.push({
        id: transfer.id,
        itemType: transfer.itemType,
        itemNameAr: getItemNameAr(transfer.itemType),
        packagingType: transfer.packagingType,
        quantity: transfer.quantity,
      });

      return acc;
    }, {} as Record<string, GroupedOperation>);

    return Object.values(grouped).sort(
      (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );
  }, [pendingTransfers]);

  const groupedProcessedTransfersList = useMemo(() => {
    const grouped = processedTransfers.reduce((acc, transfer) => {
      const date = new Date(transfer.createdAt);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const key = `${transfer.warehouseId}-${dayKey}-${transfer.performedBy}-${transfer.status}-${transfer.notes || "no-notes"}`;

      if (!acc[key]) {
        acc[key] = {
          groupId: key,
          sourceType: "technician-transfer",
          warehouseId: transfer.warehouseId,
          warehouseName: transfer.warehouseName,
          technicianName: transfer.technicianName,
          technicianId: transfer.technicianId,
          createdAt: transfer.createdAt,
          respondedAt: transfer.respondedAt,
          notes: transfer.notes,
          status: transfer.status,
          rejectionReason: transfer.rejectionReason,
          performedBy: transfer.performedBy,
          items: [],
        } as GroupedOperation;
      }

      acc[key].items.push({
        id: transfer.id,
        itemType: transfer.itemType,
        itemNameAr: getItemNameAr(transfer.itemType),
        packagingType: transfer.packagingType,
        quantity: transfer.quantity,
      });

      return acc;
    }, {} as Record<string, GroupedOperation>);

    return Object.values(grouped).sort(
      (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );
  }, [processedTransfers]);

  const groupedStockMovementsList = useMemo(() => {
    const grouped = filteredStockMovements.reduce((acc, movement) => {
      const date = new Date(movement.createdAt);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const key = `${movement.technicianId}-${dayKey}-${movement.performedBy}-${movement.fromInventory}-${movement.toInventory}-${movement.notes || "no-notes"}`;

      if (!acc[key]) {
        const fromLabel = movement.fromInventory === "fixed" ? "المخزون الثابت" : "المخزون المتحرك";
        const toLabel = movement.toInventory === "fixed" ? "المخزون الثابت" : "المخزون المتحرك";

        acc[key] = {
          groupId: key,
          sourceType: "warehouse-movement",
          warehouseId: `movement-${movement.technicianId}`,
          warehouseName: `${fromLabel} → ${toLabel}`,
          technicianName: movement.technicianName,
          technicianId: movement.technicianId,
          createdAt: movement.createdAt,
          notes: movement.notes || movement.reason,
          status: "accepted",
          performedBy: movement.performedBy,
          items: [],
        } as GroupedOperation;
      }

      acc[key].items.push({
        id: movement.id,
        itemType: movement.itemType,
        itemNameAr: getItemNameAr(movement.itemType),
        packagingType: movement.packagingType,
        quantity: movement.quantity,
      });

      return acc;
    }, {} as Record<string, GroupedOperation>);

    return Object.values(grouped).sort(
      (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );
  }, [filteredStockMovements]);

  const groupedSystemLogsList = useMemo(() => {
    return systemLogs.map((log) => {
      const actionLabel = systemActionLabels[log.action] || log.action;
      const entityLabel = systemEntityLabels[log.entityType] || log.entityType;
      const status: GroupedOperation["status"] = log.success ? "accepted" : "rejected";

      return {
        groupId: `system-${log.id}`,
        sourceType: "system-event",
        warehouseId: `system-${log.id}`,
        warehouseName: `${actionLabel} • ${entityLabel}`,
        technicianName: log.userName,
        technicianId: log.userId || "system",
        createdAt: log.createdAt || new Date(),
        notes: log.description,
        status,
        performedBy: log.userName,
        items: [
          {
            id: log.id,
            itemType: log.action,
            itemNameAr: log.entityName || entityLabel,
            packagingType: "event",
            quantity: 1,
          },
        ],
        systemMeta: {
          action: log.action,
          entityType: log.entityType,
          entityName: log.entityName || undefined,
          description: log.description,
          userRole: log.userRole,
          success: log.success,
          severity: log.severity,
          category: getSystemOperationCategory({
            groupId: `tmp-${log.id}`,
            sourceType: "system-event",
            warehouseId: "tmp",
            technicianId: "tmp",
            createdAt: log.createdAt || new Date(),
            status,
            performedBy: log.userName,
            items: [],
            notes: log.description,
            systemMeta: {
              action: log.action,
              entityType: log.entityType,
              description: log.description,
            },
          } as GroupedOperation),
        },
      } as GroupedOperation;
    }).sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  }, [systemLogs]);

  const depletedTechnicianOperations = useMemo(() => {
    const technicians = techniciansData?.technicians || [];
    return technicians
      .filter((technician) => {
        const total = sumInventoryValue(technician.fixedInventory) + sumInventoryValue(technician.movingInventory);
        return total <= 0;
      })
      .map((technician) => ({
        groupId: `depletion-tech-${technician.technicianId}`,
        sourceType: "system-event",
        warehouseId: `depletion-tech-${technician.technicianId}`,
        warehouseName: "نفاذ مخزون مندوب",
        technicianName: technician.technicianName,
        technicianId: technician.technicianId,
        createdAt: new Date(),
        notes: `نفاذ كمية المخزون للمندوب ${technician.technicianName}`,
        status: "rejected",
        performedBy: "system",
        items: [
          {
            id: `depletion-tech-item-${technician.technicianId}`,
            itemType: "depletion",
            itemNameAr: "نفاذ مخزون",
            packagingType: "event",
            quantity: 0,
          },
        ],
        systemMeta: {
          action: "depletion",
          entityType: "technician_inventory",
          entityName: technician.technicianName,
          description: `نفاذ كمية المخزون من مندوب: ${technician.technicianName}`,
          success: false,
          severity: "warn",
          category: "stock-depletion-technician",
        },
      } as GroupedOperation));
  }, [techniciansData?.technicians]);

  const depletedWarehouseOperations = useMemo(() => {
    return warehousesData
      .filter((warehouse) => {
        const total = Number(warehouse.totalItems ?? sumWarehouseInventory(warehouse.inventory));
        return total <= 0;
      })
      .map((warehouse) => ({
        groupId: `depletion-wh-${warehouse.id}`,
        sourceType: "system-event",
        warehouseId: warehouse.id,
        warehouseName: "نفاذ مخزون مستودع",
        technicianName: warehouse.name,
        technicianId: warehouse.id,
        createdAt: new Date(),
        notes: `نفاذ كمية المخزون من المستودع ${warehouse.name}`,
        status: "rejected",
        performedBy: "system",
        items: [
          {
            id: `depletion-wh-item-${warehouse.id}`,
            itemType: "depletion",
            itemNameAr: "نفاذ مخزون",
            packagingType: "event",
            quantity: 0,
          },
        ],
        systemMeta: {
          action: "depletion",
          entityType: "warehouse_inventory",
          entityName: warehouse.name,
          description: `نفاذ كمية المخزون من مستودع: ${warehouse.name}`,
          success: false,
          severity: "warn",
          category: "stock-depletion-warehouse",
        },
      } as GroupedOperation));
  }, [warehousesData]);

  const allSystemOperations = useMemo(() => {
    return [...groupedSystemLogsList, ...depletedTechnicianOperations, ...depletedWarehouseOperations].sort(
      (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );
  }, [groupedSystemLogsList, depletedTechnicianOperations, depletedWarehouseOperations]);

  const filteredSystemOperations = useMemo(() => {
    let rows = allSystemOperations;

    if (systemOperationFilter !== "all") {
      rows = rows.filter((group) => getSystemOperationCategory(group) === systemOperationFilter);
    }

    const normalized = searchText.trim().toLowerCase();
    if (!normalized) return rows;

    return rows.filter((group) => {
      const title = (group.warehouseName || "").toLowerCase();
      const actor = (group.technicianName || group.performedBy || "").toLowerCase();
      const description = (group.systemMeta?.description || group.notes || "").toLowerCase();
      const entity = (group.systemMeta?.entityName || "").toLowerCase();
      const categoryLabel = systemFilterLabels[getSystemOperationCategory(group)].toLowerCase();
      return (
        title.includes(normalized) ||
        actor.includes(normalized) ||
        description.includes(normalized) ||
        entity.includes(normalized) ||
        categoryLabel.includes(normalized)
      );
    });
  }, [allSystemOperations, systemOperationFilter, searchText]);

  const systemCategoryCounts = useMemo(() => {
    const countBy = (filter: SystemOperationFilter) =>
      filter === "all"
        ? allSystemOperations.length
        : allSystemOperations.filter((group) => getSystemOperationCategory(group) === filter).length;

    return {
      all: countBy("all"),
      "stock-request": countBy("stock-request"),
      "stock-transfer": countBy("stock-transfer"),
      "stock-depletion-technician": countBy("stock-depletion-technician"),
      "stock-depletion-warehouse": countBy("stock-depletion-warehouse"),
    } as Record<SystemOperationFilter, number>;
  }, [allSystemOperations]);

  const onlineUsers = useMemo(() => {
    return systemUsers
      .filter((systemUser) => systemUser.isActive)
      .sort((first, second) => (first.fullName || "").localeCompare(second.fullName || "ar"));
  }, [systemUsers]);

  const operationGroups = useMemo(() => {
    if (operationView === "technicians") {
      return [...groupedPendingTransfersList, ...groupedProcessedTransfersList].sort(
        (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
      );
    }

    if (operationView === "system") {
      return filteredSystemOperations;
    }

    return groupedStockMovementsList;
  }, [operationView, groupedPendingTransfersList, groupedProcessedTransfersList, groupedStockMovementsList, filteredSystemOperations]);

  const recentOperations = useMemo(() => {
    return operationGroups.slice(0, 8);
  }, [operationGroups]);

  const mainOperation = useMemo(() => {
    if (operationView === "technicians") {
      return groupedPendingTransfersList[0] || recentOperations[0] || null;
    }

    if (operationView === "system") {
      return recentOperations[0] || null;
    }

    return recentOperations[0] || null;
  }, [operationView, groupedPendingTransfersList, recentOperations]);

  const totalOperationsCount = operationGroups.length;
  const pendingOperationsCount = operationView === "technicians"
    ? groupedPendingTransfersList.length
    : 0;
  const waitingOperationsCount = operationView === "technicians"
    ? groupedProcessedTransfersList.filter((group) => group.status === "rejected").length
    : operationView === "system"
      ? filteredSystemOperations.filter((group) => group.systemMeta?.severity === "warn").length
      : 0;
  const completedOperationsCount = operationView === "system"
    ? filteredSystemOperations.filter((group) => group.status === "accepted").length
    : operationGroups.filter((group) => group.status === "accepted").length;
  const systemErrorsCount = filteredSystemOperations.filter((group) => !group.systemMeta?.success || group.systemMeta?.severity === "error").length;

  const getSourceTypeLabel = (group: GroupedOperation) => {
    if (group.sourceType === "system-event") return "عملية نظام";
    if (group.sourceType === "warehouse-movement") return "نقل مخزون";
    return "نقل مندوب";
  };

  const formatOperationDate = (value?: Date | string) => {
    if (!value) return "-";
    return format(new Date(value), "PPp", { locale: ar });
  };

  const openOperationDetails = (group: GroupedOperation) => {
    setSelectedDetailsGroup(group);
    setDetailsDialogOpen(true);
  };

  const exportToExcel = async () => {
    if (operationView === "technicians" && (!transfers || transfers.length === 0)) {
      toast({
        title: "لا توجد بيانات",
        description: "لا توجد عمليات لتصديرها",
        variant: "destructive",
      });
      return;
    }

    if (operationView === "warehouses" && (!filteredStockMovements || filteredStockMovements.length === 0)) {
      toast({
        title: "لا توجد بيانات",
        description: "لا توجد نتائج لحركات المخزون لتصديرها",
        variant: "destructive",
      });
      return;
    }

    if (operationView === "system" && (!filteredSystemOperations || filteredSystemOperations.length === 0)) {
      toast({
        title: "لا توجد بيانات",
        description: "لا توجد عمليات نظام مطابقة للتصدير",
        variant: "destructive",
      });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(
      operationView === "technicians"
        ? "عمليات نقل المندوبين"
        : operationView === "warehouses"
          ? "حركات المخزون"
          : "عمليات النظام",
    );
    worksheet.views = [{ rightToLeft: true }];

    const currentDate = new Date();
    const arabicDate = currentDate.toLocaleDateString("ar-SA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const time = currentDate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

    worksheet.mergeCells("A1:H1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = operationView === "technicians"
      ? "تقرير عمليات نقل المندوبين"
      : operationView === "warehouses"
        ? "تقرير حركات المخزون الداخلية"
        : "تقرير عمليات النظام";
    titleCell.font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF18B2B0" },
    };

    worksheet.mergeCells("A2:H2");
    const dateCell = worksheet.getCell("A2");
    dateCell.value = `${arabicDate} - ${time}`;
    dateCell.font = { size: 12, bold: true };
    dateCell.alignment = { horizontal: "center", vertical: "middle" };
    dateCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0F7F7" },
    };

    worksheet.addRow([]);

    const headerRow = operationView === "technicians"
      ? worksheet.addRow(["#", "المستودع", "المندوب", "الصنف", "نوع التغليف", "الكمية", "الحالة", "التاريخ"])
      : operationView === "warehouses"
        ? worksheet.addRow(["#", "المندوب", "الصنف", "من", "إلى", "نوع التغليف", "الكمية", "التاريخ"])
        : worksheet.addRow(["#", "المنفذ", "الدور", "العملية", "الكيان", "الوصف", "النتيجة", "التاريخ"]);
    headerRow.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF18B2B0" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    });

    if (operationView === "technicians") {
      transfers.forEach((transfer, index) => {
        const statusText =
          transfer.status === "accepted" ? "مقبول" :
          transfer.status === "rejected" ? "مرفوض" :
          "قيد الانتظار";

        const row = worksheet.addRow([
          index + 1,
          transfer.warehouseName || "غير محدد",
          transfer.technicianName || "غير محدد",
          getItemNameAr(transfer.itemType),
          transfer.packagingType === "box" ? "كرتون" : "مفرد",
          transfer.quantity,
          statusText,
          format(new Date(transfer.createdAt), "PPp", { locale: ar }),
        ]);

        row.alignment = { horizontal: "center", vertical: "middle" };
        row.height = 25;

        const bgColor =
          transfer.status === "accepted" ? "FFD1FAE5" :
          transfer.status === "rejected" ? "FFFECACA" :
          "FFFEF3C7";

        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bgColor },
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFD1D5DB" } },
            left: { style: "thin", color: { argb: "FFD1D5DB" } },
            bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
            right: { style: "thin", color: { argb: "FFD1D5DB" } },
          };
        });
      });
    } else if (operationView === "warehouses") {
      filteredStockMovements.forEach((movement, index) => {
        const row = worksheet.addRow([
          index + 1,
          movement.technicianName || "غير محدد",
          getItemNameAr(movement.itemType),
          movement.fromInventory === "fixed" ? "المخزون الثابت" : "المخزون المتحرك",
          movement.toInventory === "fixed" ? "المخزون الثابت" : "المخزون المتحرك",
          movement.packagingType === "box" ? "كرتون" : "مفرد",
          movement.quantity,
          format(new Date(movement.createdAt), "PPp", { locale: ar }),
        ]);

        row.alignment = { horizontal: "center", vertical: "middle" };
        row.height = 25;

        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE0F2FE" },
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFD1D5DB" } },
            left: { style: "thin", color: { argb: "FFD1D5DB" } },
            bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
            right: { style: "thin", color: { argb: "FFD1D5DB" } },
          };
        });
      });
    } else {
      filteredSystemOperations.forEach((group, index) => {
        const actionLabel = systemActionLabels[group.systemMeta?.action || ""] || group.systemMeta?.action || "عملية";
        const entityLabel = group.systemMeta?.entityName || group.items[0]?.itemNameAr || "-";
        const statusText = group.systemMeta?.success === false || group.status === "rejected" ? "فاشل" : "ناجح";

        const row = worksheet.addRow([
          index + 1,
          group.technicianName || group.performedBy || "غير محدد",
          group.systemMeta?.userRole || "-",
          actionLabel,
          entityLabel,
          group.systemMeta?.description || group.notes || "-",
          statusText,
          format(new Date(group.createdAt || new Date()), "PPp", { locale: ar }),
        ]);

        row.alignment = { horizontal: "center", vertical: "middle" };
        row.height = 25;

        const bgColor = statusText === "ناجح" ? "FFE0F2FE" : "FFFECACA";
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bgColor },
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFD1D5DB" } },
            left: { style: "thin", color: { argb: "FFD1D5DB" } },
            bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
            right: { style: "thin", color: { argb: "FFD1D5DB" } },
          };
        });
      });
    }

    worksheet.columns = [
      { width: 8 },
      { width: 20 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 12 },
      { width: 12 },
      { width: 25 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(
      blob,
      `${operationView === "technicians" ? "عمليات_المندوبين" : operationView === "warehouses" ? "حركات_المخزون" : "عمليات_النظام"}_${new Date().toISOString().split("T")[0]}.xlsx`,
    );

    toast({
      title: "تم التصدير",
      description: `تم تصدير ${operationView === "technicians" ? transfers.length : operationView === "warehouses" ? filteredStockMovements.length : filteredSystemOperations.length} سجل بنجاح`,
    });
  };

  const acceptOperationGroup = async (group: GroupedOperation) => {
    try {
      setProcessingGroupId(group.groupId);
      await Promise.all(group.items.map((item) => apiRequest("POST", `/api/warehouse-transfers/${item.id}/accept`)));

      await queryClient.invalidateQueries({ queryKey: ["/api/warehouse-transfers"] });
      toast({
        title: "تم القبول",
        description: "تم قبول العملية بنجاح",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error?.message || "فشل قبول العملية",
        variant: "destructive",
      });
    } finally {
      setProcessingGroupId(null);
    }
  };

  const rejectOperationGroup = async (group: GroupedOperation, reason?: string) => {
    try {
      setProcessingGroupId(group.groupId);
      await Promise.all(
        group.items.map((item) => apiRequest("POST", `/api/warehouse-transfers/${item.id}/reject`, { reason })),
      );

      await queryClient.invalidateQueries({ queryKey: ["/api/warehouse-transfers"] });
      toast({
        title: "تم الرفض",
        description: "تم رفض العملية",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error?.message || "فشل رفض العملية",
        variant: "destructive",
      });
    } finally {
      setProcessingGroupId(null);
    }
  };

  const openRejectDialog = (group: GroupedOperation) => {
    setSelectedRejectGroup(group);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!selectedRejectGroup) return;
    await rejectOperationGroup(selectedRejectGroup, rejectionReason);
    setRejectDialogOpen(false);
    setSelectedRejectGroup(null);
    setRejectionReason("");
  };

  const isCurrentViewLoading = operationView === "technicians"
    ? isTransfersLoading
    : operationView === "warehouses"
      ? isStockMovementsLoading
      : isSystemLogsLoading || isUsersLoading;

  if (isCurrentViewLoading) {
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-cyan-300" />
            <p className="mt-3 text-slate-300">جاري تحميل العمليات...</p>
          </div>
        </div>
    );
  }

  return (
    <>
      <div className="-m-8 min-h-[calc(100vh-5rem)] bg-[#0A0D14] text-slate-200 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-cyan-400/5 blur-[120px] rounded-full" />
          <div className="absolute top-[30%] -right-[15%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full" />
          <div className="absolute -bottom-[20%] left-[30%] w-[60%] h-[60%] bg-orange-500/5 blur-[150px] rounded-full" />
        </div>

        <div className="relative z-10 p-6 md:p-10 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-light text-white tracking-wide">إدارة <span className="font-bold">العمليات</span></h2>
              <p className="text-slate-500 text-sm mt-1 font-light">Global Logistics &amp; Inventory Control Center</p>
            </div>

            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.02] p-1">
              <button
                type="button"
                onClick={() => setOperationView("technicians")}
                className={
                  operationView === "technicians"
                    ? "px-4 py-1.5 rounded-full bg-cyan-400/15 text-cyan-300 text-xs font-bold border border-cyan-400/30"
                    : "px-4 py-1.5 rounded-full text-slate-400 text-xs font-bold"
                }
              >
                نقل المندوبين
              </button>
              <button
                type="button"
                onClick={() => setOperationView("warehouses")}
                className={
                  operationView === "warehouses"
                    ? "px-4 py-1.5 rounded-full bg-cyan-400/15 text-cyan-300 text-xs font-bold border border-cyan-400/30"
                    : "px-4 py-1.5 rounded-full text-slate-400 text-xs font-bold"
                }
              >
                نقل المستودعات
              </button>
              {currentUser?.role === "admin" && (
                <button
                  type="button"
                  onClick={() => setOperationView("system")}
                  className={
                    operationView === "system"
                      ? "px-4 py-1.5 rounded-full bg-cyan-400/15 text-cyan-300 text-xs font-bold border border-cyan-400/30"
                      : "px-4 py-1.5 rounded-full text-slate-400 text-xs font-bold"
                  }
                >
                  عمليات النظام
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 flex items-center gap-5">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white shrink-0">
                <Activity className="h-8 w-8" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-1">إجمالي العمليات</p>
                <div className="flex items-baseline gap-3">
                  <h3 className="text-3xl font-light text-white tabular-nums">{totalOperationsCount}</h3>
                  <span className="text-[10px] text-cyan-300 font-bold">+12.4%</span>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-2xl border border-cyan-400/20 rounded-[2rem] p-6 flex items-center gap-5">
              <div className="p-4 rounded-2xl bg-cyan-400/5 border border-cyan-400/20 text-cyan-300 shrink-0">
                {operationView === "system" ? <AlertCircle className="h-8 w-8" /> : <Truck className="h-8 w-8" />}
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-1">{operationView === "system" ? "أخطاء النظام" : "قيد التنفيذ"}</p>
                <div className="flex items-baseline gap-3">
                  <h3 className="text-3xl font-light text-cyan-300 tabular-nums">{operationView === "system" ? systemErrorsCount : pendingOperationsCount}</h3>
                  <span className="text-[10px] text-slate-400">{operationView === "system" ? "Error" : "Active"}</span>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-2xl border border-orange-400/20 rounded-[2rem] p-6 flex items-center gap-5">
              <div className="p-4 rounded-2xl bg-orange-400/5 border border-orange-400/20 text-orange-300 shrink-0">
                <Hourglass className="h-8 w-8" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-1">{operationView === "system" ? "تحذيرات" : "في الانتظار"}</p>
                <div className="flex items-baseline gap-3">
                  <h3 className="text-3xl font-light text-orange-300 tabular-nums">{waitingOperationsCount}</h3>
                  <span className="text-[10px] text-slate-400">{operationView === "system" ? "Warn" : "Queue"}</span>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-2xl border border-purple-500/20 rounded-[2rem] p-6 flex items-center gap-5">
              <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 text-purple-300 shrink-0">
                {operationView === "system" ? <Users className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-1">{operationView === "system" ? "مستخدمون نشطون" : "مكتملة اليوم"}</p>
                <div className="flex items-baseline gap-3">
                  <h3 className="text-3xl font-light text-purple-300 tabular-nums">{operationView === "system" ? onlineUsers.length : completedOperationsCount}</h3>
                  <span className="text-[10px] text-green-400 font-bold">{operationView === "system" ? "Online" : "4.2%"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative w-full lg:max-w-sm" dir="rtl">
              <Search className="h-4 w-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                className="w-full bg-white/[0.02] border border-white/10 rounded-full py-2 pr-11 pl-4 text-sm text-white placeholder:text-slate-600 focus:ring-cyan-400 focus:border-cyan-400"
                placeholder={
                  operationView === "technicians"
                    ? "البحث في نقل المندوبين..."
                    : operationView === "warehouses"
                      ? "البحث في نقل المستودعات..."
                      : "البحث في عمليات النظام..."
                }
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                data-testid="input-search-technician"
              />
            </div>

            <Button
              onClick={exportToExcel}
              className="rounded-full bg-white/5 border border-white/10 text-slate-200 hover:text-white hover:bg-white/10"
              data-testid="button-export-operations"
            >
              <FileDown className="h-4 w-4 ml-2" />
              {operationView === "technicians" ? "تصدير نقل المندوبين" : operationView === "warehouses" ? "تصدير نقل المستودعات" : "تصدير عمليات النظام"}
            </Button>
          </div>

          {operationView === "system" && (
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  "all",
                  "stock-request",
                  "stock-transfer",
                  "stock-depletion-technician",
                  "stock-depletion-warehouse",
                ] as SystemOperationFilter[]
              ).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setSystemOperationFilter(filterKey)}
                  className={
                    systemOperationFilter === filterKey
                      ? "px-3 py-1.5 rounded-full bg-cyan-400/15 text-cyan-300 text-xs font-bold border border-cyan-400/30"
                      : "px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/10 text-slate-400 text-xs font-bold hover:bg-white/[0.05]"
                  }
                >
                  {systemFilterLabels[filterKey]} ({systemCategoryCounts[filterKey]})
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-5 order-2 lg:order-1">
              <div className="flex items-end justify-between px-2">
                <h3 className="text-xl font-light text-white">سجل العمليات <span className="font-bold">الأخير</span></h3>
                <div className="px-4 py-1.5 rounded-full bg-white/10 text-white text-xs font-medium border border-white/10">
                  {operationView === "technicians" ? "نقل المندوبين" : operationView === "warehouses" ? "نقل المستودعات" : "عمليات النظام"}
                </div>
              </div>

              <div className="space-y-4">
                {recentOperations.length === 0 ? (
                  <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-3xl p-6 text-center text-slate-500">
                    {operationView === "technicians"
                      ? "لا توجد عمليات نقل مندوبين مطابقة للبحث."
                      : operationView === "warehouses"
                        ? "لا توجد نتائج لنقل المستودعات مطابقة للبحث."
                        : "لا توجد عمليات نظام مطابقة للبحث."}
                  </div>
                ) : (
                  recentOperations.map((group) => {
                    const progress = getProgressForGroup(group);
                    const pending = group.status === "pending" && group.sourceType === "technician-transfer";
                    const isTechnicianTransfer = group.sourceType === "technician-transfer";

                    return (
                      <div
                        key={group.groupId}
                        className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center gap-5 hover:bg-white/[0.04] transition-all cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => openOperationDetails(group)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openOperationDetails(group);
                          }
                        }}
                      >
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className={`size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 ${
                            group.status === "accepted"
                              ? "text-purple-300"
                              : group.status === "rejected"
                                ? "text-orange-300"
                                : "text-cyan-300"
                          }`}>
                            {group.sourceType === "system-event" ? <Activity className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                          </div>

                          <div className="w-52">
                            <p className="text-white font-medium text-sm">{group.warehouseName || "عملية مستودع"}</p>
                            <p className="text-slate-500 text-[10px] tracking-widest mt-1 font-mono">
                              {group.groupId.slice(0, 18).toUpperCase()}
                            </p>
                            {group.sourceType === "system-event" && group.systemMeta?.description && (
                              <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{group.systemMeta.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="w-full sm:w-32 flex justify-start sm:justify-center shrink-0">
                          {getStatusBadge(group.status)}
                        </div>

                        <div className="flex-1 flex flex-col gap-2 w-full">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 uppercase tracking-wider" dir="ltr">Progress</span>
                            <span className={`font-bold tabular-nums ${
                              group.status === "accepted"
                                ? "text-purple-300"
                                : group.status === "rejected"
                                  ? "text-slate-300"
                                  : "text-cyan-300"
                            }`}>
                              {progress}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div className={`h-full rounded-full ${getProgressClass(group)}`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              openOperationDetails(group);
                            }}
                            className="bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/25"
                          >
                            تفاصيل
                          </Button>

                          {pending ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  acceptOperationGroup(group);
                                }}
                                disabled={processingGroupId === group.groupId}
                                className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/30"
                              >
                                قبول
                              </Button>
                              <Button
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openRejectDialog(group);
                                }}
                                disabled={processingGroupId === group.groupId}
                                className="bg-red-500/20 border border-red-400/30 text-red-300 hover:bg-red-500/30"
                              >
                                رفض
                              </Button>
                            </div>
                          ) : isTechnicianTransfer ? (
                            <Link href={`/operation-details/${encodeURIComponent(group.groupId)}`}>
                              <Button
                                size="sm"
                                onClick={(event) => event.stopPropagation()}
                                className="bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10"
                              >
                                عرض
                              </Button>
                            </Link>
                          ) : group.sourceType === "system-event" ? (
                            <div className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-[10px] font-bold border border-purple-500/20">
                              {systemFilterLabels[getSystemOperationCategory(group)]}
                            </div>
                          ) : (
                            <div className="px-3 py-1 rounded-full bg-cyan-400/10 text-cyan-300 text-[10px] font-bold border border-cyan-400/20">
                              نتيجة النقل
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="lg:col-span-5 order-1 lg:order-2">
              <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 h-full min-h-[500px] flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between mb-8" dir="ltr">
                  <h3 className="text-lg font-light text-white">
                    {operationView === "technicians"
                      ? "Major Ongoing Operation"
                      : operationView === "warehouses"
                        ? "Warehouse Transfer Results"
                        : "System Operations Insights"}
                  </h3>
                  <span className="px-3 py-1 bg-orange-400/10 text-orange-300 text-[9px] font-bold rounded-full border border-orange-400/20 tracking-widest uppercase">
                    {operationView === "technicians" ? "Live" : operationView === "warehouses" ? "Results" : "Audit"}
                  </span>
                </div>

                {mainOperation ? (
                  <>
                    {operationView === "system" ? (
                      <div className="flex-1 flex flex-col w-full gap-4">
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                          <p className="text-slate-400 text-xs mb-1">آخر عملية نظام</p>
                          <p className="text-white font-semibold">{mainOperation.systemMeta?.description || mainOperation.warehouseName || "عملية نظام"}</p>
                          <p className="text-slate-500 text-xs mt-2">
                            المنفذ: {mainOperation.technicianName || "غير محدد"} • {mainOperation.systemMeta?.userRole || "-"}
                          </p>
                        </div>

                        <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/10 p-4 overflow-y-auto">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-white">الموجودون على النظام</h4>
                            <span className="text-xs text-cyan-300">{onlineUsers.length}</span>
                          </div>

                          <div className="space-y-2">
                            {onlineUsers.length === 0 ? (
                              <div className="text-xs text-slate-500 text-center py-4 border border-dashed border-white/10 rounded-xl">
                                لا يوجد مستخدمون نشطون حالياً
                              </div>
                            ) : (
                              onlineUsers.slice(0, 12).map((systemUser) => (
                                <div key={systemUser.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 border border-white/5">
                                  <div>
                                    <p className="text-sm text-white">{systemUser.fullName}</p>
                                    <p className="text-[11px] text-slate-500">{systemUser.email}</p>
                                  </div>
                                  <span className="text-[10px] text-green-300 border border-green-400/20 px-2 py-0.5 rounded-full bg-green-500/10">
                                    نشط
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                      <div className="relative size-64 mb-8">
                        <div className="absolute inset-0 rounded-full bg-orange-400/5 blur-3xl" />
                        <svg className="size-full -rotate-90" viewBox="0 0 256 256">
                          <circle cx="128" cy="128" r="115" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                          <circle
                            cx="128"
                            cy="128"
                            r="115"
                            fill="transparent"
                            stroke="url(#majorProgressGradient)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray="722"
                            strokeDashoffset={`${722 - (722 * getProgressForGroup(mainOperation)) / 100}`}
                            className="drop-shadow-[0_0_20px_rgba(255,140,0,0.5)]"
                          />
                          <defs>
                            <linearGradient id="majorProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#FF8C00" />
                              <stop offset="100%" stopColor="#D4AF37" />
                            </linearGradient>
                          </defs>
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-6xl font-black text-white tracking-tighter tabular-nums">
                            {getProgressForGroup(mainOperation)}
                            <span className="text-2xl font-light text-slate-400 ml-1">%</span>
                          </span>
                          <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-2">Completion</p>
                        </div>
                      </div>

                      <div className="text-center w-full mb-8">
                        <h4 className="text-2xl font-medium text-white mb-2">
                          {mainOperation.warehouseName || "تشغيل عملية رئيسية"}
                        </h4>
                        <p className="text-slate-400 text-sm font-light px-4">
                          {mainOperation.technicianName || "فريق العمليات"} • {mainOperation.items.length} صنف
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 w-full mt-auto">
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center text-center">
                          <CheckCircle2 className="text-cyan-300 mb-2 h-7 w-7" />
                          <p className="text-slate-300 text-sm font-bold mb-1">فحص الجودة</p>
                          <p className="text-cyan-300 text-xs font-mono">تم {Math.min(100, getProgressForGroup(mainOperation) + 20)}%</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center text-center">
                          <Clock3 className="text-orange-300 mb-2 h-7 w-7" />
                          <p className="text-slate-300 text-sm font-bold mb-1">السرعة</p>
                          <p className="text-orange-300 text-xs font-mono" dir="ltr">{Math.max(8, mainOperation.items.length * 2)} t/h</p>
                        </div>
                      </div>
                    </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <AlertCircle className="mx-auto h-10 w-10 mb-2" />
                      لا توجد عملية رئيسية حالياً.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={detailsDialogOpen && !!selectedDetailsGroup}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsDialogOpen(false);
            setSelectedDetailsGroup(null);
          }
        }}
      >
        <DialogContent className="bg-[#0A0D14]/95 backdrop-blur-xl border-white/20 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-cyan-300">تفاصيل العملية</DialogTitle>
            <DialogDescription className="text-slate-400">
              معلومات تفصيلية عن العملية المحددة من سجل العمليات الأخير.
            </DialogDescription>
          </DialogHeader>

          {selectedDetailsGroup && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400 text-sm">نوع العملية</span>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedDetailsGroup.status)}
                  <span className="px-3 py-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-300 text-xs font-bold">
                    {selectedDetailsGroup.sourceType === "system-event"
                      ? systemFilterLabels[getSystemOperationCategory(selectedDetailsGroup)]
                      : getSourceTypeLabel(selectedDetailsGroup)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-slate-500 text-xs">رقم العملية</p>
                  <p className="text-white font-medium mt-1 break-all">{selectedDetailsGroup.groupId}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-slate-500 text-xs">المستودع / الكيان</p>
                  <p className="text-white font-medium mt-1">
                    {selectedDetailsGroup.systemMeta?.entityName || selectedDetailsGroup.warehouseName || "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-slate-500 text-xs">المنفذ</p>
                  <p className="text-white font-medium mt-1">{selectedDetailsGroup.technicianName || "غير محدد"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-slate-500 text-xs">تم الإنشاء</p>
                  <p className="text-white font-medium mt-1">{formatOperationDate(selectedDetailsGroup.createdAt)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-slate-500 text-xs">وقت الاستجابة</p>
                  <p className="text-white font-medium mt-1">{formatOperationDate(selectedDetailsGroup.respondedAt)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-slate-500 text-xs">مستوى الخطورة</p>
                  <p className="text-white font-medium mt-1">{selectedDetailsGroup.systemMeta?.severity || "-"}</p>
                </div>
              </div>

              {(selectedDetailsGroup.notes || selectedDetailsGroup.systemMeta?.description || selectedDetailsGroup.rejectionReason) && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <p className="text-slate-500 text-xs mb-1">الوصف / الملاحظات</p>
                  <p className="text-slate-200 text-sm leading-6">
                    {selectedDetailsGroup.systemMeta?.description || selectedDetailsGroup.notes || "-"}
                  </p>
                  {selectedDetailsGroup.rejectionReason && (
                    <p className="text-red-300 text-xs mt-2">سبب الرفض: {selectedDetailsGroup.rejectionReason}</p>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-slate-500 text-xs mb-2">تفاصيل العناصر</p>
                {selectedDetailsGroup.items.length === 0 ? (
                  <p className="text-slate-500 text-sm">لا توجد عناصر مرتبطة بهذه العملية.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selectedDetailsGroup.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"
                      >
                        <div>
                          <p className="text-white">{item.itemNameAr}</p>
                          <p className="text-slate-500 mt-0.5">{item.packagingType}</p>
                        </div>
                        <p className="text-cyan-300 font-bold">{item.quantity}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-[#0A0D14]/95 backdrop-blur-xl border-red-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl text-red-400 flex items-center gap-2">
              <XCircle className="h-6 w-6" />
              رفض العملية
            </DialogTitle>
            <DialogDescription className="text-base text-gray-300">
              يرجى إدخال سبب الرفض (اختياري) لتوضيح القرار.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="مثال: الكمية المطلوبة غير متوفرة حالياً..."
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            className="min-h-[120px] bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-red-500"
            data-testid="textarea-rejection-reason"
          />

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              className="bg-white/5 border-white/20 text-white hover:bg-white/10"
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!selectedRejectGroup || processingGroupId === selectedRejectGroup.groupId}
              className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
            >
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

