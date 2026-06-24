import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  Clock3,
  FileText,
  Package,
  ShieldAlert,
  SlidersHorizontal,
  Smartphone,
  Square,
  Warehouse,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { hasRoleOrAbove, ROLES } from "@shared/roles";
import {
  getInventoryValueForItemType,
  InventoryEntry,
  useActiveItemTypes,
} from "@/hooks/use-item-types";

type NotificationFilter = "all" | "pending" | "approved" | "rejected";

interface InventoryRequest {
  id: string;
  technicianId: string;
  technicianName: string;
  technicianUsername?: string;
  technicianCity?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  notes?: string;
  adminNotes?: string;
  entries?: InventoryEntry[];
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
}

interface WarehouseTransfer {
  id: string;
  requestId?: string;
  warehouseId: string;
  warehouseName: string;
  technicianId: string;
  technicianName: string;
  itemType: string;
  packagingType: string;
  quantity: number;
  itemNameAr?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  notes?: string;
  rejectionReason?: string;
}

interface GroupedTransfer {
  requestId: string;
  warehouseId: string;
  warehouseName: string;
  technicianId: string;
  technicianName: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  notes?: string;
  rejectionReason?: string;
  transfers: WarehouseTransfer[];
}

interface WarehouseInfo {
  id: string;
  name: string;
}

interface ReceivedDeviceRequest {
  id: string;
  terminalId: string;
  serialNumber: string;
  technicianId: string;
  status: "pending" | "approved" | "rejected";
  adminNotes?: string | null;
  damagePart?: string | null;
  createdAt: string;
}

interface DirectoryUser {
  id: string;
  fullName?: string;
  username?: string;
  role?: string;
}

