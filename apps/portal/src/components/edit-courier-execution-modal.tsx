import { useState, useEffect } from "react";
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
  Calendar,
  User,
  Cpu,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Package
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

  // Fetch lookups
  const { data: lookups } = useQuery<Lookups>({
    queryKey: ["/api/courier/lookups"],
    queryFn: () => apiRequest("GET", "/api/courier/lookups").then((r) => r.json()),
    enabled: open
  });

  // Fetch request details
  const { data: request, isLoading: requestLoading } = useQuery<RequestDetail>({
    queryKey: ["/api/courier/requests/detail-modal", requestId],
    queryFn: () => apiRequest("GET", `/api/courier/requests/${requestId}`).then((r) => r.json()),
    enabled: open && requestId !== null
  });

  const exec = request?.execution;
  const currentForm = { ...exec, ...form };

  // Reset phase and form when modal state changes
  useEffect(() => {
    if (open) {
      setPhase(1);
      setForm({});
      setIsDirty(false);
    }
  }, [open]);

  // Handle auto-matching technician from lookups
  useEffect(() => {
    const tecName = request?.tecName;
    if (request && lookups && !request.execution && !form.technicianCode && tecName) {
      const matchingTech = lookups.technicians.find(
        (t) => t.name.trim().toLowerCase() === tecName.trim().toLowerCase()
      );
      if (matchingTech) {
        setForm((prev) => ({
          ...prev,
          technicianCode: matchingTech.code,
          salesTechnician: matchingTech.name,
        }));
      } else {
        const partialTech = lookups.technicians.find(
          (t) => t.name.includes(tecName) || tecName.includes(t.name)
        );
        if (partialTech) {
          setForm((prev) => ({
            ...prev,
            technicianCode: partialTech.code,
            salesTechnician: partialTech.name,
          }));
        } else {
          setForm((prev) => ({
            ...prev,
            salesTechnician: tecName,
          }));
        }
      }
    }
  }, [request, lookups, open]);

  const mutation = useMutation({
    mutationFn: (data: Partial<Execution>) =>
      apiRequest("POST", `/api/courier/executions/${requestId}`, data).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "تم الحفظ بنجاح", description: "تم حفظ بيانات التحقق والتنفيذ بنجاح وتحديث العهدة والمخزون." });
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
      toast({
        title: "تنبيه",
        description: "يرجى تحديد حالة التركيب أولاً.",
        variant: "destructive",
      });
      return;
    }
    setPhase(2);
  };

  const handleSave = () => {
    if (!currentForm.installationStatus) {
      toast({
        title: "تنبيه",
        description: "يرجى تحديد حالة التركيب أولاً.",
        variant: "destructive",
      });
      return;
    }

    const finalForm = { ...currentForm };
    const tecName = request?.tecName;
    if (!finalForm.salesTechnician && tecName) {
      finalForm.salesTechnician = tecName;
      const tech = lookups?.technicians.find(
        (t) => t.name.trim().toLowerCase() === tecName.trim().toLowerCase()
      );
      if (tech) {
        finalForm.technicianCode = tech.code;
      }
    }

    mutation.mutate(finalForm);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto bg-[#142d2d] border border-slate-700/60 text-slate-100 p-0 shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-slate-700/40 relative">
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            📦 إدخال وتعديل بيانات التحقق والتنفيذ #{requestId}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 mt-1.5">
            قم بالتحقق من حالة الطلب وإدخال معلومات المندوب والربط الميداني للعهدة.
          </DialogDescription>
        </DialogHeader>

        {requestLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 className="animate-spin w-8 h-8 text-emerald-450" />
            <span className="text-sm">جاري تحميل بيانات الطلب...</span>
          </div>
        ) : !request ? (
          <div className="p-10 text-center text-slate-500">
            الطلب غير موجود.
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Left Side: Request Original Info */}
              <div className="bg-[#102222]/60 border border-slate-700/35 rounded-xl p-5 space-y-2.5">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wide border-b border-slate-700/40 pb-2 mb-3">
                  بيانات الطلب الأصلية
                </h4>
                <DetailRow label="التاريخ" value={request.date} />
                <DetailRow label="TID" value={request.tid} />
                <DetailRow label="Terminal ID" value={request.terminalId} />
                <DetailRow label="اسم العميل" value={request.customerName} />
                <DetailRow label="اسم التاجر" value={request.retailerName} />
                <DetailRow label="المدينة" value={request.city} />
                <DetailRow label="المدينة (TEC)" value={request.cityTec} />
                <DetailRow label="العنوان" value={request.addressAr} />
                <DetailRow label="الجوال" value={request.mobile} />
                <DetailRow label="اسم الفني" value={request.tecName} />
                <DetailRow label="نوع التركيب" value={request.installationType} />
                <DetailRow label="نوع الجهاز" value={request.vendorType} />
                <DetailRow label="SIM" value={request.sim} />
                <DetailRow label="رقم الحادثة" value={request.incidentNumber} />
                <DetailRow label="TRSM" value={request.trsm} />
              </div>

              {/* Right Side: Wizard Forms */}
              <div className="bg-[#102222]/40 border border-slate-700/30 rounded-xl p-5 space-y-4 flex flex-col justify-between min-h-[420px]">
                <div>
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wide border-b border-slate-700/40 pb-2 mb-4">
                    {phase === 1 ? "شاشة التحقق والاعتماد (مرحلة 1)" : "بيانات التنفيذ الميداني (مرحلة 2)"}
                  </h4>

                  {/* Step Indicator */}
                  <div className="flex items-center justify-between mb-5 bg-[#0b1717] p-2.5 rounded-lg border border-slate-750/50">
                    <button
                      type="button"
                      onClick={() => setPhase(1)}
                      className="flex items-center gap-1.5 cursor-pointer text-right"
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${phase === 1 ? 'bg-emerald-500 text-slate-900 shadow shadow-emerald-500/50' : 'bg-emerald-500/20 text-emerald-450'}`}>1</span>
                      <span className={`text-[10px] font-semibold transition-all ${phase === 1 ? 'text-slate-100' : 'text-slate-450'}`}>شاشة التحقق</span>
                    </button>
                    <div className="flex-1 mx-3 h-0.5 bg-slate-700/30"></div>
                    <button
                      type="button"
                      disabled={!currentForm.installationStatus}
                      onClick={() => setPhase(2)}
                      className="flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${phase === 2 ? 'bg-emerald-500 text-slate-900 shadow shadow-emerald-500/50' : 'bg-slate-700/50 text-slate-450'}`}>2</span>
                      <span className={`text-[10px] font-semibold transition-all ${phase === 2 ? 'text-slate-100' : 'text-slate-450'}`}>بيانات التنفيذ</span>
                    </button>
                  </div>

                  {phase === 1 ? (
                    /* PHASE 1 FORM FIELDS */
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">مستوى أولوية الطلب</label>
                        <select
                          value={currentForm.requestPriorityLevel || ""}
                          onChange={(e) => handleChange("requestPriorityLevel", e.target.value)}
                          className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                        >
                          <option value="">اختر الأولوية</option>
                          <option value="Low">منخفض</option>
                          <option value="Medium">متوسط</option>
                          <option value="High">مرتفع</option>
                          <option value="Urgent">عاجل</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">إجراء الطلب</label>
                        <select
                          value={currentForm.pushBack || ""}
                          onChange={(e) => handleChange("pushBack", e.target.value)}
                          className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                        >
                          <option value="">بدون إجراء</option>
                          <option value="Return to Tech">إعادة للفني</option>
                          <option value="Return to Supervisor">إعادة للمشرف</option>
                          <option value="Return to Admin">إعادة للإدارة</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">حالة التركيب *</label>
                        <select
                          value={currentForm.installationStatus || ""}
                          onChange={(e) => handleChange("installationStatus", e.target.value)}
                          className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                        >
                          <option value="">اختر الحالة</option>
                          <option value="Installation Completed">مكتمل</option>
                          <option value="Not Completed">غير مكتمل</option>
                          <option value="Customer Not Answering">العميل لا يرد</option>
                          <option value="In Progress">تحت الإجراء</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">تاريخ الرد (تاريخ المراجعة)</label>
                        <input
                          type="date"
                          value={currentForm.responseDate || ""}
                          onChange={(e) => handleChange("responseDate", e.target.value)}
                          className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">ملاحظات العميل / المشرف</label>
                        <textarea
                          value={currentForm.customerNotes || ""}
                          onChange={(e) => handleChange("customerNotes", e.target.value)}
                          rows={3}
                          className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 resize-none font-sans"
                          placeholder="ملاحظات التركيب..."
                        />
                      </div>
                    </div>
                  ) : (
                    /* PHASE 2 FORM FIELDS */
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">الرقم التسلسلي للجهاز (SN)</label>
                        <input
                          value={currentForm.sn || ""}
                          onChange={(e) => handleChange("sn", e.target.value)}
                          placeholder="أدخل الرقم التسلسلي للجهاز"
                          className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">الرقم التسلسلي للشريحة (ICCID)</label>
                        <input
                          value={currentForm.simSerial || ""}
                          onChange={(e) => handleChange("simSerial", e.target.value)}
                          placeholder="89..."
                          className="w-full bg-[#0b1717] border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                        />
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
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-450 mb-1 font-medium">الفني المسؤول (من التعيين)</label>
                        <div className="bg-[#0b1717]/40 border border-slate-750 rounded-lg px-2.5 py-1.5 text-xs text-slate-350 flex items-center gap-1.5">
                          👤 {currentForm.salesTechnician || request?.tecName || "غير محدد"}
                          {currentForm.technicianCode && (
                            <span className="text-[10px] text-slate-500 font-mono bg-slate-800 px-1 py-0.5 rounded">
                              {currentForm.technicianCode}
                            </span>
                          )}
                        </div>
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
                              <option key={r.id} value={r.code}>
                                {r.labelAr}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Navigation Buttons for Wizard inside Modal */}
                <div className="flex items-center justify-between border-t border-slate-750 pt-3 mt-4">
                  {phase === 1 ? (
                    <>
                      <div />
                      <button
                        type="button"
                        onClick={handleNextPhase}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
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
                        className="bg-slate-750 hover:bg-slate-700 text-white text-[10px] font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        السابق (التحقق)
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={!isDirty || mutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {mutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        حفظ وإكمال
                      </button>
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* Auto-deduction banner */}
            {currentForm.installationStatus?.includes("Completed") && (
              <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-450 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-400">خصم تلقائي نشط</p>
                  <p className="text-[10px] text-emerald-450/70 mt-0.5">
                    عند اختيار حالة "مكتمل"، سيتم خصم هذا الجهاز تلقائياً من عهدة الفني ومخزونه وتحديث العهدة المسلسلة.
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
