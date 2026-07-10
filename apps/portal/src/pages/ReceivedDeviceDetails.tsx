import { useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { exportReceivedDeviceDetailsToPDF } from "@/features/received-devices/export-received-device-details-pdf";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  ExternalLink,
  FileText,
  Home,
  Image,
  MapPin,
  Package,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  Truck,
  User,
  Warehouse,
  XCircle,
} from "lucide-react";

type DeviceStatus = "pending" | "approved" | "rejected" | "delivered";

interface ReceivedDevice {
  id: string;
  terminalId: string | null;
  serialNumber: string;
  itemTypeId: string | null;
  inventoryType: 'fixed' | 'moving';
  battery: boolean;
  chargerCable: boolean;
  chargerHead: boolean;
  hasSim: boolean;
  simCardType: string | null;
  damagePart: string | null;
  status: DeviceStatus;
  technicianId: string;
  supervisorId: string | null;
  regionId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface SystemLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  details?: string | null;
  severity: "info" | "warn" | "error";
  userName: string;
  createdAt: string;
}

type TimelineItem = {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  kind: "done" | "active" | "warn" | "neutral";
  action?: string;
  icon: React.ComponentType<{ className?: string }>;
};

type JourneyStage = {
  id: string;
  title: string;
  description: string;
  createdAt: Date | null;
  status: "done" | "active" | "warn" | "pending";
  icon: React.ComponentType<{ className?: string }>;
};

