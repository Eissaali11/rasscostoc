import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Save,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  BadgeCheck,
  XCircle,
  Lock,
} from "lucide-react";

interface Lookups {
  cities: { id: number; nameAr: string }[];
  simTypes: { id: number; name: string }[];
  vendorTypes: { id: number; name: string }[];
  failureReasons: { id: number; labelAr: string; code: string }[];
  technicians: { id: string; code: string; name: string }[];
}

interface Execution {
  installationStatus: string | null;
  salesTechnician: string | null;
  technicianCode: string | null;
  sn: string | null;
  simSerial: string | null;
  simType: string | null;
  deliveryDate: string | null;
  time: string | null;
  paperRoll: string | null;
  responseReasonCode: string | null;
  customerNotes: string | null;
  requestPriorityLevel: string | null;
  pushBack: string | null;
  responseDate: string | null;
}

interface RequestDetail {
  id: number;
  date: string | null;
  tid: string | null;
  terminalId: string | null;
  customerName: string | null;
  retailerName: string | null;
  city: string | null;
  cityTec: string | null;
  addressAr: string | null;
  mobile: string | null;
  mobile2: string | null;
  tecName: string | null;
  installationType: string | null;
  vendorType: string | null;
  sim: string | null;
  otp: string | null;
  ticketingHolouly: string | null;
  incidentNumber: string | null;
  pinCode: string | null;
  trsm: string | null;
  simSn: string | null;
  execution: Execution | null;
}

interface SerialLookupResult {
  found: boolean;
  normalized?: string;
  itemType?: { id: string; nameAr: string; category: string; carrierName: string | null } | null;
  technician?: { id: string; fullName: string; username: string; technicianCode: string | null } | null;
  custodyStatus?: string | null;
  inActiveCustody?: boolean;
  message?: string;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 border-b border-slate-700/20 pb-1 text-xs">
      <span className="text-slate-450 min-w-[120px]">{label}:</span>
      <span className="text-slate-200 font-medium">{value}</span>
    </div>
  );
}

