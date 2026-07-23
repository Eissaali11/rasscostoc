import { useTranslation, t } from "@/lib/language";
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
      <Badge className="bg-amber-50 text-amber-700 border border-amber-200/80 font-semibold">
        {t('notifications.pending_waiting')}
      </Badge>
    );
  }

  if (status === "approved" || status === "accepted") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-semibold">
        {t('notifications.approved')}
      </Badge>
    );
  }

  return (
    <Badge className="bg-rose-50 text-rose-700 border border-rose-200/80 font-semibold">
      {t('notifications.rejected')}
    </Badge>
  );
}

export default function NotificationsPage() {
  const { t } = useTranslation();
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
        directoryUser.fullName || directoryUser.username || t('notifications.item_9013', { var_0: directoryUser.id.slice(0, 8) }),
      );
    });
    return map;
  }, [directoryUsers, user?.role]);

  const getRequestedItems = (item: InventoryRequest | GroupedTransfer) => {
    if ("transfers" in item) {
      return item.transfers.map((transfer) => {
        const itemType = itemTypes?.find((type) => type.id === transfer.itemType);
        const itemName = transfer.itemNameAr || itemType?.nameAr || transfer.itemType;
        return t('notifications.item_3029', { var_0: itemName, var_1: transfer.quantity, var_2: transfer.packagingType === "box" ? t('notifications.box') : t('notifications.unit') });
      });
    }

    const rows: string[] = [];
    if (itemTypes && itemTypes.length > 0) {
      itemTypes.forEach((itemType) => {
        const boxes = getInventoryValueForItemType(itemType.id, item.entries, item, "boxes");
        const units = getInventoryValueForItemType(itemType.id, item.entries, item, "units");
        if (boxes > 0 || units > 0) {
          const parts: string[] = [];
          if (boxes > 0) parts.push(t('notifications.box_1', { var_0: boxes }));
          if (units > 0) parts.push(t('notifications.unit_1', { var_0: units }));
          rows.push(`${itemType.nameAr}: ${parts.join(" + ")}`);
        }
      });
      return rows;
    }

    const fallback = [
      { name: "N950", boxes: item.n950Boxes, units: item.n950Units },
      { name: "I9000S", boxes: item.i9000sBoxes, units: item.i9000sUnits },
      { name: "I9100", boxes: item.i9100Boxes, units: item.i9100Units },
      { name: t('notifications.paper_print'), boxes: item.rollPaperBoxes, units: item.rollPaperUnits },
      { name: t('notifications.stickers'), boxes: item.stickersBoxes, units: item.stickersUnits },
      { name: t('notifications.batteries'), boxes: item.newBatteriesBoxes, units: item.newBatteriesUnits },
      { name: t('notifications.mobily'), boxes: item.mobilySimBoxes, units: item.mobilySimUnits },
      { name: "STC", boxes: item.stcSimBoxes, units: item.stcSimUnits },
      { name: t('notifications.zain'), boxes: item.zainSimBoxes, units: item.zainSimUnits },
    ];

    fallback.forEach((entry) => {
      if (entry.boxes > 0 || entry.units > 0) {
        const parts: string[] = [];
        if (entry.boxes > 0) parts.push(t('notifications.box_1', { var_0: entry.boxes }));
        if (entry.units > 0) parts.push(t('notifications.unit_1', { var_0: entry.units }));
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
        title: t('notifications.completed_approve_request'),
        description: t('notifications.completed_requests_inventory_s'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('notifications.error'),
        description: error?.message || t('notifications.fail_approve_request'),
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
      toast({ title: t('notifications.completed_reject_request') });
    },
    onError: (error: any) => {
      toast({
        title: t('notifications.error'),
        description: error?.message || t('notifications.fail_reject_request'),
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
      toast({ title: t('notifications.completed_approve_request') });
    },
    onError: (error: any) => {
      toast({
        title: t('notifications.error'),
        description: error?.message || t('notifications.fail_approve_request'),
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
      toast({ title: t('notifications.completed_reject_request') });
    },
    onError: (error: any) => {
      toast({
        title: t('notifications.error'),
        description: error?.message || t('notifications.fail_reject_request'),
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
      toast({ title: t('notifications.completed_approve_requests') });
    },
    onError: (error: any) => {
      toast({
        title: t('notifications.error'),
        description: error?.message || t('notifications.fail_approve_requests'),
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
      toast({ title: t('notifications.completed_reject_requests') });
    },
    onError: (error: any) => {
      toast({
        title: t('notifications.error'),
        description: error?.message || t('notifications.fail_reject_requests'),
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
      toast({ title: t('notifications.completed_update_request_devic') });
    },
    onError: (error: any) => {
      toast({
        title: t('notifications.error'),
        description: error?.message || t('notifications.fail_update_status_request'),
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
      title: t('notifications.completed_update'),
      description: t('notifications.completed_notifications'),
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
        title: t('notifications.error'),
        description: t('notifications.warehouse_3'),
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
        title: t('notifications.error'),
        description: t('notifications.submit_reason_reject_1'),
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
        title: t('notifications.error'),
        description: t('notifications.submit_reason_reject_1'),
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
        title: t('notifications.error'),
        description: t('notifications.submit_reason_reject_1'),
        variant: "destructive",
      });
      return;
    }

    bulkRejectMutation.mutate({ requestIds: selectedBatchIds, reason: bulkRejectionReason });
  };

  const handleDeviceActionClick = (device: ReceivedDeviceRequest, action: "approve" | "reject") => {
    if (!isAdminOrSupervisor) {
      toast({
        title: t('notifications.item_12807'),
        description: t('notifications.review_requests_devices_manage'),
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
        title: t('notifications.error'),
        description: t('notifications.submit_reason_reject_1'),
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
      <div className="space-y-6 font-sans">
        <div className="courier-panel courier-panel-static p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm bg-white/90">
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-2xl bg-[#18b2b0]/10 border border-[#18b2b0]/25 flex items-center justify-center text-[#18b2b0]">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('notifications.item_28728')}</h2>
              <p className="text-slate-500 text-sm mt-1">
                {isAdminOrSupervisor
                  ? t('notifications.management_requests_inventory_')
                  : t('notifications.management_requests')}
              </p>
            </div>
          </div>

          <Button
            onClick={markAllAsRead}
            variant="outline"
            className="bg-[#18b2b0]/10 border-[#18b2b0]/25 text-[#18b2b0] hover:bg-[#18b2b0]/20 font-bold"
            type="button"
          >
            <Check className="h-4 w-4 ml-2" />
            {t('notifications.all')}
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: t('notifications.all_2'), count: allCount },
            { value: "pending", label: t('notifications.pending_waiting'), count: pendingCount },
            { value: "approved", label: t('notifications.approved'), count: approvedCount },
            { value: "rejected", label: t('notifications.rejected'), count: rejectedCount },
          ].map((tab) => (
            <Button
              key={tab.value}
              onClick={() => setFilter(tab.value as NotificationFilter)}
              variant={filter === tab.value ? "default" : "outline"}
              className={
                filter === tab.value
                  ? "bg-[#18b2b0] text-white border border-[#18b2b0] shadow-xs font-bold"
                  : "bg-white/80 border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
              }
              data-testid={`button-filter-${tab.value}`}
            >
              {tab.label} ({tab.count})
            </Button>
          ))}
        </div>

        {!isAdminOrSupervisor && filter === "pending" && notificationSettings.daily && pendingBatches.length > 0 && (
          <div className="p-4 rounded-2xl border border-[#18b2b0]/25 bg-[#18b2b0]/5 shadow-xs">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Button
                  onClick={toggleSelectAll}
                  variant="outline"
                  size="sm"
                  className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
                  data-testid="button-select-all"
                >
                  {isAllSelected ? (
                    <>
                      <CheckSquare className="h-4 w-4 ml-2 text-[#18b2b0]" />{t('notifications.cancel_all')}
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4 ml-2" />{t('notifications.all_1')}
                    </>
                  )}
                </Button>
                {selectedBatchIds.length > 0 && (
                  <Badge className="bg-[#18b2b0]/15 text-[#18b2b0] border border-[#18b2b0]/30 font-bold">
                    {t('notifications.item_7433', { count: selectedBatchIds.length })}
                  </Badge>
                )}
              </div>

              {selectedBatchIds.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setBulkApproveDialogOpen(true)}
                    disabled={bulkApproveMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    data-testid="button-bulk-approve"
                  >
                    <Check className="h-4 w-4 ml-2" />
                    {t('notifications.approve_specified_count', { count: selectedBatchIds.length })}
                  </Button>
                  <Button
                    onClick={() => setBulkRejectDialogOpen(true)}
                    disabled={bulkRejectMutation.isPending}
                    variant="outline"
                    className="bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 font-bold"
                    data-testid="button-bulk-reject"
                  >
                    <X className="h-4 w-4 ml-2" />
                    {t('notifications.reject_specified_count', { count: selectedBatchIds.length })}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 space-y-4">
            {isLoading ? (
              <div className="text-center py-12 rounded-2xl border border-slate-200 bg-white/80 shadow-xs">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#18b2b0]" />
                <p className="mt-4 text-slate-500 font-medium">{t('notifications.loading_notifications')}</p>
              </div>
            ) : (
              <>
                {isAdminOrSupervisor ? (
                  <>
                    {notificationSettings.stock && (
                      <Card className="courier-panel courier-panel-static border border-slate-200/80 shadow-sm overflow-hidden bg-white/90">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-slate-900 font-bold">
                            <Package className="h-4 w-4 text-[#18b2b0]" />
                            {t('notifications.requests_inventory')}
                          </div>
                          <Badge className="bg-[#18b2b0]/10 text-[#18b2b0] border border-[#18b2b0]/20 font-bold">
                            {filteredInventoryRequests.length}
                          </Badge>
                        </div>

                        <div className="p-4 space-y-3">
                          {filteredInventoryRequests.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 font-medium">{t('notifications.no_requests')}</div>
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
                                      ? "border-[#18b2b0]/40 bg-[#18b2b0]/[0.04] border-r-4 border-r-[#18b2b0] shadow-xs"
                                      : "border-slate-200/80 bg-white hover:bg-slate-50/80"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h3 className="text-slate-900 font-bold text-base">{t('notifications.request_7')}{request.technicianName}</h3>
                                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                        <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                                        {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true, locale: ar })}
                                      </p>
                                      <div className="flex flex-wrap gap-1.5 mt-3">
                                        {getRequestedItems(request).slice(0, 5).map((itemText, idx) => (
                                          <Badge key={idx} className="bg-slate-100 text-slate-700 border border-slate-200/70 text-xs font-semibold">
                                            {itemText}
                                          </Badge>
                                        ))}
                                      </div>
                                      {request.notes && (
                                        <p className="text-xs text-slate-600 mt-3 flex items-start gap-1">
                                          <FileText className="h-3.5 w-3.5 mt-0.5 text-slate-400" />
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
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                        data-testid={`button-approve-${request.id}`}
                                      >
                                        <Check className="h-4 w-4 ml-1" />
                                        {t('notifications.item_9568')}
                                      </Button>
                                      <Button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleRejectClick(request);
                                        }}
                                        disabled={rejectMutation.isPending}
                                        variant="outline"
                                        className="flex-1 bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 font-bold"
                                        data-testid={`button-reject-${request.id}`}
                                      >
                                        <X className="h-4 w-4 ml-1" />
                                        {t('notifications.reject')}
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
                      <Card className="courier-panel courier-panel-static border border-slate-200/80 shadow-sm overflow-hidden bg-white/90">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-slate-900 font-bold">
                            <Smartphone className="h-4 w-4 text-[#18b2b0]" />
                            {t('notifications.requests_withdraw_devices')}
                          </div>
                          <Badge className="bg-[#18b2b0]/10 text-[#18b2b0] border border-[#18b2b0]/20 font-bold">
                            {filteredReceivedDevices.length}
                          </Badge>
                        </div>

                        <div className="p-4 space-y-3">
                          {filteredReceivedDevices.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 font-medium">{t('notifications.no_requests_devices')}</div>
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
                                      ? "border-[#18b2b0]/40 bg-[#18b2b0]/[0.04] border-r-4 border-r-[#18b2b0] shadow-xs"
                                      : "border-slate-200/80 bg-white hover:bg-slate-50/80"
                                  }`}
                                  data-testid={`received-device-request-${device.id}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h3 className="text-slate-900 font-bold text-base">{t('notifications.request_withdraw_device_1')}{device.terminalId}</h3>
                                      <p className="text-xs text-slate-600 mt-1">{t('notifications.number_serial')}{device.serialNumber}</p>
                                      <p className="text-xs text-slate-500 mt-1">
                                        {t('notifications.technician_label', { name: technicianNameById.get(device.technicianId) || t('notifications.item_9013', { var_0: device.technicianId.slice(0, 8) }) })}
                                      </p>
                                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                        <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                                        {formatDistanceToNow(new Date(device.createdAt), { addSuffix: true, locale: ar })}
                                      </p>
                                      {(device.damagePart || device.adminNotes) && (
                                        <p className="text-xs text-slate-600 mt-2 font-medium">{device.damagePart || device.adminNotes}</p>
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
                                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                          data-testid={`button-approve-device-${device.id}`}
                                        >
                                          <Check className="h-4 w-4 ml-1" />
                                          {t('notifications.item_9568')}
                                        </Button>
                                        <Button
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleDeviceActionClick(device, "reject");
                                          }}
                                          disabled={reviewDeviceStatusMutation.isPending}
                                          variant="outline"
                                          className="flex-1 bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 font-bold"
                                          data-testid={`button-reject-device-${device.id}`}
                                        >
                                          <X className="h-4 w-4 ml-1" />
                                          {t('notifications.reject')}
                                        </Button>
                                      </>
                                    )}

                                    <Button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setLocation(`/received-devices/${device.id}`);
                                      }}
                                      variant="outline"
                                      className="bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold"
                                      type="button"
                                    >
                                      <ArrowRight className="h-4 w-4 ml-1" />
                                      {t('notifications.item_4760')}
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
                      <Card className="courier-panel courier-panel-static border border-slate-200/80 shadow-sm overflow-hidden bg-white/90">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-slate-900 font-bold">
                            <Warehouse className="h-4 w-4 text-[#18b2b0]" />
                            {t('notifications.requests_warehouses')}
                          </div>
                          <Badge className="bg-[#18b2b0]/10 text-[#18b2b0] border border-[#18b2b0]/20 font-bold">
                            {filteredGroupedTransfers.length}
                          </Badge>
                        </div>

                        <div className="p-4 space-y-3">
                          {filteredGroupedTransfers.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 font-medium">{t('notifications.no_requests_1')}</div>
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
                                      ? "border-[#18b2b0]/40 bg-[#18b2b0]/[0.04] border-r-4 border-r-[#18b2b0] shadow-xs"
                                      : "border-slate-200/80 bg-white hover:bg-slate-50/80"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h3 className="text-slate-900 font-bold text-base">{t('notifications.request_8')}{group.warehouseName}</h3>
                                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                        <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                                        {formatDistanceToNow(new Date(group.createdAt), { addSuffix: true, locale: ar })}
                                      </p>
                                      <div className="flex flex-wrap gap-1.5 mt-3">
                                        {getRequestedItems(group).slice(0, 5).map((itemText, idx) => (
                                          <Badge key={idx} className="bg-slate-100 text-slate-700 border border-slate-200/70 text-xs font-semibold">
                                            {itemText}
                                          </Badge>
                                        ))}
                                      </div>
                                      {group.notes && <p className="text-xs text-slate-600 mt-2 font-medium">{group.notes}</p>}
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
                                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                          data-testid={`button-approve-${group.requestId}`}
                                        >
                                          <Check className="h-4 w-4 ml-1" />
                                          {t('notifications.item_9568')}
                                        </Button>
                                        <Button
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleTechRejectBatchClick(group);
                                          }}
                                          disabled={techRejectBatchMutation.isPending}
                                          variant="outline"
                                          className="flex-1 bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 font-bold"
                                          data-testid={`button-reject-${group.requestId}`}
                                        >
                                          <X className="h-4 w-4 ml-1" />
                                          {t('notifications.reject')}
                                        </Button>
                                      </div>

                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          toggleSelectBatch(group.requestId);
                                        }}
                                        className={`w-full font-semibold ${
                                          selectedBatchIds.includes(group.requestId)
                                            ? "bg-[#18b2b0]/15 border-[#18b2b0]/40 text-[#18b2b0]"
                                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                        }`}
                                        data-testid={`checkbox-${group.requestId}`}
                                      >
                                        {selectedBatchIds.includes(group.requestId) ? (
                                          <CheckSquare className="h-4 w-4 ml-1 text-[#18b2b0]" />
                                        ) : (
                                          <Square className="h-4 w-4 ml-1" />
                                        )}
                                        {selectedBatchIds.includes(group.requestId) ? t('notifications.item_6352') : t('notifications.item_7935')}
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
                      <Card className="courier-panel courier-panel-static border border-slate-200/80 shadow-sm overflow-hidden bg-white/90">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-slate-900 font-bold">
                            <Package className="h-4 w-4 text-[#18b2b0]" />
                            {t('notifications.item_22311')}
                          </div>
                          <Badge className="bg-[#18b2b0]/10 text-[#18b2b0] border border-[#18b2b0]/20 font-bold">
                            {filteredMyInventoryRequests.length}
                          </Badge>
                        </div>

                        <div className="p-4 space-y-3">
                          {filteredMyInventoryRequests.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 font-medium">{t('notifications.no_requests_2')}</div>
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
                                      ? "border-[#18b2b0]/40 bg-[#18b2b0]/[0.04] border-r-4 border-r-[#18b2b0] shadow-xs"
                                      : "border-slate-200/80 bg-white hover:bg-slate-50/80"
                                  }`}
                                  data-testid={`my-request-${request.id}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h3 className="text-slate-900 font-bold text-base">{t('notifications.request')}</h3>
                                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                        {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true, locale: ar })}
                                      </p>
                                      <div className="flex flex-wrap gap-1.5 mt-3">
                                        {getRequestedItems(request).slice(0, 4).map((itemText, idx) => (
                                          <Badge key={idx} className="bg-slate-100 text-slate-700 border border-slate-200/70 text-xs font-semibold">
                                            {itemText}
                                          </Badge>
                                        ))}
                                      </div>
                                      {request.adminNotes && request.status !== "pending" && (
                                        <p className="text-xs text-amber-700 mt-3 font-semibold">{t('notifications.supervisor')}{request.adminNotes}</p>
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
                    className="text-slate-500 hover:text-[#18b2b0] text-sm font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <ChevronDown className="h-4 w-4" />
                    {t('notifications.view_notifications')}
                  </button>
                </div>
              </>
            )}
          </div>

          <aside className="xl:col-span-4 courier-panel courier-panel-static p-5 space-y-6 h-fit bg-white/90 border border-slate-200/80 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#18b2b0]" />
              {t('notifications.item_25401')}
            </h3>

            <div className="space-y-4">
              {[
                { key: "stock" as const, label: t('notifications.inventory'), hint: t('notifications.requests_inventory_1') },
                { key: "daily" as const, label: t('notifications.operations'), hint: t('notifications.inventory_devices') },
                { key: "security" as const, label: t('notifications.security'), hint: t('notifications.item_30312') },
              ].map((setting) => {
                const enabled = notificationSettings[setting.key];
                return (
                  <div key={setting.key} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{setting.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{setting.hint}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSetting(setting.key)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? "bg-[#18b2b0]" : "bg-slate-200"}`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-xs transition-all ${enabled ? "right-1" : "right-6"}`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-200/80 pt-5">
              <h4 className="text-sm font-bold text-slate-800 mb-4">{t('notifications.week')}</h4>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-end justify-between h-24 gap-1.5">
                  {weeklySummaryHeights.map((height, idx) => (
                    <div key={idx} className="w-full bg-[#18b2b0]/15 rounded-t relative">
                      <div className="absolute bottom-0 w-full bg-[#18b2b0] rounded-t" style={{ height }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-semibold">
                  <span>{t('notifications.item_7920')}</span>
                  <span>{t('notifications.item_9534')}</span>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#18b2b0]" />
                  {t('notifications.total_count', { count: allCount })}
                </div>
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {t('notifications.pending_count', { count: pendingCount })}
                </div>
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  {t('notifications.rejected_count', { count: rejectedCount })}
                </div>
              </div>
            </div>

            {notificationSettings.security && (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2 font-medium">
                <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                {t('notifications.no_security')}
              </div>
            )}
          </aside>
        </div>
      </div>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">{t('notifications.approve_request_inventory')}</DialogTitle>
            <DialogDescription className="text-slate-500">
              {t('notifications.warehouse_withdraw')}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {selectedRequest && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-500 mb-1">{t('notifications.technician')}</p>
                <p className="text-slate-900 font-bold">{selectedRequest.technicianName}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">{t('notifications.warehouse')}</Label>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-900" data-testid="select-warehouse">
                  <SelectValue placeholder={t('notifications.warehouse_2')} />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id} className="text-slate-800 hover:bg-slate-100">
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
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
            >
              {t('notifications.cancel')}
            </Button>
            <Button
              onClick={handleConfirmApprove}
              disabled={!selectedWarehouseId || approveMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              data-testid="button-confirm-approve"
            >
              {t('notifications.confirm_approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">{t('notifications.reject_request_inventory')}</DialogTitle>
            <DialogDescription className="text-slate-500">{t('notifications.submit_reason_reject')}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              placeholder={t('notifications.reason_reject_3')}
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 min-h-[100px]"
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
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
            >
              {t('notifications.cancel')}
            </Button>
            <Button
              onClick={handleConfirmReject}
              disabled={!adminNotes.trim() || rejectMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              data-testid="button-confirm-reject"
            >
              {t('notifications.confirm_reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deviceActionDialogOpen} onOpenChange={setDeviceActionDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              {deviceActionType === "approve" ? t('notifications.request_withdraw_device') : t('notifications.reject_request_withdraw_device')}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {deviceActionType === "approve"
                ? t('notifications.request_1')
                : t('notifications.submit_reason_reject_followup')}
            </DialogDescription>
          </DialogHeader>

          {selectedDeviceRequest && (
            <div className="py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-500">{t('notifications.device')}</p>
              <p className="text-slate-900 font-bold">
                {selectedDeviceRequest.terminalId} • {selectedDeviceRequest.serialNumber}
              </p>
            </div>
          )}

          <div className="py-2">
            <Textarea
              value={deviceAdminNotes}
              onChange={(event) => setDeviceAdminNotes(event.target.value)}
              placeholder={deviceActionType === "approve" ? t('notifications.notes') : t('notifications.reason_reject_3')}
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 min-h-[100px]"
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
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
            >
              {t('notifications.cancel')}
            </Button>
            <Button
              onClick={handleConfirmDeviceAction}
              disabled={
                reviewDeviceStatusMutation.isPending ||
                (deviceActionType === "reject" && !deviceAdminNotes.trim())
              }
              className={
                deviceActionType === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  : "bg-rose-600 hover:bg-rose-700 text-white font-bold"
              }
              data-testid="button-confirm-device-action"
            >
              {reviewDeviceStatusMutation.isPending ? t('notifications.save') : t('notifications.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={techApproveDialogOpen} onOpenChange={setTechApproveDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">{t('notifications.approve_request')}</DialogTitle>
            <DialogDescription className="text-slate-500">
              {t('notifications.add')}
            </DialogDescription>
          </DialogHeader>

          {selectedBatch && (
            <div className="py-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-500 mb-1">{t('notifications.warehouse_1')}</p>
              <p className="text-slate-900 font-bold">{selectedBatch.warehouseName}</p>
              <p className="text-xs text-slate-500 mt-2">{t('notifications.item_15970')}{selectedBatch.transfers.length}</p>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setTechApproveDialogOpen(false)}
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
            >
              {t('notifications.cancel')}
            </Button>
            <Button
              onClick={handleTechConfirmApprove}
              disabled={techApproveBatchMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              data-testid="button-tech-confirm-approve"
            >
              {t('notifications.confirm_approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={techRejectDialogOpen} onOpenChange={setTechRejectDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">{t('notifications.reject_request')}</DialogTitle>
            <DialogDescription className="text-slate-500">{t('notifications.submit_reason_reject')}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              value={techRejectionReason}
              onChange={(event) => setTechRejectionReason(event.target.value)}
              placeholder={t('notifications.reason_reject_3')}
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 min-h-[100px]"
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
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
            >
              {t('notifications.cancel')}
            </Button>
            <Button
              onClick={handleTechConfirmReject}
              disabled={!techRejectionReason.trim() || techRejectBatchMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              data-testid="button-tech-confirm-reject"
            >
              {t('notifications.confirm_reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkApproveDialogOpen} onOpenChange={setBulkApproveDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">{t('notifications.approve_requests')}</DialogTitle>
            <DialogDescription className="text-slate-500">
              {t('notifications.accept_batch_confirm', { count: selectedBatchIds.length })}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkApproveDialogOpen(false)}
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
            >
              {t('notifications.cancel')}
            </Button>
            <Button
              onClick={() => bulkApproveMutation.mutate(selectedBatchIds)}
              disabled={bulkApproveMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              data-testid="button-confirm-bulk-approve"
            >
              {bulkApproveMutation.isPending ? t('notifications.approve') : t('notifications.confirm_approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkRejectDialogOpen} onOpenChange={setBulkRejectDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">{t('notifications.reject_requests')}</DialogTitle>
            <DialogDescription className="text-slate-500">
              {t('notifications.reject_batch_reason_prompt', { count: selectedBatchIds.length })}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              value={bulkRejectionReason}
              onChange={(event) => setBulkRejectionReason(event.target.value)}
              placeholder={t('notifications.reason_reject_3')}
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 min-h-[100px]"
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
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
            >
              {t('notifications.cancel')}
            </Button>
            <Button
              onClick={handleConfirmBulkReject}
              disabled={!bulkRejectionReason.trim() || bulkRejectMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              data-testid="button-confirm-bulk-reject"
            >
              {t('notifications.confirm_reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