type DeliveryProof = {
  url: string;
  fileName: string;
  source: "log" | "adminNotes";
  createdAt: Date | null;
  uploadedBy?: string;
  isImage: boolean;
  kind: "deliveryProof" | "receiptForm";
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const extractFirstUrlFromText = (value?: string | null): string | null => {
  if (!value) return null;

  const match = value.match(/https?:\/\/[^\s"'<>]+|\/(?:uploads?|files?|attachments?|storage|public)[^\s"'<>]*/i);
  if (!match?.[0]) return null;

  return match[0].replace(/[),.;]+$/g, "").trim();
};

const normalizeUrl = (url: string): string => {
  if (/^https?:\/\//i.test(url)) return url;

  if (typeof window === "undefined") return url;

  if (url.startsWith("//")) return `${window.location.protocol}${url}`;
  if (url.startsWith("/")) return `${window.location.origin}${url}`;

  return url;
};

const getFileNameFromUrl = (url: string): string => {
  try {
    const cleanUrl = url.split("?")[0].split("#")[0];
    const name = decodeURIComponent(cleanUrl.split("/").pop() || "");
    return name || "ملف التسليم";
  } catch {
    return "ملف التسليم";
  }
};

const isImageFileUrl = (url: string): boolean => {
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)(\?|#|$)/i.test(url);
};

const isPdfFileUrl = (url: string): boolean => {
  return /\.pdf(\?|#|$)/i.test(url);
};

const extractUrlFromLogDetails = (details?: string | null): string | null => {
  if (!details) return null;

  const urlFromRaw = extractFirstUrlFromText(details);
  if (urlFromRaw) return urlFromRaw;

  try {
    const parsed = JSON.parse(details);
    const queue: unknown[] = [parsed];
    const urlKeys = new Set([
      "url",
      "fileurl",
      "filepath",
      "deliveryfileurl",
      "deliveryproofurl",
      "receiptformfileurl",
      "receiptformurl",
      "signedreceiptformurl",
      "paperreceipturl",
      "attachmenturl",
      "proofurl",
      "documenturl",
      "imageurl",
    ]);

    while (queue.length) {
      const current = queue.shift();

      if (typeof current === "string") {
        const candidate = extractFirstUrlFromText(current);
        if (candidate) return candidate;
        continue;
      }

      if (!current || typeof current !== "object") {
        continue;
      }

      if (Array.isArray(current)) {
        queue.push(...current);
        continue;
      }

      for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
        if (typeof value === "string") {
          if (urlKeys.has(key.toLowerCase().trim()) && value.trim()) {
            const directUrl = extractFirstUrlFromText(value.trim()) || (/^(https?:\/\/|\/)/i.test(value.trim()) ? value.trim() : null);
            if (directUrl) return directUrl;
          }

          const candidate = extractFirstUrlFromText(value);
          if (candidate) return candidate;
        } else if (value && typeof value === "object") {
          queue.push(value);
        }
      }
    }
  } catch {
    return null;
  }

  return null;
};

const extractStringFieldFromLogDetails = (details: string | null | undefined, keys: string[]): string | null => {
  if (!details) return null;

  try {
    const parsed = JSON.parse(details);
    const queue: unknown[] = [parsed];
    const keySet = new Set(keys.map((key) => key.toLowerCase().trim()));

    while (queue.length) {
      const current = queue.shift();

      if (!current || typeof current !== "object") {
        continue;
      }

      if (Array.isArray(current)) {
        queue.push(...current);
        continue;
      }

      for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
        if (typeof value === "string") {
          if (keySet.has(key.toLowerCase().trim()) && value.trim()) {
            return value.trim();
          }
        } else if (value && typeof value === "object") {
          queue.push(value);
        }
      }
    }
  } catch {
    return null;
  }

  return null;
};

const extractUrlFieldFromLogDetails = (details: string | null | undefined, keys: string[]): string | null => {
  const value = extractStringFieldFromLogDetails(details, keys);
  if (!value) return null;

  return extractFirstUrlFromText(value) || (/^(https?:\/\/|\/)/i.test(value) ? value : null);
};

const stageStatusConfig: Record<JourneyStage["status"], { text: string; badgeClass: string; cardClass: string }> = {
  done: {
    text: "مكتملة",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    cardClass: "border-emerald-500/25 bg-emerald-500/5",
  },
  active: {
    text: "جارية",
    badgeClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    cardClass: "border-cyan-500/25 bg-cyan-500/5",
  },
  warn: {
    text: "متوقفة",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    cardClass: "border-rose-500/25 bg-rose-500/5",
  },
  pending: {
    text: "بانتظار التنفيذ",
    badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    cardClass: "border-white/10 bg-slate-800/40",
  },
};

const statusConfig: Record<
  DeviceStatus,
  { text: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    text: "قيد المراجعة",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: Clock,
  },
  approved: {
    text: "موافق عليه",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: CheckCircle2,
  },
  rejected: {
    text: "مرفوض",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    icon: XCircle,
  },
  delivered: {
    text: "تم التسليم",
    badgeClass: "bg-teal-500/15 text-teal-300 border-teal-500/30",
    icon: Sparkles,
  },
};

export default function ReceivedDeviceDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [deliveryPreviewOpen, setDeliveryPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<DeliveryProof | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const { data: device, isLoading } = useQuery<ReceivedDevice>({
    queryKey: [id ? `/api/received-devices/${id}` : ""],
    enabled: !!id,
  });

  const { data: itemTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/item-types"],
  });

  const { data: logs = [] } = useQuery<SystemLogEntry[]>({
    queryKey: [id ? `/api/system-logs?entityType=device&entityId=${id}&limit=50` : ""],
    enabled: !!id,
  });

  const itemType = itemTypes.find(t => t.id === device?.itemTypeId);
  const itemName = itemType?.nameAr ?? device?.terminalId ?? "منتج غير معروف";

  const deliveryProof = useMemo<DeliveryProof | null>(() => {
    const deliveryLog = logs.find((log) => {
      const action = String(log.action || "").toLowerCase();
      const text = `${log.description || ""} ${log.details || ""}`.toLowerCase();
      const hasDeliveryHint =
        action.includes("deliver") ||
        action.includes("handover") ||
        action.includes("approve") ||
        text.includes("تسليم") ||
        text.includes("delivery") ||
        text.includes("عميل");

      return hasDeliveryHint && !!extractUrlFromLogDetails(log.details || log.description);
    });

    if (deliveryLog) {
      const foundUrl = extractUrlFromLogDetails(deliveryLog.details || deliveryLog.description);
      if (foundUrl) {
        const normalizedUrl = normalizeUrl(foundUrl);
        return {
          url: normalizedUrl,
          fileName: getFileNameFromUrl(normalizedUrl),
          source: "log",
          createdAt: new Date(deliveryLog.createdAt),
          uploadedBy: deliveryLog.userName,
          isImage: isImageFileUrl(normalizedUrl),
          kind: "deliveryProof",
        };
      }
    }

    const notesUrl = extractFirstUrlFromText(device?.adminNotes || "");
    if (notesUrl) {
      const normalizedUrl = normalizeUrl(notesUrl);
      return {
        url: normalizedUrl,
        fileName: getFileNameFromUrl(normalizedUrl),
        source: "adminNotes",
        createdAt: device?.updatedAt ? new Date(device.updatedAt) : null,
        isImage: isImageFileUrl(normalizedUrl),
        kind: "deliveryProof",
      };
    }

    return null;
  }, [device?.adminNotes, device?.updatedAt, logs]);

  const receiptFormProof = useMemo<DeliveryProof | null>(() => {
    const deliveryProofLogs = logs
      .filter((log) => String(log.action || "").toLowerCase() === "delivery_proof")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (const log of deliveryProofLogs) {
      const receiptFormUrl = extractUrlFieldFromLogDetails(log.details, [
        "receiptFormFileUrl",
        "receiptFormUrl",
        "signedReceiptFormUrl",
        "paperReceiptUrl",
        "paperFormUrl",
      ]);

      if (!receiptFormUrl) continue;

      const normalizedUrl = normalizeUrl(receiptFormUrl);
      const explicitName = extractStringFieldFromLogDetails(log.details, [
        "receiptFormFileName",
        "receiptFormName",
        "paperReceiptName",
      ]);

      return {
        url: normalizedUrl,
        fileName: explicitName || getFileNameFromUrl(normalizedUrl),
        source: "log",
        createdAt: new Date(log.createdAt),
        uploadedBy: log.userName,
        isImage: isImageFileUrl(normalizedUrl),
        kind: "receiptForm",
      };
    }

    return null;
  }, [logs]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ status, notes }: { status: DeviceStatus; notes: string }) =>
      apiRequest("PATCH", `/api/received-devices/${id}/status`, { status, adminNotes: notes }),
    onSuccess: () => {
      toast({
        title: actionType === "approve" ? "تمت الموافقة" : "تم الرفض",
        description:
          actionType === "approve"
            ? "تم قبول الجهاز وتحديث رحلة الحالة"
            : "تم رفض الجهاز وتحديث رحلة الحالة",
      });

      setActionDialogOpen(false);
      setActionType(null);
      setAdminNotes("");

      queryClient.invalidateQueries({ queryKey: [id ? `/api/received-devices/${id}` : ""] });
      queryClient.invalidateQueries({ queryKey: [id ? `/api/system-logs?entityType=device&entityId=${id}&limit=50` : ""] });
      queryClient.invalidateQueries({ queryKey: ["/api/received-devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/received-devices/pending/count"] });
    },
    onError: (error: any) => {
      toast({
        title: "تعذر تحديث الحالة",
        description: error?.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    },
  });

  const timelineItems = useMemo(() => {
    const mappedFromLogs: TimelineItem[] = logs
      .map((log) => {
        const action = String(log.action || "").toLowerCase();

        if (action === "delivery_proof") {
          return {
            id: log.id,
            title: "تم رفع إثبات التسليم من تطبيق المندوب",
            description: log.description,
            createdAt: new Date(log.createdAt),
            kind: (device?.status === "approved" || device?.status === "delivered" ? "done" : "active") as TimelineItem["kind"],
            action,
            icon: Smartphone,
          };
        }

        if (action === "approve") {
          return {
            id: log.id,
            title: "تم تسليم الجهاز للعميل",
            description: log.description,
            createdAt: new Date(log.createdAt),
            kind: "done" as const,
            action,
            icon: CheckCircle2,
          };
        }

        if (action === "reject") {
          return {
            id: log.id,
            title: "تعذر تسليم الجهاز",
            description: log.description,
            createdAt: new Date(log.createdAt),
            kind: "warn" as const,
            action,
            icon: XCircle,
          };
        }

        if (action === "create") {
          return {
            id: log.id,
            title: "تم استلام الجهاز من المصدر",
            description: log.description,
            createdAt: new Date(log.createdAt),
            kind: "active" as const,
            action,
            icon: Package,
          };
        }

        return {
          id: log.id,
          title: "تحديث في رحلة الجهاز",
          description: log.description,
          createdAt: new Date(log.createdAt),
          kind: (log.severity === "error" ? "warn" : "neutral") as TimelineItem["kind"],
          action,
          icon: Truck,
        };
      })
      .filter((item) => !Number.isNaN(item.createdAt.getTime()));

    if (mappedFromLogs.length > 0) {
      return mappedFromLogs;
    }

    if (!device) {
      return [] as TimelineItem[];
    }

    const fallback: TimelineItem[] = [
      {
        id: `create-${device.id}`,
        title: "تم تسجيل الاستلام",
        description: `تم إدخال الجهاز (${device.serialNumber}) في النظام بانتظار المراجعة.`,
        createdAt: new Date(device.createdAt),
        kind: "active",
        icon: Package,
      },
    ];

    if (device.status === "approved" && device.approvedAt) {
      fallback.unshift({
        id: `approved-${device.id}`,
        title: "تم تسليم الجهاز",
        description: "تمت الموافقة على الجهاز واعتماده في الرحلة التشغيلية.",
        createdAt: new Date(device.approvedAt),
        kind: "done",
        icon: CheckCircle2,
      });
    }

    if (device.status === "rejected" && device.approvedAt) {
      fallback.unshift({
        id: `rejected-${device.id}`,
        title: "تم رفض الاستلام",
        description: device.adminNotes || "تم رفض الجهاز بعد المراجعة.",
        createdAt: new Date(device.approvedAt),
        kind: "warn",
        icon: XCircle,
      });
    }

    return fallback;
  }, [device, logs]);

  const filteredTimeline = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return timelineItems;

    return timelineItems.filter((item) => {
      return (
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        formatDate(item.createdAt.toISOString()).toLowerCase().includes(term)
      );
    });
  }, [timelineItems, searchTerm]);

  const journeyStages = useMemo<JourneyStage[]>(() => {
    if (!device) return [];

    const createLog = logs.find((log) => String(log.action || "").toLowerCase() === "create");
    const deliveryProofLog = logs.find((log) => String(log.action || "").toLowerCase() === "delivery_proof");
    const warehouseLog = logs.find((log) => {
      const action = String(log.action || "").toLowerCase();
      const text = String(log.description || "").toLowerCase();
      return (
        action.includes("warehouse") ||
        action.includes("store") ||
        text.includes("مستودع") ||
        text.includes("مخزن")
      );
    });
    const technicianLog = logs.find((log) => {
      const action = String(log.action || "").toLowerCase();
      const text = String(log.description || "").toLowerCase();
      return (
        action.includes("technician") ||
        action.includes("assign") ||
        action.includes("handover") ||
        text.includes("مندوب") ||
        text.includes("عهدة")
      );
    });

    const receivedAt = createLog?.createdAt ? new Date(createLog.createdAt) : new Date(device.createdAt);
    const storageAt = warehouseLog?.createdAt
      ? new Date(warehouseLog.createdAt)
      : receivedAt;
    const technicianAt = technicianLog?.createdAt
      ? new Date(technicianLog.createdAt)
      : device.updatedAt
        ? new Date(device.updatedAt)
        : receivedAt;

    const deliveryAt = device.approvedAt
      ? new Date(device.approvedAt)
      : deliveryProof?.createdAt || null;

    const deliveryStatus: JourneyStage["status"] =
      device.status === "approved" || device.status === "delivered"
        ? "done"
        : device.status === "rejected"
          ? "warn"
          : deliveryProof
            ? "active"
            : "pending";

    const stages: JourneyStage[] = [
      {
        id: "source",
        title: "استلام من المصدر",
        description: "تم استلام الجهاز من المصدر وتسجيله في النظام.",
        createdAt: receivedAt,
        status: "done",
        icon: MapPin,
      },
    ];

    if (warehouseLog || device.regionId) {
      stages.push({
        id: "storage",
        title: "إيداع في المستودع",
        description: "تمت إضافة الجهاز إلى مسار التخزين بالمستودع.",
        createdAt: storageAt,
        status: warehouseLog ? "done" : "active",
        icon: Warehouse,
      });
    }

    if (device.technicianId || technicianLog) {
      stages.push({
        id: "technician",
        title: "بعهدة المندوب",
        description: device.technicianId
          ? "الجهاز أصبح ضمن عهدة المندوب المسؤول عن عملية التسليم."
          : "تم رصد مرحلة مندوبة على الجهاز.",
        createdAt: device.technicianId || technicianLog ? technicianAt : null,
        status: device.technicianId ? "done" : "active",
        icon: User,
      });
    }

    if (deliveryProof || receiptFormProof || deliveryProofLog) {
      stages.push({
        id: "delivery-proof",
        title: "رفع ملف التسليم",
        description: "تم رفع ملف التسليم/فرم الاستلام الموقّع من تطبيق المندوب وإرساله للمشرف للمراجعة.",
        createdAt: deliveryProof?.createdAt || receiptFormProof?.createdAt || new Date(deliveryProofLog?.createdAt || Date.now()),
        status: device.status === "approved" || device.status === "delivered" ? "done" : "active",
        icon: FileText,
      });
    }

    stages.push({
      id: "delivery",
      title: "تسليم العميل",
      description:
        device.status === "approved" || device.status === "delivered"
          ? "تم تسليم الجهاز للعميل واعتماد العملية."
          : device.status === "rejected"
            ? "تم إيقاف التسليم بعد المراجعة."
            : deliveryProof || receiptFormProof
              ? "تم رفع ملف التسليم من تطبيق المندوب وبانتظار الاعتماد النهائي."
              : "الجهاز بانتظار إتمام التسليم للعميل.",
      createdAt: deliveryAt,
      status: deliveryStatus,
      icon: Home,
    });

    const knownActions = new Set(["create", "approve", "reject", "delivery_proof"]);
    const additionalOperationalStages: JourneyStage[] = logs
      .filter((log) => {
        const action = String(log.action || "").toLowerCase();
        return action && !knownActions.has(action);
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, 2)
      .map((log, index) => ({
        id: `extra-${log.id}`,
        title: `مرحلة تشغيل إضافية ${index + 1}`,
        description: log.description || `إجراء مسجل: ${log.action}`,
        createdAt: new Date(log.createdAt),
        status: (log.severity === "error" ? "warn" : "done") as JourneyStage["status"],
        icon: Package,
      }));

    return [...stages, ...additionalOperationalStages];
  }, [deliveryProof, receiptFormProof, device, logs]);

  const handleAction = (action: "approve" | "reject") => {
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = () => {
    if (!actionType) return;

    updateStatusMutation.mutate({
      status: actionType === "approve" ? "approved" : "rejected",
      notes: adminNotes,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-300 gap-3">
        <Clock className="h-5 w-5 animate-spin" />
        <span>جاري تحميل رحلة الجهاز...</span>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center">
        <XCircle className="h-10 w-10 text-rose-400" />
        <p className="text-slate-300">لم يتم العثور على الجهاز المطلوب.</p>
        <Button onClick={() => setLocation("/received-devices/review")} className="bg-cyan-600 hover:bg-cyan-500">
          العودة لقائمة الأجهزة
        </Button>
      </div>
    );
  }

  const status = statusConfig[device.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const primaryPreviewFile = previewFile || deliveryProof || receiptFormProof || null;

  const handleExportPdf = async () => {
    if (!device || isExportingPdf) return;

    setIsExportingPdf(true);

    try {
      await exportReceivedDeviceDetailsToPDF({
        device: device as any,
        statusText: status.text,
        journeyStages,
        timeline: timelineItems,
        deliveryProof: deliveryProof || receiptFormProof,
      });

      toast({
        title: "تم إنشاء الملف بنجاح",
        description: "تم تنزيل تقرير PDF مرتب لرحلة الجهاز.",
      });
    } catch (error: any) {
      toast({
        title: "تعذر إنشاء ملف PDF",
        description: error?.message || "حدث خطأ أثناء تجهيز التقرير",
        variant: "destructive",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto space-y-6">
        <header className="h-20 border border-white/10 bg-slate-900/60 backdrop-blur-xl rounded-2xl flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white tracking-tight">رحلة {itemName}</h1>
            <div className="h-6 w-px bg-white/10" />
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                dir="ltr"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="بحث برقم التسلسل أو الحالة..."
                className="w-72 pr-9 bg-black/20 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge className={`border ${status.badgeClass} px-4 py-2 text-sm font-semibold flex items-center gap-2`}>
              <StatusIcon className="h-4 w-4" />
              {status.text}
            </Badge>
            <Button
              variant="outline"
              className="border-white/15 bg-white/5 hover:bg-white/10 text-white"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
            >
              <FileText className="h-4 w-4 ml-2" />
              {isExportingPdf ? "جاري إنشاء الملف..." : "تصدير PDF"}
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <article className="bg-slate-800/60 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400">اسم المنتج / رقم الجهاز</p>
            <p className="text-white font-bold mt-1">{itemName}</p>
          </article>
          <article className="bg-slate-800/60 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400">السيريال</p>
            <p className="text-cyan-300 font-mono font-bold mt-1">{device.serialNumber}</p>
          </article>
          <article className="bg-slate-800/60 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400">نوع المخزون المستهدف</p>
            <p className="text-white font-bold mt-1">{device.inventoryType === 'moving' ? "متحرك (سيارة)" : "ثابت (مستودع)"}</p>
          </article>
          <article className="bg-slate-800/60 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400">تاريخ الإدخال</p>
            <p className="text-white font-bold mt-1">{formatDate(device.createdAt)}</p>
          </article>
        </section>

        <section className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">مراحل التتبع من المصدر إلى العميل</h3>
            </div>
            <span className="text-xs text-slate-400">{journeyStages.length} مرحلة تشغيلية حسب البيانات</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {journeyStages.map((stage) => {
              const Icon = stage.icon;
              const stageConfig = stageStatusConfig[stage.status];

              return (
                <article
                  key={stage.id}
                  className={`rounded-xl border p-4 ${stageConfig.cardClass}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="h-10 w-10 rounded-lg border border-white/10 bg-black/25 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-cyan-300" />
                    </div>
                    <Badge className={`border ${stageConfig.badgeClass}`}>
                      {stageConfig.text}
                    </Badge>
                  </div>

                  <h4 className="font-semibold text-white mb-2">{stage.title}</h4>
                  <p className="text-sm text-slate-300 leading-relaxed min-h-[48px]">{stage.description}</p>
                  <p className="text-xs text-slate-400 mt-3 font-mono">
                    {stage.createdAt
                      ? `${formatDate(stage.createdAt.toISOString())} - ${formatTime(stage.createdAt.toISOString())}`
                      : "لا يوجد توقيت مسجل"}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-cyan-400" />
              <h3 className="text-xl font-bold text-white">سجل الرحلة التاريخي</h3>
            </div>
            <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(13,185,242,0.8)]" />
              <span className="text-slate-400 text-xs font-mono">{filteredTimeline.length} مسارات مسجلة</span>
            </div>
          </div>

          <div className="relative pr-10 max-h-[60vh] overflow-y-auto">
            <div className="absolute right-4 top-4 bottom-0 w-[2px] bg-gradient-to-b from-cyan-400/80 via-white/10 to-orange-400/80 shadow-[0_0_8px_rgba(13,185,242,0.4)]" />

            {filteredTimeline.length === 0 ? (
              <div className="text-center text-slate-400 py-16">لا توجد مراحل مطابقة في الرحلة.</div>
            ) : (
              filteredTimeline.map((item) => {
                const Icon = item.icon;
                const isDeliveryRelated =
                  item.action === "delivery_proof" || item.action === "approve" || item.title.includes("تسليم");

                const dotClass =
                  item.kind === "done"
                    ? "border-emerald-400 text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                    : item.kind === "warn"
                      ? "border-rose-400 text-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.35)]"
                      : item.kind === "active"
                        ? "border-cyan-400 text-cyan-400 shadow-[0_0_18px_rgba(13,185,242,0.35)]"
                        : "border-white/30 text-slate-300";

                const cardClass =
                  item.kind === "done"
                    ? "border-emerald-400/30"
                    : item.kind === "warn"
                      ? "border-rose-400/30"
                      : item.kind === "active"
                        ? "border-cyan-400/30"
                        : "border-white/10";

                return (
                  <div key={item.id} className="relative mb-7 group">
                    <div className={`absolute right-[-6px] top-4 w-10 h-10 rounded-full bg-slate-950 border-2 flex items-center justify-center z-10 ${dotClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className={`mr-10 bg-slate-800/60 border ${cardClass} rounded-xl p-5 transition-all group-hover:bg-slate-800/80`}>
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-lg font-bold text-white">{item.title}</h4>
                        <div className="text-left">
                          <div className="text-sm text-white font-mono bg-black/40 px-2.5 py-1 rounded border border-white/10">
                            {formatDate(item.createdAt.toISOString())}
                          </div>
                          <div className="text-xs text-slate-400 mt-1 font-mono">
                            {formatTime(item.createdAt.toISOString())}
                          </div>
                        </div>
                      </div>

                      <p className="text-slate-300 text-sm leading-relaxed">{item.description}</p>

                      {isDeliveryRelated && (
                        <div className="mt-4 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (deliveryProof || receiptFormProof) {
                                setPreviewFile(deliveryProof || receiptFormProof);
                                setDeliveryPreviewOpen(true);
                                return;
                              }

                              toast({
                                title: "لا يوجد ملف تسليم",
                                description: "لم يتم رفع ملف تسليم أو فرم استلام ورقي من تطبيق المندوب لهذا الجهاز بعد.",
                              });
                            }}
                            className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
                          >
                            <Eye className="h-4 w-4 ml-1" />
                            {deliveryProof || receiptFormProof ? "استعراض ملف التسليم" : "لا يوجد ملف تسليم"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-300" />
              <h3 className="text-lg font-bold text-white">ملفات التسليم المرفوعة من المندوب</h3>
            </div>
            {(deliveryProof || receiptFormProof) && (
              <Badge className="border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
                {(deliveryProof ? 1 : 0) + (receiptFormProof ? 1 : 0)} ملف
              </Badge>
            )}
          </div>

          {deliveryProof || receiptFormProof ? (
            <div className="space-y-4">
              {deliveryProof && (
                <div className="bg-slate-800/60 border border-cyan-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center">
                      {deliveryProof.isImage ? <Image className="h-5 w-5 text-cyan-300" /> : <FileText className="h-5 w-5 text-cyan-300" />}
                    </div>
                    <div>
                      <p className="text-sm text-slate-200 font-semibold">{deliveryProof.fileName}</p>
                      <p className="text-xs text-cyan-200/80 mt-0.5">
                        {deliveryProof.isImage ? "صورة تسليم" : isPdfFileUrl(deliveryProof.url) ? "ملف PDF" : "ملف مرفق"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400 space-y-1">
                    <p>
                      تاريخ الرفع: {deliveryProof.createdAt ? `${formatDate(deliveryProof.createdAt.toISOString())} - ${formatTime(deliveryProof.createdAt.toISOString())}` : "غير متوفر"}
                    </p>
                    {deliveryProof.uploadedBy && <p>تم الرفع بواسطة: {deliveryProof.uploadedBy}</p>}
                    <p>المصدر: {deliveryProof.source === "log" ? "سجل العمليات" : "ملاحظات المشرف"}</p>
                  </div>
                  <div className="mt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => {
                          setPreviewFile(deliveryProof);
                          setDeliveryPreviewOpen(true);
                        }}
                        className="h-9 bg-cyan-600 hover:bg-cyan-500 text-white"
                      >
                        <Eye className="h-4 w-4 ml-1" />
                        استعراض
                      </Button>

                      <a
                        href={deliveryProof.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
                      >
                        <ExternalLink className="h-4 w-4" />
                        فتح ملف التسليم
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {receiptFormProof && (
                <div className="bg-slate-800/60 border border-amber-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-center">
                      {receiptFormProof.isImage ? <Image className="h-5 w-5 text-amber-300" /> : <FileText className="h-5 w-5 text-amber-300" />}
                    </div>
                    <div>
                      <p className="text-sm text-slate-200 font-semibold">{receiptFormProof.fileName}</p>
                      <p className="text-xs text-amber-200/80 mt-0.5">فرم الاستلام الورقي الموقّع</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400 space-y-1">
                    <p>
                      تاريخ الرفع: {receiptFormProof.createdAt ? `${formatDate(receiptFormProof.createdAt.toISOString())} - ${formatTime(receiptFormProof.createdAt.toISOString())}` : "غير متوفر"}
                    </p>
                    {receiptFormProof.uploadedBy && <p>تم الرفع بواسطة: {receiptFormProof.uploadedBy}</p>}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        setPreviewFile(receiptFormProof);
                        setDeliveryPreviewOpen(true);
                      }}
                      className="h-9 bg-amber-600 hover:bg-amber-500 text-white"
                    >
                      <Eye className="h-4 w-4 ml-1" />
                      استعراض الفرم
                    </Button>
                    <a
                      href={receiptFormProof.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
                    >
                      <ExternalLink className="h-4 w-4" />
                      فتح فرم الاستلام
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-800/40 border border-white/10 rounded-xl p-4 text-slate-300 text-sm">
              لا يوجد حالياً ملف تسليم مرفوع لهذا الجهاز. سيظهر هنا تلقائياً عند توفر رابط الملف في سجل العمليات أو الملاحظات، بما يشمل فرم الاستلام الورقي الموقّع.
            </div>
          )}
        </section>

        {device.status === "pending" && (user?.role === "supervisor" || user?.role === "admin") && (
          <section className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row gap-4">
            <Button
              onClick={() => handleAction("approve")}
              className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <CheckCircle2 className="h-5 w-5 ml-2" />
              موافقة على التسجيل
            </Button>
            <Button
              onClick={() => handleAction("reject")}
              variant="destructive"
              className="flex-1 h-12"
            >
              <XCircle className="h-5 w-5 ml-2" />
              رفض التسجيل
            </Button>
            <Button variant="outline" className="h-12 border-white/15 bg-white/5 text-white" onClick={() => setLocation("/received-devices/review")}>
              <ArrowLeft className="h-4 w-4 ml-2" />
              العودة للقائمة
            </Button>
          </section>
        )}

        {(!device.itemTypeId || itemType?.category === 'devices') && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`rounded-xl border p-3 ${device.battery ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-slate-800/40"}`}>
              <div className="flex items-center justify-between text-sm">
                <span>البطارية</span>
                {device.battery ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-slate-500" />}
              </div>
            </div>
            <div className={`rounded-xl border p-3 ${device.chargerCable ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-slate-800/40"}`}>
              <div className="flex items-center justify-between text-sm">
                <span>كابل الشاحن</span>
                {device.chargerCable ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-slate-500" />}
              </div>
            </div>
            <div className={`rounded-xl border p-3 ${device.chargerHead ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-slate-800/40"}`}>
              <div className="flex items-center justify-between text-sm">
                <span>رأس الشاحن</span>
                {device.chargerHead ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-slate-500" />}
              </div>
            </div>
            <div className={`rounded-xl border p-3 ${device.hasSim ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-slate-800/40"}`}>
              <div className="flex items-center justify-between text-sm">
                <span>{device.simCardType || "شريحة SIM"}</span>
                {device.hasSim ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-slate-500" />}
              </div>
            </div>
          </section>
        )}

        {(device.adminNotes || device.damagePart) && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {device.damagePart && (
              <article className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <h4 className="font-semibold text-amber-300 mb-2">معلومات الأضرار</h4>
                <p className="text-amber-100 text-sm whitespace-pre-wrap">{device.damagePart}</p>
              </article>
            )}
            {device.adminNotes && (
              <article className="bg-slate-800/60 border border-white/10 rounded-xl p-4">
                <h4 className="font-semibold text-cyan-300 mb-2">ملاحظات المشرف</h4>
                <p className="text-slate-200 text-sm whitespace-pre-wrap">{device.adminNotes}</p>
              </article>
            )}
          </section>
        )}
      </div>

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {actionType === "approve" ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-rose-400" />}
              {actionType === "approve" ? "تأكيد الموافقة" : "تأكيد الرفض"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {device.terminalId} - {device.serialNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="notes" className="text-slate-300">
              ملاحظات {actionType === "reject" ? "(مطلوبة)" : "(اختيارية)"}
            </Label>
            <Textarea
              id="notes"
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              placeholder="أضف ملاحظات حول القرار..."
              className="min-h-[120px] bg-slate-800/50 border-white/15 text-slate-100"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-white/15 bg-white/5 text-slate-100" onClick={() => setActionDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={confirmAction}
              disabled={updateStatusMutation.isPending || (actionType === "reject" && !adminNotes.trim())}
              className={actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"}
            >
              {updateStatusMutation.isPending ? "جاري الحفظ..." : "تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deliveryPreviewOpen}
        onOpenChange={(open) => {
          setDeliveryPreviewOpen(open);
          if (!open) {
            setPreviewFile(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-cyan-300" />
              استعراض بيانات التسليم
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {primaryPreviewFile?.fileName || "ملف التسليم"}
            </DialogDescription>
          </DialogHeader>

          {primaryPreviewFile ? (
            <div className="space-y-3">
              {primaryPreviewFile.isImage ? (
                <div className="bg-black/30 border border-white/10 rounded-lg p-2">
                  <img
                    src={primaryPreviewFile.url}
                    alt="صورة التسليم"
                    className="w-full max-h-[70vh] object-contain rounded"
                  />
                </div>
              ) : isPdfFileUrl(primaryPreviewFile.url) ? (
                <div className="bg-black/30 border border-white/10 rounded-lg overflow-hidden">
                  <iframe
                    src={primaryPreviewFile.url}
                    title="ملف PDF للتسليم"
                    className="w-full h-[70vh]"
                  />
                </div>
              ) : (
                <div className="bg-slate-800/50 border border-white/10 rounded-lg p-4 text-slate-300 text-sm">
                  هذا النوع من الملفات لا يدعم المعاينة المضمنة حالياً.
                </div>
              )}

              <div className="flex justify-end">
                <a
                  href={primaryPreviewFile.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  فتح في نافذة جديدة
                </a>
              </div>
            </div>
          ) : (
            <div className="text-slate-400 text-sm">لا يوجد ملف تسليم للعرض.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

