import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { useState } from "react";
import rasscoLogoHorizontal from "@/assets/rassco-logo-horizontal.png";

interface RequestDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: number | null;
  onEditClick?: (requestId: number) => void;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B7280] bg-[#F1F5F9] px-3 py-1 rounded-full border border-[#E2E8F0] shadow-sm">
        <Clock className="w-3.5 h-3.5" />
        بانتظار التحقق
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
    <span className="inline-flex items-center gap-1.5 group cursor-pointer" onClick={handleCopy} title="انقر لنسخ القيمة">
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
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/courier/requests", requestId],
    queryFn: async () => {
      if (!requestId) return null;
      const res = await apiRequest("GET", `/api/courier/requests/${requestId}`);
      return res.json();
    },
    enabled: !!requestId && open,
  });

  const execution = data?.execution;
  const itemsList = data?.items ?? [];

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
                  عرض تفاصيل معاملة التركيب بالكامل، الأجهزة المسلمة، وتدقيق الفني المسؤول.
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
            {/* Responsible Technician Banner */}
            <div className="rounded-xl border border-[#18B2B0]/25 bg-gradient-to-r from-[#18B2B0]/08 to-transparent p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#18B2B0] text-white flex items-center justify-center font-bold text-lg shadow">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-[#6B7280] font-semibold">الفني المسؤول عن تنفيذ العملية</div>
                  <div className="text-base font-extrabold text-[#2D3135] flex items-center gap-2 mt-0.5">
                    {execution?.salesTechnician || data.tecName || "غير محدد"}
                    {(execution?.technicianCode || data.cityTec) && (
                      <span className="text-xs font-mono font-bold bg-white text-[#18B2B0] border border-[#18B2B0]/30 px-2 py-0.5 rounded-full">
                        {execution?.technicianCode || data.cityTec}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500 flex flex-col items-start sm:items-end">
                <span className="font-semibold text-gray-700">تاريخ التسليم والرد</span>
                <span className="font-mono text-[#18B2B0] font-bold">
                  {execution?.deliveryDate || data.date || "—"} {execution?.time ? `| ${execution.time}` : ""}
                </span>
              </div>
            </div>

            {/* Response Failure Alert (if not completed) */}
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
                    <span className="text-gray-500 font-semibold">مُنظِم الطلب:</span>
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
                {/* Device Serial */}
                <div className="rounded-lg border border-gray-200 p-3 bg-[#F8FAFC]">
                  <div className="text-gray-500 font-semibold flex items-center gap-1.5 mb-1">
                    <Smartphone className="w-3.5 h-3.5 text-[#18B2B0]" />
                    رقم السيريال للشبكة (SN)
                  </div>
                  <div className="mt-1">
                    <CopyableValue value={execution?.sn || data.terminalId} mono />
                  </div>
                </div>

                {/* SIM Serial */}
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

                {/* Consumables Card */}
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

              {/* Linked Inventory Items List if available */}
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

            {/* Grid 3: Codes & Incident identifiers */}
            {(data.otp || data.incidentNumber || data.pinCode || data.trsm) && (
              <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-4 space-y-3">
                <h3 className="text-xs font-extrabold text-[#18B2B0] uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-200 pb-2">
                  <ShieldCheck className="w-4 h-4" />
                  رموز الأمان والبلاغات
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {data.otp && (
                    <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                      <span className="text-gray-500 font-semibold block mb-0.5">رمز OTP:</span>
                      <CopyableValue value={data.otp} mono />
                    </div>
                  )}
                  {data.incidentNumber && (
                    <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                      <span className="text-gray-500 font-semibold block mb-0.5">رقم البلاغ/التذكرة:</span>
                      <CopyableValue value={data.incidentNumber} mono />
                    </div>
                  )}
                  {data.pinCode && (
                    <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                      <span className="text-gray-500 font-semibold block mb-0.5">رمز الـ PIN:</span>
                      <CopyableValue value={data.pinCode} mono />
                    </div>
                  )}
                  {data.trsm && (
                    <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                      <span className="text-gray-500 font-semibold block mb-0.5">TRSM:</span>
                      <CopyableValue value={data.trsm} mono />
                    </div>
                  )}
                </div>
              </div>
            )}
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
    </Dialog>
  );
}
