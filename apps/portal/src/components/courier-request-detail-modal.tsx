import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Package,
  User,
  MapPin,
  Phone,
  Calendar,
  Hash,
  Cpu,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Edit2,
  ShieldCheck,
  Smartphone,
  Copy,
  Check,
  Building2,
  Tag,
  AlertCircle,
  FileCheck2,
  Layers,
  UserCheck,
  Save,
  History,
  ChevronDown,
  ChevronUp,
  Info,
  Shield,
  Activity,
  ArrowLeftRight,
  RefreshCw,
  Eye,
  Laptop,
  Globe,
  Briefcase,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import rasscoLogoHorizontal from "@/assets/rassco-logo-horizontal.png";

interface RequestDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: number | null;
  onEditClick?: (requestId: number) => void;
}

/** Format dates in Asia/Riyadh timezone */
function formatRiyadhDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("ar-SA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(date);
  } catch (e) {
    return isoString;
  }
}

/** Clean raw name and extract role if formatted as 'Role - Name' */
function cleanPersonName(rawName: string | null | undefined): { name: string; role?: string } {
  if (!rawName) return { name: "مستخدم النظام" };
  let s = rawName.trim();
  if (s.includes(" - ")) {
    const parts = s.split(" - ");
    const rolePart = parts[0].trim();
    const namePart = parts.slice(1).join(" - ").trim();
    if (namePart) {
      let arabicRole = rolePart;
      if (rolePart.toLowerCase().includes("operations supervisor")) arabicRole = "مشرف العمليات";
      else if (rolePart.toLowerCase().includes("technician")) arabicRole = "فني ميداني ومبيعات";
      return { name: namePart, role: arabicRole };
    }
  }
  return { name: s };
}

/** Render user avatar or initial-based fallback */
function UserAvatar({
  url,
  name,
  size = 48,
}: {
  url?: string | null;
  name: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const { name: cleanedName } = cleanPersonName(name);

  // Take the first character of the actual person's name (e.g. "B" from "Basil", "ب" from "باسل")
  const initial = cleanedName ? cleanedName.trim().charAt(0).toUpperCase() : "؟";

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt={cleanedName}
        onError={() => setImgError(true)}
        className="rounded-full object-cover border-2 border-[#18B2B0]/40 shadow-sm shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-gradient-to-br from-[#18B2B0] via-[#0F766E] to-[#115E59] text-white flex items-center justify-center font-extrabold shadow-sm shrink-0 border-2 border-white relative overflow-hidden"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={cleanedName}
    >
      <span>{initial}</span>
    </div>
  );
}