export function EditCourierExecutionModal({
  open,
  onOpenChange,
  requestId,
  onSuccess
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: number | null;
  onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<1 | 2>(1);
  const [form, setForm] = useState<Partial<Execution>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [deviceLookup, setDeviceLookup] = useState<SerialLookupResult | null>(null);
  const [simLookup, setSimLookup] = useState<SerialLookupResult | null>(null);
  const [snLookupLoading, setSnLookupLoading] = useState(false);
  const [simLookupLoading, setSimLookupLoading] = useState(false);
  const [loadedSerials, setLoadedSerials] = useState(false);

  const { data: lookups } = useQuery<Lookups>({
    queryKey: ["/api/courier/lookups"],
    queryFn: () => apiRequest("GET", "/api/courier/lookups").then((r) => r.json()),
    enabled: open
  });

  const { data: request, isLoading: requestLoading } = useQuery<RequestDetail>({
    queryKey: ["/api/courier/requests/detail-modal", requestId],
    queryFn: () => apiRequest("GET", `/api/courier/requests/${requestId}`).then((r) => r.json()),
    enabled: open && requestId !== null
  });

  const exec = request?.execution;
  const currentForm = { ...exec, ...form };

  const doSerialLookup = useCallback(async (sn: string, role: "device" | "sim") => {
    if (!sn.trim()) return;
    if (role === "device") setSnLookupLoading(true);
    else setSimLookupLoading(true);
    try {
      const res = await apiRequest("POST", "/api/courier/serial-lookup", { sn: sn.trim() });
      const data: SerialLookupResult = await res.json();
      if (role === "device") {
        setDeviceLookup(data);
        if (data.found && data.technician) {
          setForm((prev) => ({
            ...prev,
            technicianCode: data.technician!.technicianCode ?? data.technician!.username,
            salesTechnician: data.technician!.fullName,
          }));
        }
      } else {
        setSimLookup(data);
        if (data.found) {
          if (data.normalized && data.normalized !== sn.trim()) {
            setForm((prev) => ({ ...prev, simSerial: data.normalized }));
          }
          if (data.itemType?.carrierName) {
            setForm((prev) => ({ ...prev, simType: data.itemType!.carrierName! }));
          }
        }
      }
    } catch {
      toast({ title: "تعذّر البحث", description: `فشل البحث عن الرقم: ${sn}`, variant: "destructive" });
    } finally {
      if (role === "device") setSnLookupLoading(false);
      else setSimLookupLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      setPhase(1);
      setForm({});
      setIsDirty(false);
      setDeviceLookup(null);
      setSimLookup(null);
      setLoadedSerials(false);
    }
  }, [open, requestId]);

  useEffect(() => {
    if (!open || !request || loadedSerials) return;
    setLoadedSerials(true);
    // Clear assignment pollution from prior saves
    if (request.execution?.salesTechnician && request.tecName &&
        request.execution.salesTechnician === request.tecName) {
      setForm((prev) => ({ ...prev, salesTechnician: undefined, technicianCode: undefined }));
    }
    const sn = request.execution?.sn;
    const simSerial = request.execution?.simSerial || request.simSn;
    if (sn) doSerialLookup(sn, "device");
    if (simSerial) doSerialLookup(simSerial, "sim");
  }, [request, open, loadedSerials, doSerialLookup]);

  const mutation = useMutation({
    mutationFn: (data: Partial<Execution>) =>
      apiRequest("POST", `/api/courier/executions/${requestId}`, data).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "تم الحفظ بنجاح", description: "تم حفظ بيانات التحقق والتنفيذ وتحديث العهدة والمخزون." });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/dashboard/stats"] });
      setIsDirty(false);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "فشل حفظ البيانات، يرجى المحاولة مجدداً.", variant: "destructive" });
    },
  });

  const handleChange = (field: keyof Execution, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleNextPhase = () => {
    if (!currentForm.installationStatus) {
      toast({ title: "تنبيه", description: "يرجى تحديد حالة التركيب أولاً.", variant: "destructive" });
      return;
    }
    setPhase(2);
  };

  const handleSave = () => {
    if (!currentForm.installationStatus) {
      toast({ title: "تنبيه", description: "يرجى تحديد حالة التركيب أولاً.", variant: "destructive" });
      return;
    }

    const completing =
      currentForm.installationStatus === "Installation Completed" ||
      currentForm.installationStatus === "Installation Completed - NL";

    if (completing) {
      if (!currentForm.sn?.trim()) {
        toast({ title: "تنبيه", description: "أدخل الرقم التسلسلي للجهاز قبل الإكمال.", variant: "destructive" });
        return;
      }
      if (!deviceLookup?.found || !deviceLookup?.technician) {
        toast({
          title: "لم يتم التعرف على الفني من العهدة",
          description: "أدخل رقم جهاز موجود في مخزون الفني ليظهر اسمه تلقائياً. لا يُعتمد اسم التعيين.",
          variant: "destructive",
        });
        return;
      }
    }

    // Send only writable fields — echoing enteredAt/updatedAt as strings crashes the API.
    mutation.mutate({
      installationStatus: currentForm.installationStatus,
      paperRoll: currentForm.paperRoll,
      time: currentForm.time,
      deliveryDate: currentForm.deliveryDate,
      responseDate: currentForm.responseDate,
      sn: currentForm.sn,
      simSerial: currentForm.simSerial,
      simType: currentForm.simType,
      customerNotes: currentForm.customerNotes,
      responseReasonCode: currentForm.responseReasonCode,
      version: currentForm.version,
      technicianCode: deviceLookup?.technician
        ? (deviceLookup.technician.technicianCode ?? deviceLookup.technician.username)
        : currentForm.technicianCode,
      salesTechnician: deviceLookup?.technician?.fullName ?? currentForm.salesTechnician,
    });
  };

  const isCompleted = currentForm.installationStatus?.includes("Completed")
    ? "border-emerald-500/40"
    : currentForm.installationStatus === "Not Completed"
    ? "border-red-500/40"
    : "border-slate-700/50";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0f1c1c] border-slate-700/60 text-slate-100 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-750">
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            بيانات التنفيذ الميداني
            {requestId && <span className="text-slate-500 font-mono text-xs">#{requestId}</span>}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-450">
            الفني يُجلب تلقائياً من عهدة الجهاز — وليس من اسم التعيين.
          </DialogDescription>
        </DialogHeader>

        {requestLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="animate-spin w-5 h-5" />
            <span className="text-sm">جاري التحميل...</span>
          </div>
        ) : !request ? (
          <div className="text-center py-16 text-slate-500 text-sm">الطلب غير موجود</div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0b1717] border border-slate-750 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 mb-2">بيانات الطلب</p>
                <DetailRow label="العميل" value={request.customerName} />
                <DetailRow label="المدينة" value={request.city} />
                <DetailRow label="تعيين الطلب" value={request.tecName} />
                <DetailRow label="TID" value={request.tid} />
                <DetailRow label="Terminal" value={request.terminalId} />
              </div>

              <div className="bg-[#0b1717] border border-slate-750 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${phase === 1 ? "text-emerald-400" : "text-slate-500"}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${phase === 1 ? "bg-emerald-600 text-white" : "bg-slate-700"}`}>1</span>
                    التحقق
                  </div>
                  <div className="flex-1 h-px bg-slate-700" />
                  <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${phase === 2 ? "text-emerald-400" : "text-slate-500"}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${phase === 2 ? "bg-emerald-600 text-white" : "bg-slate-700"}`}>2</span>
                    التنفيذ
                  </div>
                </div>

                <div className="space-y-3">
                  {phase === 1 ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">حالة التركيب *</label>
                        <select
                          value={currentForm.installationStatus || ""}
                          onChange={(e) => handleChange("installationStatus", e.target.value)}
                          className={`w-full bg-[#0b1717] border ${isCompleted} rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60`}
                        >
                          <option value="">اختر الحالة</option>
                          <option value="Installation Completed">مكتمل</option>
                          <option value="Not Completed">غير مكتمل</option>
                          <option value="Customer Not Answering">العميل لا يرد</option>
                          <option value="In Progress">تحت الإجراء</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">ملاحظات العميل / المشرف</label>
                        <textarea
                          value={currentForm.customerNotes || ""}
                          onChange={(e) => handleChange("customerNotes", e.target.value)}
                          rows={3}
                          className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 resize-none"
                          placeholder="ملاحظات التركيب..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">الرقم التسلسلي للجهاز (SN) *</label>
                        <div className="flex gap-1.5">
                          <input
                            value={currentForm.sn || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleChange("sn", val);
                              setDeviceLookup(null);
                              if (val.trim().length >= 9) doSerialLookup(val.trim(), "device");
                            }}
                            onBlur={(e) => { if (e.target.value.trim()) doSerialLookup(e.target.value.trim(), "device"); }}
                            placeholder="أدخل أو امسح الرقم التسلسلي..."
                            className="flex-1 bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => { if (currentForm.sn?.trim()) doSerialLookup(currentForm.sn.trim(), "device"); }}
                            className="bg-emerald-700/40 border border-emerald-700/40 text-emerald-300 px-2 rounded-lg"
                          >
                            {snLookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {deviceLookup && (
                          <div className={`mt-1 flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md ${
                            deviceLookup.found && deviceLookup.inActiveCustody
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}>
                            {deviceLookup.found && deviceLookup.inActiveCustody
                              ? <BadgeCheck className="w-3 h-3" />
                              : <XCircle className="w-3 h-3" />}
                            {deviceLookup.found
                              ? `${deviceLookup.itemType?.nameAr ?? "جهاز"} · ${deviceLookup.custodyStatus}${deviceLookup.technician ? ` · ${deviceLookup.technician.fullName}` : ""}`
                              : (deviceLookup.message ?? "الرقم غير موجود")}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">الرقم التسلسلي للشريحة (ICCID)</label>
                        <div className="flex gap-1.5">
                          <input
                            value={currentForm.simSerial || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleChange("simSerial", val);
                              setSimLookup(null);
                              if (val.trim().length >= 18) doSerialLookup(val.trim(), "sim");
                            }}
                            onBlur={(e) => { if (e.target.value.trim()) doSerialLookup(e.target.value.trim(), "sim"); }}
                            placeholder="89..."
                            className="flex-1 bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => { if (currentForm.simSerial?.trim()) doSerialLookup(currentForm.simSerial.trim(), "sim"); }}
                            className="bg-emerald-700/40 border border-emerald-700/40 text-emerald-300 px-2 rounded-lg"
                          >
                            {simLookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {simLookup && (
                          <div className={`mt-1 flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md ${
                            simLookup.found && simLookup.inActiveCustody
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}>
                            {simLookup.found && simLookup.inActiveCustody
                              ? <BadgeCheck className="w-3 h-3" />
                              : <XCircle className="w-3 h-3" />}
                            {simLookup.found
                              ? `${simLookup.itemType?.nameAr ?? "شريحة"} · ${simLookup.itemType?.carrierName ?? ""} · ${simLookup.custodyStatus}`
                              : (simLookup.message ?? "الرقم غير موجود")}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">نوع الشريحة</label>
                        <select
                          value={currentForm.simType || ""}
                          onChange={(e) => handleChange("simType", e.target.value)}
                          className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                        >
                          <option value="">اختر النوع</option>
                          {lookups?.simTypes.map((s) => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium flex items-center gap-1">
                          <Lock className="w-3 h-3" /> الفني المسؤول (من عهدة الجهاز)
                        </label>
                        <div className={`bg-[#0b1717]/40 border rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-1.5 ${
                          deviceLookup?.technician ? "border-emerald-700/40 text-emerald-300" : "border-slate-750 text-slate-500"
                        }`}>
                          {deviceLookup?.technician ? (
                            <>
                              👤 {deviceLookup.technician.fullName}
                              <span className="text-[10px] text-slate-500 font-mono bg-slate-800 px-1 py-0.5 rounded ml-auto">
                                {deviceLookup.technician.technicianCode ?? deviceLookup.technician.username}
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px]">امسح رقم الجهاز لتحديد الفني من العهدة</span>
                          )}
                        </div>
                        {request.tecName && (
                          <p className="mt-1 text-[10px] text-slate-500">
                            تعيين الطلب (مرجعي): {request.tecName}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-450 mb-1 font-medium">تاريخ التنفيذ</label>
                          <input
                            type="date"
                            value={currentForm.deliveryDate || ""}
                            onChange={(e) => handleChange("deliveryDate", e.target.value)}
                            className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-450 mb-1 font-medium">وقت التنفيذ</label>
                          <input
                            type="time"
                            value={currentForm.time || ""}
                            onChange={(e) => handleChange("time", e.target.value)}
                            className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">رول الورق</label>
                        <select
                          value={currentForm.paperRoll || ""}
                          onChange={(e) => handleChange("paperRoll", e.target.value)}
                          className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                        >
                          <option value="">اختر</option>
                          <option value="Yes">نعم</option>
                          <option value="No">لا</option>
                        </select>
                      </div>

                      {currentForm.installationStatus === "Not Completed" && (
                        <div>
                          <label className="block text-[10px] text-slate-450 mb-1 font-medium">سبب الفشل *</label>
                          <select
                            value={currentForm.responseReasonCode || ""}
                            onChange={(e) => handleChange("responseReasonCode", e.target.value)}
                            className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                          >
                            <option value="">اختر السبب</option>
                            {lookups?.failureReasons.map((r) => (
                              <option key={r.id} value={r.code}>{r.labelAr}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-750 pt-3 mt-4">
                  {phase === 1 ? (
                    <>
                      <div />
                      <button
                        type="button"
                        onClick={handleNextPhase}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold px-4 py-2 rounded-lg flex items-center gap-1"
                      >
                        التالي (التنفيذ الميداني)
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setPhase(1)}
                        className="bg-slate-750 hover:bg-slate-700 text-white text-[10px] font-semibold px-3 py-2 rounded-lg flex items-center gap-1"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        السابق (التحقق)
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={mutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-semibold px-4 py-2 rounded-lg flex items-center gap-1"
                      >
                        {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        حفظ وإكمال
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {currentForm.installationStatus?.includes("Completed") && (
              <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-450 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-400">خصم تلقائي نشط</p>
                  <p className="text-[10px] text-emerald-450/70 mt-0.5">
                    عند الإكمال سيُخصم الجهاز من عهدة الفني الظاهر أعلاه (مالك العهدة).
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