function getStatusBadge(status: string) {
  if (status === "pending") {
    return (
      <Badge className="bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">
        قيد الانتظار
      </Badge>
    );
  }

  if (status === "approved" || status === "accepted") {
    return (
      <Badge className="bg-green-500/10 text-green-300 border border-green-500/30">
        مقبول
      </Badge>
    );
  }

  return (
    <Badge className="bg-red-500/10 text-red-300 border border-red-500/30">
      مرفوض
    </Badge>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: itemTypes } = useActiveItemTypes();
  const [, setLocation] = useLocation();

  const isAdminOrSupervisor = hasRoleOrAbove(user?.role || "", ROLES.SUPERVISOR);
  const isSupervisor = user?.role === ROLES.SUPERVISOR;
  const [filter, setFilter] = useState<NotificationFilter>("pending");

  const [notificationSettings, setNotificationSettings] = useState({
    stock: true,
    daily: true,
    security: true,
  });
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const [deviceActionDialogOpen, setDeviceActionDialogOpen] = useState(false);
  const [selectedDeviceRequest, setSelectedDeviceRequest] = useState<ReceivedDeviceRequest | null>(null);
  const [deviceActionType, setDeviceActionType] = useState<"approve" | "reject" | null>(null);
  const [deviceAdminNotes, setDeviceAdminNotes] = useState("");

  const [techApproveDialogOpen, setTechApproveDialogOpen] = useState(false);
  const [techRejectDialogOpen, setTechRejectDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<GroupedTransfer | null>(null);
  const [techRejectionReason, setTechRejectionReason] = useState("");

  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [bulkApproveDialogOpen, setBulkApproveDialogOpen] = useState(false);
  const [bulkRejectDialogOpen, setBulkRejectDialogOpen] = useState(false);
  const [bulkRejectionReason, setBulkRejectionReason] = useState("");

  const usersQueryKey = user?.role === "admin" ? ["/api/users"] : ["/api/supervisor/technicians"];

  const { data: requests = [], isLoading: requestsLoading } = useQuery<InventoryRequest[]>({
    queryKey: user?.role === "admin" ? ["/api/inventory-requests"] : ["/api/supervisor/inventory-requests"],
    enabled: isAdminOrSupervisor,
  });

  const { data: warehouses = [] } = useQuery<WarehouseInfo[]>({
    queryKey: user?.role === "admin" ? ["/api/warehouses"] : ["/api/supervisor/warehouses"],
    enabled: isAdminOrSupervisor,
  });

  const { data: receivedDevices = [], isLoading: receivedDevicesLoading } = useQuery<ReceivedDeviceRequest[]>({
    queryKey: ["/api/received-devices"],
    enabled: isAdminOrSupervisor,
  });

  const { data: directoryUsers = [] } = useQuery<DirectoryUser[]>({
    queryKey: usersQueryKey,
    enabled: isAdminOrSupervisor,
  });

  const { data: transfers = [], isLoading: transfersLoading } = useQuery<WarehouseTransfer[]>({
    queryKey: ["/api/warehouse-transfers"],
    enabled: user?.role === "technician" && !!user?.id,
  });

  const { data: myInventoryRequests = [], isLoading: myRequestsLoading } = useQuery<InventoryRequest[]>({
    queryKey: ["/api/inventory-requests/my"],
    enabled: user?.role === "technician" && !!user?.id,
  });

  const groupedTransfers = useMemo(() => {
    if (isAdminOrSupervisor) return [] as GroupedTransfer[];

    const groupMap = new Map<string, GroupedTransfer>();

    transfers.forEach((transfer) => {
      const key = transfer.requestId || `${transfer.technicianId}-${transfer.warehouseId}-${new Date(transfer.createdAt).getTime()}-${transfer.status}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          requestId: key,
          warehouseId: transfer.warehouseId,
          warehouseName: transfer.warehouseName,
          technicianId: transfer.technicianId,
          technicianName: transfer.technicianName,
          status: transfer.status,
          createdAt: transfer.createdAt,
          notes: transfer.notes,
          rejectionReason: transfer.rejectionReason,
          transfers: [],
        });
      }

      groupMap.get(key)!.transfers.push(transfer);
    });

    return Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [transfers, isAdminOrSupervisor]);

  const filteredInventoryRequests = useMemo(
    () => requests.filter((request) => filter === "all" || request.status === filter),
    [requests, filter],
  );

  const filteredReceivedDevices = useMemo(
    () => receivedDevices.filter((device) => filter === "all" || device.status === filter),
    [receivedDevices, filter],
  );

  const filteredGroupedTransfers = useMemo(() => {
    return groupedTransfers.filter((group) => {
      if (filter === "all") return true;
      if (filter === "approved") return group.status === "accepted";
      return group.status === filter;
    });
  }, [groupedTransfers, filter]);

  const filteredMyInventoryRequests = useMemo(
    () => myInventoryRequests.filter((request) => filter === "all" || request.status === filter),
    [myInventoryRequests, filter],
  );

  const technicianNameById = useMemo(() => {
    const map = new Map<string, string>();
    directoryUsers.forEach((directoryUser) => {
      if (!directoryUser?.id) return;
      if (user?.role === "admin" && directoryUser.role !== "technician") return;
      map.set(
        directoryUser.id,
        directoryUser.fullName || directoryUser.username || `مندوب #${directoryUser.id.slice(0, 8)}`,
      );
    });
    return map;
  }, [directoryUsers, user?.role]);

  const getRequestedItems = (item: InventoryRequest | GroupedTransfer) => {
    if ("transfers" in item) {
      return item.transfers.map((transfer) => {
        const itemType = itemTypes?.find((type) => type.id === transfer.itemType);
        const itemName = transfer.itemNameAr || itemType?.nameAr || transfer.itemType;
        return `${itemName}: ${transfer.quantity} ${transfer.packagingType === "box" ? "كرتون" : "قطعة"}`;
      });
    }

    const rows: string[] = [];
    if (itemTypes && itemTypes.length > 0) {
      itemTypes.forEach((itemType) => {
        const boxes = getInventoryValueForItemType(itemType.id, item.entries, item, "boxes");
        const units = getInventoryValueForItemType(itemType.id, item.entries, item, "units");
        if (boxes > 0 || units > 0) {
          const parts: string[] = [];
          if (boxes > 0) parts.push(`${boxes} كرتون`);
          if (units > 0) parts.push(`${units} قطعة`);
          rows.push(`${itemType.nameAr}: ${parts.join(" + ")}`);
        }
      });
      return rows;
    }

    const fallback = [
      { name: "N950", boxes: item.n950Boxes, units: item.n950Units },
      { name: "I9000S", boxes: item.i9000sBoxes, units: item.i9000sUnits },
      { name: "I9100", boxes: item.i9100Boxes, units: item.i9100Units },
      { name: "ورق الطباعة", boxes: item.rollPaperBoxes, units: item.rollPaperUnits },
      { name: "الملصقات", boxes: item.stickersBoxes, units: item.stickersUnits },
      { name: "البطاريات", boxes: item.newBatteriesBoxes, units: item.newBatteriesUnits },
      { name: "موبايلي", boxes: item.mobilySimBoxes, units: item.mobilySimUnits },
      { name: "STC", boxes: item.stcSimBoxes, units: item.stcSimUnits },
      { name: "زين", boxes: item.zainSimBoxes, units: item.zainSimUnits },
    ];

    fallback.forEach((entry) => {
      if (entry.boxes > 0 || entry.units > 0) {
        const parts: string[] = [];
        if (entry.boxes > 0) parts.push(`${entry.boxes} كرتون`);
        if (entry.units > 0) parts.push(`${entry.units} قطعة`);
        rows.push(`${entry.name}: ${parts.join(" + ")}`);
      }
    });

    return rows;
  };

  const pendingBatches = useMemo(
    () => groupedTransfers.filter((group) => group.status === "pending"),
    [groupedTransfers],
  );

  const isAllSelected = selectedBatchIds.length > 0 && selectedBatchIds.length === pendingBatches.length;

  const toggleSelectBatch = (requestId: string) => {
    setSelectedBatchIds((current) =>
      current.includes(requestId) ? current.filter((id) => id !== requestId) : [...current, requestId],
    );
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedBatchIds([]);
      return;
    }
    setSelectedBatchIds(pendingBatches.map((batch) => batch.requestId));
  };

  const approveMutation = useMutation({
    mutationFn: async ({ id, warehouseId }: { id: string; warehouseId: string }) => {
      return apiRequest("PATCH", `/api/inventory-requests/${id}/approve`, { warehouseId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supervisor/inventory-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-transfers"] });
      setApproveDialogOpen(false);
      setSelectedRequest(null);
      setSelectedWarehouseId("");
      toast({
        title: "تم قبول الطلب",
        description: "تم إنشاء طلبات نقل المخزون بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error?.message || "فشل قبول الطلب",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return apiRequest("PATCH", `/api/inventory-requests/${id}/reject`, { adminNotes: notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supervisor/inventory-requests"] });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setAdminNotes("");
      toast({ title: "تم رفض الطلب" });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error?.message || "فشل رفض الطلب",
        variant: "destructive",
      });
    },
  });

  const techApproveBatchMutation = useMutation({
    mutationFn: async (transferIds: string[]) => {
      return apiRequest("POST", "/api/warehouse-transfer-batches/by-ids/accept", { transferIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-fixed-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-moving-inventory"] });
      setTechApproveDialogOpen(false);
      setSelectedBatch(null);
      toast({ title: "تم قبول الطلب" });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error?.message || "فشل قبول الطلب",
        variant: "destructive",
      });
    },
  });

  const techRejectBatchMutation = useMutation({
    mutationFn: async ({ transferIds, reason }: { transferIds: string[]; reason: string }) => {
      return apiRequest("POST", "/api/warehouse-transfer-batches/by-ids/reject", { transferIds, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-transfers"] });
      setTechRejectDialogOpen(false);
      setSelectedBatch(null);
      setTechRejectionReason("");
      toast({ title: "تم رفض الطلب" });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error?.message || "فشل رفض الطلب",
        variant: "destructive",
      });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (requestIds: string[]) => {
      return apiRequest("POST", "/api/warehouse-transfer-batches/bulk/accept", { requestIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-transfers"] });
      setBulkApproveDialogOpen(false);
      setSelectedBatchIds([]);
      toast({ title: "تم قبول الطلبات المحددة" });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error?.message || "فشل قبول الطلبات",
        variant: "destructive",
      });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async ({ requestIds, reason }: { requestIds: string[]; reason: string }) => {
      return apiRequest("POST", "/api/warehouse-transfer-batches/bulk/reject", { requestIds, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-transfers"] });
      setBulkRejectDialogOpen(false);
      setSelectedBatchIds([]);
      setBulkRejectionReason("");
      toast({ title: "تم رفض الطلبات المحددة" });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error?.message || "فشل رفض الطلبات",
        variant: "destructive",
      });
    },
  });

  const reviewDeviceStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: "approved" | "rejected"; notes: string }) => {
      return apiRequest("PATCH", `/api/received-devices/${id}/status`, {
        status,
        adminNotes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/received-devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/received-devices/pending/count"] });
      setDeviceActionDialogOpen(false);
      setSelectedDeviceRequest(null);
      setDeviceActionType(null);
      setDeviceAdminNotes("");
      toast({ title: "تم تحديث طلب الجهاز" });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error?.message || "فشل تحديث حالة الطلب",
        variant: "destructive",
      });
    },
  });

  const isLoading = isAdminOrSupervisor
    ? requestsLoading || receivedDevicesLoading
    : transfersLoading || myRequestsLoading;

  const allVisibleNotificationIds = useMemo(() => {
    if (isAdminOrSupervisor) {
      const stockIds = notificationSettings.stock
        ? filteredInventoryRequests.map((request) => `stock-${request.id}`)
        : [];
      const deviceIds = notificationSettings.daily
        ? filteredReceivedDevices.map((device) => `device-${device.id}`)
        : [];
      return [...stockIds, ...deviceIds];
    }

    const transferIds = notificationSettings.daily
      ? filteredGroupedTransfers.map((group) => `transfer-${group.requestId}`)
      : [];
    const myRequestIds = notificationSettings.stock
      ? filteredMyInventoryRequests.map((request) => `mine-${request.id}`)
      : [];

    return [...transferIds, ...myRequestIds];
  }, [
    isAdminOrSupervisor,
    notificationSettings.stock,
    notificationSettings.daily,
    filteredInventoryRequests,
    filteredReceivedDevices,
    filteredGroupedTransfers,
    filteredMyInventoryRequests,
  ]);

  const allCount = isAdminOrSupervisor
    ? requests.length + receivedDevices.length
    : groupedTransfers.length + myInventoryRequests.length;

  const pendingCount = isAdminOrSupervisor
    ? requests.filter((request) => request.status === "pending").length + receivedDevices.filter((device) => device.status === "pending").length
    : groupedTransfers.filter((group) => group.status === "pending").length + myInventoryRequests.filter((request) => request.status === "pending").length;

  const approvedCount = isAdminOrSupervisor
    ? requests.filter((request) => request.status === "approved").length + receivedDevices.filter((device) => device.status === "approved").length
    : groupedTransfers.filter((group) => group.status === "accepted").length + myInventoryRequests.filter((request) => request.status === "approved").length;

  const rejectedCount = isAdminOrSupervisor
    ? requests.filter((request) => request.status === "rejected").length + receivedDevices.filter((device) => device.status === "rejected").length
    : groupedTransfers.filter((group) => group.status === "rejected").length + myInventoryRequests.filter((request) => request.status === "rejected").length;

  const weeklySummaryHeights = useMemo(() => {
    const values = [
      allCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      Math.max(0, approvedCount - 1),
      Math.max(0, pendingCount - 1),
      Math.max(0, allCount - rejectedCount),
    ];
    const maxValue = Math.max(...values, 1);
    return values.map((value) => `${Math.max(12, Math.round((value / maxValue) * 100))}%`);
  }, [allCount, pendingCount, approvedCount, rejectedCount]);

  const isUnreadCard = (cardId: string, status: string) => {
    return status === "pending" && !readNotificationIds.includes(cardId);
  };

  const markAllAsRead = () => {
    setReadNotificationIds((current) => Array.from(new Set([...current, ...allVisibleNotificationIds])));
    toast({
      title: "تم التحديث",
      description: "تم تحديد كل الإشعارات المعروضة كمقروءة",
    });
  };

  const toggleSetting = (key: "stock" | "daily" | "security") => {
    setNotificationSettings((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleApproveClick = (request: InventoryRequest) => {
    setSelectedRequest(request);
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (request: InventoryRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const handleConfirmApprove = () => {
    if (!selectedRequest) return;
    if (!selectedWarehouseId) {
      toast({
        title: "خطأ",
        description: "يجب اختيار المستودع أولاً",
        variant: "destructive",
      });
      return;
    }
    approveMutation.mutate({ id: selectedRequest.id, warehouseId: selectedWarehouseId });
  };

  const handleConfirmReject = () => {
    if (!selectedRequest) return;
    if (!adminNotes.trim()) {
      toast({
        title: "خطأ",
        description: "يجب إدخال سبب الرفض",
        variant: "destructive",
      });
      return;
    }
    rejectMutation.mutate({ id: selectedRequest.id, notes: adminNotes });
  };

  const handleTechApproveBatchClick = (batch: GroupedTransfer) => {
    setSelectedBatch(batch);
    setTechApproveDialogOpen(true);
  };

  const handleTechRejectBatchClick = (batch: GroupedTransfer) => {
    setSelectedBatch(batch);
    setTechRejectDialogOpen(true);
  };

  const handleTechConfirmApprove = () => {
    if (!selectedBatch) return;
    techApproveBatchMutation.mutate(selectedBatch.transfers.map((transfer) => transfer.id));
  };

  const handleTechConfirmReject = () => {
    if (!selectedBatch) return;
    if (!techRejectionReason.trim()) {
      toast({
        title: "خطأ",
        description: "يجب إدخال سبب الرفض",
        variant: "destructive",
      });
      return;
    }

    techRejectBatchMutation.mutate({
      transferIds: selectedBatch.transfers.map((transfer) => transfer.id),
      reason: techRejectionReason,
    });
  };

  const handleConfirmBulkReject = () => {
    if (!bulkRejectionReason.trim()) {
      toast({
        title: "خطأ",
        description: "يجب إدخال سبب الرفض",
        variant: "destructive",
      });
      return;
    }

    bulkRejectMutation.mutate({ requestIds: selectedBatchIds, reason: bulkRejectionReason });
  };

  const handleDeviceActionClick = (device: ReceivedDeviceRequest, action: "approve" | "reject") => {
    if (!isAdminOrSupervisor) {
      toast({
        title: "غير مسموح",
        description: "مراجعة طلبات الأجهزة متاحة للمشرف أو المدير فقط",
        variant: "destructive",
      });
      return;
    }

    setSelectedDeviceRequest(device);
    setDeviceActionType(action);
    setDeviceAdminNotes("");
    setDeviceActionDialogOpen(true);
  };

  const handleConfirmDeviceAction = () => {
    if (!selectedDeviceRequest || !deviceActionType) return;

    if (deviceActionType === "reject" && !deviceAdminNotes.trim()) {
      toast({
        title: "خطأ",
        description: "يجب إدخال سبب الرفض",
        variant: "destructive",
      });
      return;
    }

    reviewDeviceStatusMutation.mutate({
      id: selectedDeviceRequest.id,
      status: deviceActionType === "approve" ? "approved" : "rejected",
      notes: deviceAdminNotes,
    });
  };

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-3xl border border-cyan-400/20 bg-slate-900/45 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-2xl bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">مركز التنبيهات الذكي</h2>
              <p className="text-slate-400 text-sm mt-1">
                {isAdminOrSupervisor
                  ? "إدارة ومتابعة طلبات المخزون وسحب الأجهزة"
                  : "إدارة طلبات النقل والإشعارات المرتبطة بالعهدة"}
              </p>
            </div>
          </div>

          <Button
            onClick={markAllAsRead}
            variant="outline"
            className="bg-cyan-400/10 border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/20"
            type="button"
          >
            <Check className="h-4 w-4 ml-2" />
            تحديد الكل كمقروء
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: "الكل", count: allCount },
            { value: "pending", label: "قيد الانتظار", count: pendingCount },
            { value: "approved", label: "مقبول", count: approvedCount },
            { value: "rejected", label: "مرفوض", count: rejectedCount },
          ].map((tab) => (
            <Button
              key={tab.value}
              onClick={() => setFilter(tab.value as NotificationFilter)}
              variant={filter === tab.value ? "default" : "outline"}
              className={
                filter === tab.value
                  ? "bg-cyan-400/20 text-cyan-200 border border-cyan-400/40"
                  : "bg-slate-900/50 border-slate-700/60 text-slate-300 hover:bg-slate-800/60"
              }
              data-testid={`button-filter-${tab.value}`}
            >
              {tab.label} ({tab.count})
            </Button>
          ))}
        </div>

        {!isAdminOrSupervisor && filter === "pending" && notificationSettings.daily && pendingBatches.length > 0 && (
          <div className="p-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Button
                  onClick={toggleSelectAll}
                  variant="outline"
                  size="sm"
                  className="bg-slate-900/50 border-slate-700 text-slate-200 hover:bg-slate-800/60"
                  data-testid="button-select-all"
                >
                  {isAllSelected ? (
                    <>
                      <CheckSquare className="h-4 w-4 ml-2" /> إلغاء تحديد الكل
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4 ml-2" /> تحديد الكل
                    </>
                  )}
                </Button>
                {selectedBatchIds.length > 0 && (
                  <Badge className="bg-cyan-400/15 text-cyan-300 border border-cyan-400/30">
                    {selectedBatchIds.length} محدد
                  </Badge>
                )}
              </div>

              {selectedBatchIds.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setBulkApproveDialogOpen(true)}
                    disabled={bulkApproveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-bulk-approve"
                  >
                    <Check className="h-4 w-4 ml-2" />
                    قبول المحدد ({selectedBatchIds.length})
                  </Button>
                  <Button
                    onClick={() => setBulkRejectDialogOpen(true)}
                    disabled={bulkRejectMutation.isPending}
                    variant="outline"
                    className="bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                    data-testid="button-bulk-reject"
                  >
                    <X className="h-4 w-4 ml-2" />
                    رفض المحدد ({selectedBatchIds.length})
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 space-y-4">
            {isLoading ? (
              <div className="text-center py-12 rounded-2xl border border-slate-700/60 bg-slate-900/40">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400" />
                <p className="mt-4 text-slate-400">جاري تحميل الإشعارات...</p>
              </div>
            ) : (
              <>
                {isAdminOrSupervisor ? (
                  <>
                    {notificationSettings.stock && (
                      <Card className="bg-slate-900/45 border-slate-700/60 overflow-hidden">
                        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-white font-semibold">
                            <Package className="h-4 w-4 text-cyan-300" />
                            طلبات المخزون
                          </div>
                          <Badge className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            {filteredInventoryRequests.length}
                          </Badge>
                        </div>

                        <div className="p-4 space-y-3">
                          {filteredInventoryRequests.length === 0 ? (
                            <div className="text-center py-6 text-slate-500">لا توجد طلبات مخزون مطابقة للفلترة</div>
                          ) : (
                            filteredInventoryRequests.map((request) => {
                              const cardId = `stock-${request.id}`;
                              const unread = isUnreadCard(cardId, request.status);

                              return (
                                <div
                                  key={request.id}
                                  onClick={() => setReadNotificationIds((current) => Array.from(new Set([...current, cardId])))}
                                  className={`rounded-xl border p-4 transition-all ${
                                    unread
                                      ? "border-cyan-400/40 bg-cyan-500/[0.06] border-r-4 border-r-cyan-400"
                                      : "border-slate-700/60 bg-slate-950/30 hover:bg-slate-900/40"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h3 className="text-white font-bold text-base">طلب مخزون من {request.technicianName}</h3>
                                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                        <Clock3 className="h-3.5 w-3.5" />
                                        {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true, locale: ar })}
                                      </p>
                                      <div className="flex flex-wrap gap-1.5 mt-3">
                                        {getRequestedItems(request).slice(0, 5).map((itemText, idx) => (
                                          <Badge key={idx} className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 text-xs">
                                            {itemText}
                                          </Badge>
                                        ))}
                                      </div>
                                      {request.notes && (
                                        <p className="text-xs text-slate-400 mt-3 flex items-start gap-1">
                                          <FileText className="h-3.5 w-3.5 mt-0.5" />
                                          {request.notes}
                                        </p>
                                      )}
                                    </div>
                                    {getStatusBadge(request.status)}
                                  </div>

                                  {request.status === "pending" && (
                                    <div className="flex gap-2 mt-4">
                                      <Button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleApproveClick(request);
                                        }}
                                        disabled={approveMutation.isPending}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                        data-testid={`button-approve-${request.id}`}
                                      >
                                        <Check className="h-4 w-4 ml-1" />
                                        موافقة
                                      </Button>
                                      <Button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleRejectClick(request);
                                        }}
                                        disabled={rejectMutation.isPending}
                                        variant="outline"
                                        className="flex-1 bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                                        data-testid={`button-reject-${request.id}`}
                                      >
                                        <X className="h-4 w-4 ml-1" />
                                        رفض
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </Card>
                    )}

                    {isAdminOrSupervisor && notificationSettings.daily && (
                      <Card className="bg-slate-900/45 border-slate-700/60 overflow-hidden">
                        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-white font-semibold">
                            <Smartphone className="h-4 w-4 text-cyan-300" />
                            طلبات سحب الأجهزة
                          </div>
                          <Badge className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            {filteredReceivedDevices.length}
                          </Badge>
                        </div>

                        <div className="p-4 space-y-3">
                          {filteredReceivedDevices.length === 0 ? (
                            <div className="text-center py-6 text-slate-500">لا توجد طلبات أجهزة مطابقة للفلترة</div>
                          ) : (
                            filteredReceivedDevices.map((device) => {
                              const cardId = `device-${device.id}`;
                              const unread = isUnreadCard(cardId, device.status);

                              return (
                                <div
                                  key={device.id}
                                  onClick={() => {
                                    setReadNotificationIds((current) => Array.from(new Set([...current, cardId])));
                                    setLocation(`/received-devices/${device.id}`);
                                  }}
                                  className={`rounded-xl border p-4 cursor-pointer transition-all ${
                                    unread
                                      ? "border-cyan-400/40 bg-cyan-500/[0.06] border-r-4 border-r-cyan-400"
                                      : "border-slate-700/60 bg-slate-950/30 hover:bg-slate-900/40"
                                  }`}
                                  data-testid={`received-device-request-${device.id}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h3 className="text-white font-bold text-base">طلب سحب جهاز: {device.terminalId}</h3>
                                      <p className="text-xs text-slate-400 mt-1">الرقم التسلسلي: {device.serialNumber}</p>
                                      <p className="text-xs text-slate-500 mt-1">
                                        المندوب: {technicianNameById.get(device.technicianId) || `مندوب #${device.technicianId.slice(0, 8)}`}
                                      </p>
                                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                        <Clock3 className="h-3.5 w-3.5" />
                                        {formatDistanceToNow(new Date(device.createdAt), { addSuffix: true, locale: ar })}
                                      </p>
                                      {(device.damagePart || device.adminNotes) && (
                                        <p className="text-xs text-slate-400 mt-2">{device.damagePart || device.adminNotes}</p>
                                      )}
                                    </div>
                                    {getStatusBadge(device.status)}
                                  </div>

                                  <div className="flex gap-2 mt-4">
                                    {device.status === "pending" && (
                                      <>
                                        <Button
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleDeviceActionClick(device, "approve");
                                          }}
                                          disabled={reviewDeviceStatusMutation.isPending}
                                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                          data-testid={`button-approve-device-${device.id}`}
                                        >
                                          <Check className="h-4 w-4 ml-1" />
                                          موافقة
                                        </Button>
                                        <Button
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleDeviceActionClick(device, "reject");
                                          }}
                                          disabled={reviewDeviceStatusMutation.isPending}
                                          variant="outline"
                                          className="flex-1 bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                                          data-testid={`button-reject-device-${device.id}`}
                                        >
                                          <X className="h-4 w-4 ml-1" />
                                          رفض
                                        </Button>
                                      </>
                                    )}

                                    <Button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setLocation(`/received-devices/${device.id}`);
                                      }}
                                      variant="outline"
                                      className="bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                                      type="button"
                                    >
                                      <ArrowRight className="h-4 w-4 ml-1" />
                                      فتح
                                    </Button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </Card>
                    )}
                  </>
                ) : (
                  <>
                    {notificationSettings.daily && (
                      <Card className="bg-slate-900/45 border-slate-700/60 overflow-hidden">
                        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-white font-semibold">
                            <Warehouse className="h-4 w-4 text-cyan-300" />
                            طلبات النقل من المستودعات
                          </div>
                          <Badge className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            {filteredGroupedTransfers.length}
                          </Badge>
                        </div>

                        <div className="p-4 space-y-3">
                          {filteredGroupedTransfers.length === 0 ? (
                            <div className="text-center py-6 text-slate-500">لا توجد طلبات نقل مطابقة للفلترة</div>
                          ) : (
                            filteredGroupedTransfers.map((group) => {
                              const cardId = `transfer-${group.requestId}`;
                              const unread = isUnreadCard(cardId, group.status);

                              return (
                                <div
                                  key={group.requestId}
                                  onClick={() => setReadNotificationIds((current) => Array.from(new Set([...current, cardId])))}
                                  className={`rounded-xl border p-4 transition-all ${
                                    unread
                                      ? "border-cyan-400/40 bg-cyan-500/[0.06] border-r-4 border-r-cyan-400"
                                      : "border-slate-700/60 bg-slate-950/30 hover:bg-slate-900/40"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h3 className="text-white font-bold text-base">طلب نقل من {group.warehouseName}</h3>
                                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                        <Clock3 className="h-3.5 w-3.5" />
                                        {formatDistanceToNow(new Date(group.createdAt), { addSuffix: true, locale: ar })}
                                      </p>
                                      <div className="flex flex-wrap gap-1.5 mt-3">
                                        {getRequestedItems(group).slice(0, 5).map((itemText, idx) => (
                                          <Badge key={idx} className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 text-xs">
                                            {itemText}
                                          </Badge>
                                        ))}
                                      </div>
                                      {group.notes && <p className="text-xs text-slate-400 mt-2">{group.notes}</p>}
                                    </div>
                                    {getStatusBadge(group.status)}
                                  </div>

                                  {group.status === "pending" && (
                                    <div className="mt-4 space-y-2">
                                      <div className="flex gap-2">
                                        <Button
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleTechApproveBatchClick(group);
                                          }}
                                          disabled={techApproveBatchMutation.isPending}
                                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                          data-testid={`button-approve-${group.requestId}`}
                                        >
                                          <Check className="h-4 w-4 ml-1" />
                                          موافقة
                                        </Button>
                                        <Button
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleTechRejectBatchClick(group);
                                          }}
                                          disabled={techRejectBatchMutation.isPending}
                                          variant="outline"
                                          className="flex-1 bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                                          data-testid={`button-reject-${group.requestId}`}
                                        >
                                          <X className="h-4 w-4 ml-1" />
                                          رفض
                                        </Button>
                                      </div>

                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          toggleSelectBatch(group.requestId);
                                        }}
                                        className={`w-full ${
                                          selectedBatchIds.includes(group.requestId)
                                            ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300"
                                            : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                                        }`}
                                        data-testid={`checkbox-${group.requestId}`}
                                      >
                                        {selectedBatchIds.includes(group.requestId) ? (
                                          <CheckSquare className="h-4 w-4 ml-1" />
                                        ) : (
                                          <Square className="h-4 w-4 ml-1" />
                                        )}
                                        {selectedBatchIds.includes(group.requestId) ? "محدد" : "تحديد"}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </Card>
                    )}

                    {notificationSettings.stock && (
                      <Card className="bg-slate-900/45 border-slate-700/60 overflow-hidden">
                        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-white font-semibold">
                            <Package className="h-4 w-4 text-cyan-300" />
                            طلباتي المخزنية
                          </div>
                          <Badge className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            {filteredMyInventoryRequests.length}
                          </Badge>
                        </div>

                        <div className="p-4 space-y-3">
                          {filteredMyInventoryRequests.length === 0 ? (
                            <div className="text-center py-6 text-slate-500">لا توجد طلبات مطابقة للفلترة</div>
                          ) : (
                            filteredMyInventoryRequests.map((request) => {
                              const cardId = `mine-${request.id}`;
                              const unread = isUnreadCard(cardId, request.status);

                              return (
                                <div
                                  key={request.id}
                                  onClick={() => setReadNotificationIds((current) => Array.from(new Set([...current, cardId])))}
                                  className={`rounded-xl border p-4 transition-all ${
                                    unread
                                      ? "border-cyan-400/40 bg-cyan-500/[0.06] border-r-4 border-r-cyan-400"
                                      : "border-slate-700/60 bg-slate-950/30 hover:bg-slate-900/40"
                                  }`}
                                  data-testid={`my-request-${request.id}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h3 className="text-white font-bold text-base">طلب مخزون</h3>
                                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true, locale: ar })}
                                      </p>
                                      <div className="flex flex-wrap gap-1.5 mt-3">
                                        {getRequestedItems(request).slice(0, 4).map((itemText, idx) => (
                                          <Badge key={idx} className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 text-xs">
                                            {itemText}
                                          </Badge>
                                        ))}
                                      </div>
                                      {request.adminNotes && request.status !== "pending" && (
                                        <p className="text-xs text-yellow-300 mt-3">رد المشرف: {request.adminNotes}</p>
                                      )}
                                    </div>
                                    {getStatusBadge(request.status)}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </Card>
                    )}
                  </>
                )}

                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    className="text-slate-400 hover:text-cyan-300 text-sm font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <ChevronDown className="h-4 w-4" />
                    عرض الإشعارات الأقدم
                  </button>
                </div>
              </>
            )}
          </div>

          <aside className="xl:col-span-4 rounded-3xl border border-slate-700/60 bg-slate-900/45 p-5 space-y-6 h-fit">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-cyan-300" />
              إعدادات التنبيهات
            </h3>

            <div className="space-y-4">
              {[
                { key: "stock" as const, label: "تنبيهات المخزون", hint: "طلبات المخزون ومتابعتها" },
                { key: "daily" as const, label: "العمليات اليومية", hint: "نقل المخزون وسحب الأجهزة" },
                { key: "security" as const, label: "تنبيهات الأمان", hint: "دخول وأذونات وسجل حساس" },
              ].map((setting) => {
                const enabled = notificationSettings[setting.key];
                return (
                  <div key={setting.key} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{setting.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{setting.hint}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSetting(setting.key)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? "bg-cyan-400" : "bg-slate-700"}`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${enabled ? "right-1" : "right-6"}`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-700/60 pt-5">
              <h4 className="text-sm font-semibold text-slate-300 mb-4">ملخص الأسبوع</h4>
              <div className="rounded-xl border border-slate-700/60 bg-black/20 p-4">
                <div className="flex items-end justify-between h-24 gap-1.5">
                  {weeklySummaryHeights.map((height, idx) => (
                    <div key={idx} className="w-full bg-cyan-400/15 rounded-t relative">
                      <div className="absolute bottom-0 w-full bg-cyan-400/80 rounded-t" style={{ height }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                  <span>السبت</span>
                  <span>الجمعة</span>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-300" />
                  إجمالي: {allCount}
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-yellow-300" />
                  قيد الانتظار: {pendingCount}
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  مرفوض: {rejectedCount}
                </div>
              </div>
            </div>

            {notificationSettings.security && (
              <div className="rounded-xl border border-slate-700/60 bg-slate-950/30 p-3 text-xs text-slate-400 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-orange-300 mt-0.5" />
                لا توجد تنبيهات أمان جديدة حالياً.
              </div>
            )}
          </aside>
        </div>
      </div>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0f0f15] border-[#18B2B0]/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl">قبول طلب المخزون</DialogTitle>
            <DialogDescription className="text-gray-400">
              اختر المستودع الذي سيتم السحب منه
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {selectedRequest && (
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-gray-400 mb-1">المندوب:</p>
                <p className="text-white font-bold">{selectedRequest.technicianName}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-white">المستودع</Label>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-warehouse">
                  <SelectValue placeholder="اختر المستودع" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f15] border-[#18B2B0]/20">
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id} className="text-white hover:bg-white/10">
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setApproveDialogOpen(false);
                setSelectedWarehouseId("");
              }}
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmApprove}
              disabled={!selectedWarehouseId || approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-confirm-approve"
            >
              تأكيد القبول
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0f0f15] border-[#18B2B0]/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl">رفض طلب المخزون</DialogTitle>
            <DialogDescription className="text-gray-400">يرجى إدخال سبب الرفض</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              placeholder="اكتب سبب الرفض هنا..."
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 min-h-[100px]"
              data-testid="textarea-admin-notes"
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setAdminNotes("");
              }}
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmReject}
              disabled={!adminNotes.trim() || rejectMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-reject"
            >
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deviceActionDialogOpen} onOpenChange={setDeviceActionDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0f0f15] border-[#18B2B0]/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {deviceActionType === "approve" ? "الموافقة على طلب سحب جهاز" : "رفض طلب سحب جهاز"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {deviceActionType === "approve"
                ? "سيتم اعتماد الطلب وتحديث حالته مباشرة"
                : "يرجى إدخال سبب الرفض قبل المتابعة"}
            </DialogDescription>
          </DialogHeader>

          {selectedDeviceRequest && (
            <div className="py-2 px-3 bg-white/5 rounded-lg border border-white/10">
              <p className="text-sm text-gray-400">الجهاز:</p>
              <p className="text-white font-semibold">
                {selectedDeviceRequest.terminalId} • {selectedDeviceRequest.serialNumber}
              </p>
            </div>
          )}

          <div className="py-2">
            <Textarea
              value={deviceAdminNotes}
              onChange={(event) => setDeviceAdminNotes(event.target.value)}
              placeholder={deviceActionType === "approve" ? "ملاحظات اختيارية..." : "اكتب سبب الرفض هنا..."}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 min-h-[100px]"
              data-testid="textarea-device-action-notes"
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeviceActionDialogOpen(false);
                setSelectedDeviceRequest(null);
                setDeviceActionType(null);
                setDeviceAdminNotes("");
              }}
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmDeviceAction}
              disabled={
                reviewDeviceStatusMutation.isPending ||
                (deviceActionType === "reject" && !deviceAdminNotes.trim())
              }
              className={
                deviceActionType === "approve"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
              data-testid="button-confirm-device-action"
            >
              {reviewDeviceStatusMutation.isPending ? "جاري الحفظ..." : "تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={techApproveDialogOpen} onOpenChange={setTechApproveDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0f0f15] border-[#18B2B0]/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl">قبول طلب النقل</DialogTitle>
            <DialogDescription className="text-gray-400">
              سيتم إضافة الأصناف إلى مخزونك بعد الموافقة
            </DialogDescription>
          </DialogHeader>

          {selectedBatch && (
            <div className="py-4 p-3 bg-white/5 rounded-lg border border-white/10">
              <p className="text-sm text-gray-400 mb-1">من المستودع:</p>
              <p className="text-white font-bold">{selectedBatch.warehouseName}</p>
              <p className="text-xs text-gray-500 mt-2">عدد الأصناف: {selectedBatch.transfers.length}</p>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setTechApproveDialogOpen(false)}
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleTechConfirmApprove}
              disabled={techApproveBatchMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-tech-confirm-approve"
            >
              تأكيد القبول
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={techRejectDialogOpen} onOpenChange={setTechRejectDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0f0f15] border-[#18B2B0]/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl">رفض طلب النقل</DialogTitle>
            <DialogDescription className="text-gray-400">يرجى إدخال سبب الرفض</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              value={techRejectionReason}
              onChange={(event) => setTechRejectionReason(event.target.value)}
              placeholder="اكتب سبب الرفض هنا..."
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 min-h-[100px]"
              data-testid="textarea-tech-rejection-reason"
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setTechRejectDialogOpen(false);
                setTechRejectionReason("");
              }}
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleTechConfirmReject}
              disabled={!techRejectionReason.trim() || techRejectBatchMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-tech-confirm-reject"
            >
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkApproveDialogOpen} onOpenChange={setBulkApproveDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0f0f15] border-[#18B2B0]/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl">قبول الطلبات المحددة</DialogTitle>
            <DialogDescription className="text-gray-400">
              هل تريد قبول {selectedBatchIds.length} طلب؟
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkApproveDialogOpen(false)}
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            >
              إلغاء
            </Button>
            <Button
              onClick={() => bulkApproveMutation.mutate(selectedBatchIds)}
              disabled={bulkApproveMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-confirm-bulk-approve"
            >
              {bulkApproveMutation.isPending ? "جاري القبول..." : "تأكيد القبول"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkRejectDialogOpen} onOpenChange={setBulkRejectDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0f0f15] border-[#18B2B0]/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl">رفض الطلبات المحددة</DialogTitle>
            <DialogDescription className="text-gray-400">
              يرجى إدخال سبب رفض {selectedBatchIds.length} طلب
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              value={bulkRejectionReason}
              onChange={(event) => setBulkRejectionReason(event.target.value)}
              placeholder="اكتب سبب الرفض هنا..."
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 min-h-[100px]"
              data-testid="textarea-bulk-rejection-reason"
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setBulkRejectDialogOpen(false);
                setBulkRejectionReason("");
              }}
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmBulkReject}
              disabled={!bulkRejectionReason.trim() || bulkRejectMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-bulk-reject"
            >
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