/** Render operation source badge */
function AuditSourceBadge({ source, label }: { source: string; label: string }) {
  let badgeStyle = "bg-gray-100 text-gray-700 border-gray-200";
  let icon = <Globe className="w-3 h-3" />;

  switch (source) {
    case "FIELD_APP":
      badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
      icon = <Smartphone className="w-3 h-3 text-emerald-600" />;
      break;
    case "AUTOMATED_SYSTEM":
      badgeStyle = "bg-purple-50 text-purple-700 border-purple-200";
      icon = <Activity className="w-3 h-3 text-purple-600" />;
      break;
    case "API":
      badgeStyle = "bg-indigo-50 text-indigo-700 border-indigo-200";
      icon = <Globe className="w-3 h-3 text-indigo-600" />;
      break;
    case "IMPORT":
      badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
      icon = <FileText className="w-3 h-3 text-amber-600" />;
      break;
    case "DASHBOARD":
    default:
      badgeStyle = "bg-teal-50 text-teal-800 border-teal-200";
      icon = <Laptop className="w-3 h-3 text-[#18B2B0]" />;
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border shadow-xs ${badgeStyle}`}
    >
      {icon}
      {label || source}
    </span>
  );
}

/** Render operation status badge */
function AuditStatusBadge({ status, label }: { status: string; label: string }) {
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shadow-xs">
        <XCircle className="w-3 h-3 text-red-600" />
        {label || "فاشلة"}
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shadow-xs">
        <Clock className="w-3 h-3 text-amber-600" />
        {label || "معلقة"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shadow-xs">
      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
      {label || "ناجحة"}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0284C7] bg-[#E0F2FE] px-3 py-1 rounded-full border border-[#BAE6FD] shadow-sm">
        <Clock className="w-3.5 h-3.5 text-[#0284C7]" />
        طلب جديد — بانتظار تنفيذ وتسليم الفني
      </span>
    );

  const lower = status.toLowerCase();
  if (lower.includes("completed"))
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#18B2B0] bg-[#18B2B0]/15 px-3 py-1 rounded-full border border-[#18B2B0]/30 shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5" />
        مكتمل التركيب
      </span>
    );

  if (status === "Not Completed")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E05252] bg-[#E05252]/12 px-3 py-1 rounded-full border border-[#E05252]/30 shadow-sm">
        <XCircle className="w-3.5 h-3.5" />
        غير مكتمل
      </span>
    );

  if (status === "Customer Not Answering")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B5563] bg-[#4B5563]/12 px-3 py-1 rounded-full border border-[#4B5563]/25 shadow-sm">
        <Phone className="w-3.5 h-3.5" />
        العميل لا يجيب
      </span>
    );

  if (status === "In Progress")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B45309] bg-[#F4B740]/20 px-3 py-1 rounded-full border border-[#F4B740]/40 shadow-sm">
        <Clock className="w-3.5 h-3.5" />
        قيد التنفيذ
      </span>
    );

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B7280] bg-[#F8FAFC] px-3 py-1 rounded-full border border-[#E2E8F0] shadow-sm">
      <Clock className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}

function CopyableValue({ value, mono = false }: { value?: string | null; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  if (!value || value === "—") return <span className="text-gray-400 font-medium">—</span>;

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 group cursor-pointer"
      onClick={handleCopy}
      title="انقر لنسخ القيمة"
    >
      <span className={`text-[#2D3135] font-semibold text-sm ${mono ? "font-mono text-[#18B2B0]" : ""}`}>
        {value}
      </span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-[#18B2B0]" />
      ) : (
        <Copy className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </span>
  );
}

export function CourierRequestDetailModal({
  open,
  onOpenChange,
  requestId,
  onEditClick,
}: RequestDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [tecSearch, setTecSearch] = useState("");
  const [selectedTec, setSelectedTec] = useState<{ name: string; code: string } | null>(null);

  // Accordion & Audit Detail States
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);

  // Main Request Data Query
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/courier/requests", requestId],
    queryFn: async () => {
      if (!requestId) return null;
      const res = await apiRequest("GET", `/api/courier/requests/${requestId}`);
      return res.json();
    },
    enabled: !!requestId && open,
  });

  // Audit Logs Query
  const {
    data: auditData,
    isLoading: isAuditLoading,
    isError: isAuditError,
    refetch: refetchAudit,
  } = useQuery<any>({
    queryKey: ["/api/courier/requests", requestId, "audit-log", historyPage],
    queryFn: async () => {
      if (!requestId) return null;
      const res = await apiRequest(
        "GET",
        `/api/courier/requests/${requestId}/audit-log?page=${historyPage}&limit=5`
      );
      return res.json();
    },
    enabled: !!requestId && open,
  });

  // Lookups Query
  const { data: lookups } = useQuery<any>({
    queryKey: ["/api/courier/lookups"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/courier/lookups");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const allTechnicians: { id: string; name: string; code: string; regionId: string | null }[] =
    lookups?.technicians ?? [];
  const filteredTechnicians =
    tecSearch.trim().length >= 1
      ? allTechnicians.filter(
          (t) =>
            t.name.toLowerCase().includes(tecSearch.toLowerCase()) ||
            t.code.toLowerCase().includes(tecSearch.toLowerCase())
        )
      : allTechnicians;

  const assignMutation = useMutation({
    mutationFn: async (tecName: string) => {
      const res = await apiRequest("POST", `/api/courier/executions/${requestId}`, {
        salesTechnician: tecName,
        installationStatus: data?.execution?.installationStatus || "In Progress",
        sn: data?.execution?.sn,
        simSerial: data?.execution?.simSerial,
        deliveryDate: data?.execution?.deliveryDate,
        time: data?.execution?.time,
      });
      return res.json();
    },
    onSuccess: (_, tecName) => {
      toast({ title: "تم ربط الفني بنجاح", description: `تم تعيين الفني: ${tecName}` });
      setShowAssignForm(false);
      setTecSearch("");
      setSelectedTec(null);
      queryClient.invalidateQueries({ queryKey: ["/api/courier/requests", requestId] });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/requests", requestId, "audit-log"] });
    },
    onError: () => {
      toast({ title: "فشل الربط", variant: "destructive" });
    },
  });

  const execution = data?.execution;
  const itemsList = data?.items ?? [];
  
  // Compute Effective Latest Audit (with robust fallback for legacy or pre-existing requests)
  const rawLatestAudit = auditData?.latestUpdate;
  let effectiveLatestAudit = rawLatestAudit || (data ? {
    id: data.id || requestId,
    tableName: "requests",
    recordId: data.id || requestId,
    action: "create",
    actionType: "CREATE",
    actionDescription: data.created_by_name
      ? `قام ${cleanPersonName(data.created_by_name).name} بإنشاء وإدراج طلب التركيب المعاملة #${data.tid || data.id} في النظام.`
      : (execution?.salesTechnician || data.tecName)
        ? `قام النظام بجدولة طلب التركيب وتعيين الفني المسؤول ${cleanPersonName(execution?.salesTechnician || data.tecName).name}.`
        : `تم توليد وإنشاء طلب التركيب المعاملة في النظام.`,
    source: data.vendorType ? "IMPORT" : "DASHBOARD",
    sourceLabel: data.vendorType ? "استيراد ملفات" : "لوحة التحكم",
    status: "SUCCESS",
    statusLabel: "ناجحة",
    changedAt: data.createdAt || data.date || new Date().toISOString(),
    actor: {
      id: null,
      name: cleanPersonName(data.created_by_name || execution?.salesTechnician || data.tecName || "النظام الإداري").name,
      role: cleanPersonName(data.created_by_name || execution?.salesTechnician || data.tecName).role || (data.created_by_name ? "مشرف العمليات" : (execution?.salesTechnician || data.tecName ? "فني ميداني ومبيعات" : "النظام الآلي")),
      avatarUrl: data.created_by_avatar || null,
      employeeCode: execution?.technicianCode || data.cityTec || null,
      isHistoricalFallback: false,
      isAutomatedSystem: !data.created_by_name && !execution?.salesTechnician,
    }
  } : null);

  if (effectiveLatestAudit && effectiveLatestAudit.actor?.name) {
    const parsedActor = cleanPersonName(effectiveLatestAudit.actor.name);
    effectiveLatestAudit = {
      ...effectiveLatestAudit,
      actor: {
        ...effectiveLatestAudit.actor,
        name: parsedActor.name,
        role: parsedActor.role || effectiveLatestAudit.actor.role || "مشرف العمليات",
      }
    };
  }

  const historyItems = auditData?.items ?? [];
  const totalAuditLogs = auditData?.total ?? (effectiveLatestAudit ? 1 : 0);

  const responsibleTechName = execution?.salesTechnician || data?.tecName;
  const responsibleTechCode = execution?.technicianCode || data?.cityTec;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border border-[rgba(24,178,176,0.2)] bg-white shadow-2xl dir-rtl font-sans">
        {/* Company Header */}
        <div className="bg-gradient-to-r from-[#18B2B0]/10 via-[#F8FAFC] to-[#18B2B0]/05 p-6 border-b border-[#E2E8F0] relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white border border-[#18B2B0]/30 shadow-md p-1.5 flex items-center justify-center shrink-0">
                <img
                  src={rasscoLogoHorizontal}
                  alt="RASSCO"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#18B2B0]/15 text-[#18B2B0]">
                    نُظم RASSCO | StockPro
                  </span>
                  <span className="text-xs text-gray-400 font-mono">#{data?.id || requestId}</span>
                </div>
                <DialogTitle className="text-xl font-black text-[#2D3135] mt-1 flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#18B2B0]" />
                  طلب التركيب المعاملة: {data?.tid || "—"}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 mt-0.5">
                  عرض تفاصيل معاملة التركيب بالكامل، الأجهزة المسلمة، وتدقيق الفني المسؤول وسجل العمليات.
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={execution?.installationStatus} />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#18B2B0]" />
            <span className="text-sm font-semibold">جاري تحميل البيانات التفصيلية...</span>
          </div>
        ) : !data ? (
          <div className="py-16 text-center text-gray-500 text-sm">لم يتم العثور على بيانات الطلب.</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* ── Responsible Technician Banner ──────────────────────────────── */}
            <div className="rounded-xl border border-[#18B2B0]/25 bg-gradient-to-r from-[#18B2B0]/08 to-transparent p-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    name={responsibleTechName || "فني مسؤول"}
                    size={44}
                  />
                  <div>
                    <div className="text-xs text-[#6B7280] font-semibold flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-[#18B2B0]" />
                      الفني المسؤول عن تنفيذ العملية
                    </div>
                    <div className="text-base font-extrabold text-[#2D3135] flex items-center gap-2 mt-0.5">
                      {responsibleTechName || (
                        <span className="text-amber-600 text-sm font-bold">لم يتم ربط فني بعد</span>
                      )}
                      {responsibleTechCode && (
                        <span className="text-xs font-mono font-bold bg-white text-[#18B2B0] border border-[#18B2B0]/30 px-2 py-0.5 rounded-full">
                          {responsibleTechCode}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 font-semibold mt-0.5">
                      {responsibleTechName ? "فني ميداني ومبيعات معتمد" : "لم يتسجل مسمى وظيفي للفني"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500 flex flex-col items-start sm:items-end">
                    <span className="font-semibold text-gray-700">تاريخ التسليم والرد</span>
                    <span className="font-mono text-[#18B2B0] font-bold">
                      {execution?.deliveryDate || data.date || "—"} {execution?.time ? `| ${execution.time}` : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAssignForm(!showAssignForm)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#18B2B0] text-white hover:bg-[#149D9B] transition-all shadow-sm cursor-pointer"
                    title="ربط أو تغيير الفني المسؤول"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    {responsibleTechName ? "تغيير الفني" : "ربط بفني"}
                  </button>
                </div>
              </div>

              {/* Assign Form */}
              {showAssignForm && (
                <div className="mt-2 pt-3 border-t border-[#18B2B0]/20 flex flex-col gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={tecSearch}
                      onChange={(e) => {
                        setTecSearch(e.target.value);
                        setSelectedTec(null);
                      }}
                      placeholder="ابحث عن الفني بالاسم أو الكود..."
                      className="w-full text-sm border border-[#18B2B0]/50 rounded-lg px-3 py-2.5 outline-none focus:border-[#18B2B0] focus:ring-2 focus:ring-[#18B2B0]/20 bg-white pr-9"
                      autoFocus
                    />
                  </div>
                  {selectedTec ? (
                    <div className="rounded-lg border border-[#18B2B0]/40 bg-[#18B2B0]/05 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={selectedTec.name} size={32} />
                        <div>
                          <div className="text-sm font-bold text-gray-800">{selectedTec.name}</div>
                          <div className="text-xs text-[#18B2B0] font-mono">{selectedTec.code}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedTec(null);
                          setTecSearch("");
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        ✕ تغيير
                      </button>
                    </div>
                  ) : (
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white shadow-md divide-y divide-gray-50">
                      {filteredTechnicians.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-400">لا توجد نتائج مطابقة</div>
                      ) : (
                        filteredTechnicians.map((tec) => (
                          <button
                            key={tec.id}
                            onClick={() => {
                              setSelectedTec({ name: tec.name, code: tec.code });
                              setTecSearch(tec.name);
                            }}
                            className="w-full text-right px-4 py-2.5 flex items-center gap-3 hover:bg-[#18B2B0]/05 transition-colors cursor-pointer"
                          >
                            <UserAvatar name={tec.name} size={28} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-800 truncate">{tec.name}</div>
                              <div className="text-xs text-gray-400 font-mono">{tec.code}</div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => selectedTec && assignMutation.mutate(selectedTec.name)}
                      disabled={!selectedTec || assignMutation.isPending}
                      className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-[#18B2B0] text-white hover:bg-[#149D9B] disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {assignMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      تأكيد الربط
                    </button>
                    <button
                      onClick={() => {
                        setShowAssignForm(false);
                        setTecSearch("");
                        setSelectedTec(null);
                      }}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── CARD 1: Top Summary "آخر تحديث على الطلب" ───────────────────── */}
            {effectiveLatestAudit && (
              <div className="rounded-xl border border-[#18B2B0]/30 bg-gradient-to-br from-white via-[#F8FAFC] to-[#18B2B0]/05 p-4 shadow-sm relative">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200/70 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#18B2B0]/15 text-[#18B2B0]">
                      <History className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-[#2D3135] uppercase tracking-wide">
                      آخر تحديث على الطلب
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AuditSourceBadge source={effectiveLatestAudit.source} label={effectiveLatestAudit.sourceLabel} />
                    <AuditStatusBadge status={effectiveLatestAudit.status} label={effectiveLatestAudit.statusLabel} />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      url={effectiveLatestAudit.actor?.avatarUrl}
                      name={effectiveLatestAudit.actor?.name || "منفذ التحديث"}
                      size={48}
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-[#2D3135]">
                          {effectiveLatestAudit.actor?.name}
                        </span>
                        {effectiveLatestAudit.actor?.role && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                            {effectiveLatestAudit.actor.role}
                          </span>
                        )}
                        {effectiveLatestAudit.actor?.isHistoricalFallback && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title="تم جلب الهوية الحالية للمنفذ لعدم وجود لقطة أصلية">
                            بيانات حالية
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-gray-700 leading-relaxed mt-1">
                        {effectiveLatestAudit.actionDescription}
                      </p>
                      <div className="text-[11px] text-gray-500 font-mono flex items-center gap-2 pt-1">
                        <Clock className="w-3 h-3 text-[#18B2B0]" />
                        <span>تاريخ التنفيذ (توقيت الرياض):</span>
                        <span className="font-bold text-gray-800">
                          {formatRiyadhDateTime(effectiveLatestAudit.changedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedAuditLog(effectiveLatestAudit)}
                    className="self-end sm:self-center shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#18B2B0] bg-[#18B2B0]/10 hover:bg-[#18B2B0]/20 border border-[#18B2B0]/30 transition-all cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    عرض تفاصيل التحديث
                  </button>
                </div>
              </div>
            )}

            {/* Excel Status Info Banner */}
            {!execution?.installationStatus && (
              <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 p-4 flex items-start gap-3 text-blue-950 text-xs shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold block text-sm text-blue-900 mb-0.5">
                    ✓ وثيقة الطلب ومستند البيانات مكتملة بالكامل من الإكسل
                  </span>
                  <p className="text-blue-800 leading-relaxed margin-0">
                    تم استيراد كافة بيانات المعاملة (اسم العميل، النشاط التجاري، رقم TID، المدينة، رقم الجوال، والعنوان). يُنتظر الآن من الفني الميداني إتمام التسليم وربط الأجهزة والشرائح المسلمة (SN / SIM) عند المقابلة.
                  </p>
                </div>
              </div>
            )}

            {/* Failure Alert */}
            {execution?.responseReasonCode && (
              <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 flex items-start gap-3 text-red-800 text-xs">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm mb-0.5">سبب عدم الإكمال / الملاحظة:</span>
                  <span>{execution.responseReasonCode}</span>
                  {execution.customerNotes && (
                    <span className="block mt-1 italic text-red-700">ملاحظات العميل: {execution.customerNotes}</span>
                  )}
                </div>
              </div>
            )}

            {/* Grid 1: Basic & Customer Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Box */}
              <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-4 space-y-3">
                <h3 className="text-xs font-extrabold text-[#18B2B0] uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-200 pb-2">
                  <Building2 className="w-4 h-4" />
                  بيانات العميل والمتجر
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">اسم العميل:</span>
                    <CopyableValue value={data.customerName} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">الاسم التجاري (النشاط):</span>
                    <CopyableValue value={data.retailerName} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">المدينة / المنطقة:</span>
                    <span className="font-bold text-gray-800 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#18B2B0]" />
                      {data.city || "—"} {data.cityTec ? `(${data.cityTec})` : ""}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">رقم الجوال:</span>
                    <CopyableValue value={data.mobile} mono />
                  </div>
                  {data.mobile2 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-semibold">جوال إضافي:</span>
                      <CopyableValue value={data.mobile2} mono />
                    </div>
                  )}
                  {data.addressAr && (
                    <div className="pt-1 border-t border-gray-200 text-gray-700">
                      <span className="text-gray-500 font-semibold block mb-0.5">العنوان بالتفصيل:</span>
                      <span>{data.addressAr}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Identifiers Box */}
              <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-4 space-y-3">
                <h3 className="text-xs font-extrabold text-[#18B2B0] uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-200 pb-2">
                  <Hash className="w-4 h-4" />
                  بيانات المعاملة والطلب
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">رقم الـ TID:</span>
                    <CopyableValue value={data.tid} mono />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">Terminal ID:</span>
                    <CopyableValue value={data.terminalId} mono />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">تاريخ الطلب:</span>
                    <span className="font-semibold text-gray-800">{data.date || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">نوع المورد (Vendor):</span>
                    <span className="font-bold text-gray-800 bg-gray-200 px-2 py-0.5 rounded text-[11px]">
                      {data.vendorType || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">نوع التركيب:</span>
                    <span className="font-semibold text-gray-800">{data.installationType || "—"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">مُنظِم الطلب الأصلي:</span>
                    <span className="font-semibold text-gray-700">{data.created_by_name || "النظام الإداري"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid 2: Hardware & Consumables */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-extrabold text-[#2D3135] uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                <Cpu className="w-4 h-4 text-[#18B2B0]" />
                الأجهزة والشرائح والمواد الاستهلاكية المسلمة
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-gray-200 p-3 bg-[#F8FAFC]">
                  <div className="text-gray-500 font-semibold flex items-center gap-1.5 mb-1">
                    <Smartphone className="w-3.5 h-3.5 text-[#18B2B0]" />
                    رقم السيريال للشبكة (SN)
                  </div>
                  <div className="mt-1">
                    <CopyableValue value={execution?.sn || data.terminalId} mono />
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-3 bg-[#F8FAFC]">
                  <div className="text-gray-500 font-semibold flex items-center gap-1.5 mb-1">
                    <FileCheck2 className="w-3.5 h-3.5 text-[#18B2B0]" />
                    رقم شريحة البيانات (SIM)
                  </div>
                  <div className="mt-1">
                    <CopyableValue value={execution?.simSerial || data.simSn || data.sim} mono />
                  </div>
                  {execution?.simType && (
                    <span className="inline-block mt-1 text-[10px] bg-[#18B2B0]/10 text-[#18B2B0] px-1.5 py-0.5 rounded font-bold">
                      مشغّل: {execution.simType}
                    </span>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 p-3 bg-[#F8FAFC] sm:col-span-2 lg:col-span-1">
                  <div className="text-gray-500 font-semibold flex items-center gap-1.5 mb-2">
                    <Layers className="w-3.5 h-3.5 text-[#18B2B0]" />
                    المستلزمات المسلمة
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="bg-white border border-gray-200 rounded p-1.5">
                      <span className="block text-gray-500 font-semibold">رول ورق</span>
                      <span className="font-extrabold text-[#18B2B0] text-sm">
                        {execution?.paperRollQty ?? (execution?.paperRoll === "Yes" ? 1 : 0)}
                      </span>
                    </div>
                    <div className="bg-white border border-gray-200 rounded p-1.5">
                      <span className="block text-gray-500 font-semibold">ملصقات</span>
                      <span className="font-extrabold text-[#18B2B0] text-sm">
                        {execution?.stickersQty ?? 0}
                      </span>
                    </div>
                    <div className="bg-white border border-gray-200 rounded p-1.5">
                      <span className="block text-gray-500 font-semibold">بطاقات Nulip</span>
                      <span className="font-extrabold text-[#18B2B0] text-sm">
                        {execution?.nulipCardsQty ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {itemsList.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#18B2B0]" />
                    سجل قطع العهدة المربوطة بالطلب ({itemsList.length}):
                  </div>
                  <div className="space-y-1.5">
                    {itemsList.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-[#F8FAFC] border border-gray-200 rounded-lg p-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">{item.itemType}</span>
                          <span className="font-mono text-gray-600">
                            {item.serialNumber || item.simSerial || "—"}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── ACCORDION SECTION 3: "سجل العمليات والتحديثات" ─────────────── */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xs">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="w-full px-4 py-3 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between text-xs font-extrabold text-[#2D3135] hover:bg-gray-100/70 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#18B2B0]" />
                  <span>سجل التعديلات والعمليات السابقة على الطلب</span>
                  <span className="font-mono font-bold px-2 py-0.5 rounded-full bg-[#18B2B0]/15 text-[#18B2B0] text-[11px]">
                    {totalAuditLogs}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-500 font-normal">
                  <span className="text-[11px]">
                    {historyOpen ? "طَي السجل" : "عرض السجل الزمني كاملًا"}
                  </span>
                  {historyOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#18B2B0]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {historyOpen && (
                <div className="p-4 border-t border-gray-200 bg-[#F8FAFC]/50 space-y-3">
                  {isAuditLoading ? (
                    <div className="py-8 flex items-center justify-center gap-2 text-xs text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin text-[#18B2B0]" />
                      <span>جاري تحميل سجل التعديلات...</span>
                    </div>
                  ) : isAuditError ? (
                    <div className="py-6 text-center text-xs text-red-600 flex flex-col items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <span>حدث خطأ أثناء جلب سجل العمليات.</span>
                      <button
                        onClick={() => refetchAudit()}
                        className="flex items-center gap-1 text-xs font-bold text-[#18B2B0] hover:underline cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> إعادة المحاولة
                      </button>
                    </div>
                  ) : (historyItems.length === 0 && !effectiveLatestAudit) ? (
                    <div className="py-6 text-center text-xs text-gray-500">
                      لا توجد عمليات سابقة مسجلة لهذا الطلب.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {(historyItems.length > 0 ? historyItems : [effectiveLatestAudit]).map((log: any) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-xl border border-gray-200 bg-white hover:border-[#18B2B0]/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-3">
                            <UserAvatar
                              url={log.actor?.avatarUrl}
                              name={log.actor?.name || "منفذ"}
                              size={36}
                            />
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-gray-800">
                                  {log.actor?.name}
                                </span>
                                {log.actor?.role && (
                                  <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {log.actor.role}
                                  </span>
                                )}
                                <AuditSourceBadge source={log.source} label={log.sourceLabel} />
                                <AuditStatusBadge status={log.status} label={log.statusLabel} />
                              </div>
                              <p className="text-gray-700 font-semibold mt-1">
                                {log.actionDescription}
                              </p>
                              <div className="text-[10px] text-gray-400 font-mono">
                                {formatRiyadhDateTime(log.changedAt)} | ID: #{log.id}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedAuditLog(log)}
                            className="self-end sm:self-center shrink-0 text-xs font-bold text-[#18B2B0] hover:text-[#149D9B] bg-[#18B2B0]/10 hover:bg-[#18B2B0]/20 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            التفاصيل
                          </button>
                        </div>
                      ))}

                      {/* Pagination controls */}
                      <div className="flex items-center justify-between pt-2 text-xs">
                        <span className="text-gray-500 font-mono">
                          عرض {historyItems.length > 0 ? historyItems.length : 1} من أصل {totalAuditLogs} عملية
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={historyPage <= 1}
                            onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                            className="px-2.5 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 cursor-pointer font-bold"
                          >
                            السابق
                          </button>
                          <span className="font-mono text-gray-700 font-bold">{historyPage}</span>
                          <button
                            disabled={historyPage * 5 >= totalAuditLogs}
                            onClick={() => setHistoryPage((p) => p + 1)}
                            className="px-2.5 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 cursor-pointer font-bold"
                          >
                            التالي
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Controls */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
          {onEditClick && requestId && (
            <button
              onClick={() => {
                onOpenChange(false);
                onEditClick(requestId);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#18B2B0] hover:bg-[#149D9B] transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              تعديل بيانات التركيب
            </button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="px-5 py-2 rounded-xl text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition-all cursor-pointer me-auto"
          >
            إغلاق
          </button>
        </div>
      </DialogContent>

      {/* ── DIALOG 2: Detailed Update Inspector Modal ───────────────────────── */}
      {selectedAuditLog && (
        <Dialog open={!!selectedAuditLog} onOpenChange={() => setSelectedAuditLog(null)}>
          <DialogContent className="max-w-xl p-6 rounded-2xl border border-[#18B2B0]/30 bg-white shadow-2xl dir-rtl font-sans">
            <DialogHeader className="border-b border-gray-100 pb-3">
              <DialogTitle className="text-base font-extrabold text-[#2D3135] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#18B2B0]" />
                تفاصيل سجل العملية التوثيقي #{selectedAuditLog.id}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                فحص قيم الحقول المعيارية ومقارنة البيانات السابقة بالجديدة منفذة من الخادم.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Actor Header */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    url={selectedAuditLog.actor?.avatarUrl}
                    name={selectedAuditLog.actor?.name || "منفذ"}
                    size={44}
                  />
                  <div>
                    <div className="font-extrabold text-sm text-gray-900">
                      {selectedAuditLog.actor?.name}
                    </div>
                    <div className="text-gray-500 font-semibold">
                      {selectedAuditLog.actor?.role}
                      {selectedAuditLog.actor?.employeeCode && (
                        <span className="font-mono text-[#18B2B0] ms-2">
                          (كود الموظف: {selectedAuditLog.actor.employeeCode})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <AuditSourceBadge
                    source={selectedAuditLog.source}
                    label={selectedAuditLog.sourceLabel}
                  />
                  <AuditStatusBadge
                    status={selectedAuditLog.status}
                    label={selectedAuditLog.statusLabel}
                  />
                </div>
              </div>

              {/* Action Description */}
              <div className="p-3 rounded-xl border border-[#18B2B0]/20 bg-[#18B2B0]/05 font-bold text-gray-800">
                {selectedAuditLog.actionDescription}
              </div>

              {/* Field Diff Table or Initial Creation Notice */}
              {(selectedAuditLog.oldValue !== null || selectedAuditLog.newValue !== null) ? (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-gray-100 font-extrabold text-gray-700">
                      <tr>
                        <th className="p-2.5 border-b border-gray-200">اسم الحقل المعدل</th>
                        <th className="p-2.5 border-b border-gray-200 text-red-700">القيمة السابقة</th>
                        <th className="p-2.5 border-b border-gray-200 text-[#18B2B0]">القيمة الجديدة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      <tr>
                        <td className="p-2.5 font-bold text-gray-800 bg-gray-50">
                          {selectedAuditLog.fieldName || "حالة المعاملة"}
                        </td>
                        <td className="p-2.5 text-red-700 bg-red-50/50">
                          <span className="inline-block px-2 py-0.5 rounded bg-red-100 font-mono">
                            {selectedAuditLog.oldValue || "—"}
                          </span>
                        </td>
                        <td className="p-2.5 text-[#18B2B0] bg-[#18B2B0]/05">
                          <span className="inline-block px-2 py-0.5 rounded bg-[#18B2B0]/15 font-mono font-bold">
                            {selectedAuditLog.newValue || "—"}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-950 flex items-start gap-2.5 text-xs shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold block text-emerald-900 mb-0.5">
                      عملية إدراج وتوليد أولية في النظام (Initial Creation)
                    </span>
                    <span className="text-emerald-800 leading-relaxed block">
                      تم إنشاء هذا الطلب وإدراجه لأول مرة كمعاملة جديدة في النظام؛ ولذلك لا توجد قيم تعديل سابقة لمقارنتها.
                    </span>
                  </div>
                </div>
              )}

              {/* Timestamp & Security Metadata */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-[11px]">
                <div className="flex justify-between items-center text-gray-600">
                  <span>تاريخ ووقت التنفيذ (Asia/Riyadh):</span>
                  <span className="font-bold font-mono text-gray-800">
                    {formatRiyadhDateTime(selectedAuditLog.changedAt)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                  <span>رقم السجل التوثيقي (Audit ID):</span>
                  <span className="font-mono font-bold text-gray-800">#{selectedAuditLog.id}</span>
                </div>
                {selectedAuditLog.ipAddress && (
                  <div className="flex justify-between items-center text-gray-600 border-t border-gray-200 pt-1">
                    <span>عنوان الـ IP:</span>
                    <span className="font-mono font-bold text-gray-800">
                      {selectedAuditLog.ipAddress}
                    </span>
                  </div>
                )}
                {selectedAuditLog.deviceId && (
                  <div className="flex justify-between items-center text-gray-600">
                    <span>معرف الجهاز (Device ID):</span>
                    <span className="font-mono font-bold text-gray-800 truncate max-w-[200px]">
                      {selectedAuditLog.deviceId}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
              >
                إغلاق التفاصيل
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
