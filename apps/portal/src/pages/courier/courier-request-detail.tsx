import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowRight,
  Package,
  MapPin,
  Phone,
  Calendar,
  Hash,
  Cpu,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  ChevronLeft,
  ChevronRight,
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
  extraField1: string | null;
  extraField2: string | null;
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
    <div className="flex gap-2">
      <span className="text-slate-500 text-sm min-w-[140px]">{label}</span>
      <span className="text-slate-200 text-sm font-medium">{value}</span>
    </div>
  );
}

export default function CourierRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const requestId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: request, isLoading } = useQuery<RequestDetail>({
    queryKey: ["/api/courier/requests", requestId],
    queryFn: () =>
      apiRequest("GET", `/api/courier/requests/${requestId}`).then((r) => r.json()),
    enabled: !!requestId,
  });

  const { data: lookups } = useQuery<Lookups>({
    queryKey: ["/api/courier/lookups"],
    queryFn: () => apiRequest("GET", "/api/courier/lookups").then((r) => r.json()),
  });

  const [form, setForm] = useState<Partial<Execution>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [phase, setPhase] = useState<1 | 2>(1);

  const mutation = useMutation({
    mutationFn: (data: Partial<Execution>) =>
      apiRequest("POST", `/api/courier/executions/${requestId}`, data).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "تم الحفظ بنجاح", description: "تم حفظ بيانات التحقق والتنفيذ بنجاح وتحديث العهدة والمخزون." });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/requests", requestId] });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/dashboard/stats"] });
      setIsDirty(false);
      setPhase(1); // Reset back to phase 1 after saving successfully
      setLocation("/courier/requests");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حفظ البيانات، يرجى المحاولة مجدداً.", variant: "destructive" });
    },
  });

  const exec = request?.execution;
  const currentForm = { ...exec, ...form };

  // Automatically lookup and assign technician based on the request's tecName
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
  }, [request, lookups, form.technicianCode]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="animate-spin w-6 h-6 mr-2" />
        <span>جاري التحميل...</span>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-20 text-slate-500">
        الطلب غير موجود
      </div>
    );
  }

  const statusStyle =
    currentForm.installationStatus?.includes("Completed")
      ? "text-emerald-400"
      : currentForm.installationStatus === "Not Completed"
      ? "text-red-400"
      : "text-amber-400";

  return (
    <div dir="rtl" className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/courier/requests" className="hover:text-slate-200 transition-colors">
          قائمة الطلبات
        </Link>
        <ArrowRight className="w-4 h-4" />
        <span className="text-slate-200 font-mono">#{request.id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            تفاصيل الطلب #{request.id}
          </h1>
          {currentForm.installationStatus && (
            <p className={`text-sm font-medium mt-1 ${statusStyle}`}>
              {currentForm.installationStatus === "Installation Completed" ? "مكتمل" : 
               currentForm.installationStatus === "Not Completed" ? "غير مكتمل" :
               currentForm.installationStatus === "Customer Not Answering" ? "العميل لا يرد" :
               currentForm.installationStatus === "In Progress" ? "تحت الإجراء" : 
               currentForm.installationStatus}
            </p>
          )}
        </div>
        {phase === 1 ? (
          <button
            onClick={handleNextPhase}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            التالي (بيانات التنفيذ)
            <ChevronLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setPhase(1)}
              className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              السابق
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || mutation.isPending}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              حفظ وإكمال
            </button>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Request Raw Data */}
        <div className="bg-[#1a3636] border border-slate-700/50 rounded-xl p-6 shadow space-y-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide border-b border-slate-700/50 pb-2 mb-4">
            بيانات الطلب الأصلية
          </h2>
          <DetailRow label="التاريخ" value={request.date} />
          <DetailRow label="TID" value={request.tid} />
          <DetailRow label="Terminal ID" value={request.terminalId} />
          <DetailRow label="اسم العميل" value={request.customerName} />
          <DetailRow label="اسم التاجر" value={request.retailerName} />
          <DetailRow label="المدينة" value={request.city} />
          <DetailRow label="المدينة (TEC)" value={request.cityTec} />
          <DetailRow label="العنوان" value={request.addressAr} />
          <DetailRow label="الجوال" value={request.mobile} />
          <DetailRow label="الجوال 2" value={request.mobile2} />
          <DetailRow label="اسم الفني" value={request.tecName} />
          <DetailRow label="نوع التركيب" value={request.installationType} />
          <DetailRow label="نوع الجهاز" value={request.vendorType} />
          <DetailRow label="SIM" value={request.sim} />
          <DetailRow label="OTP" value={request.otp} />
          <DetailRow label="رقم الحادثة" value={request.incidentNumber} />
          <DetailRow label="TRSM" value={request.trsm} />
        </div>

        {/* Execution Form Wizard */}
        <div className="bg-[#1a3636] border border-slate-700/50 rounded-xl p-6 shadow space-y-4 flex flex-col justify-between min-h-[500px]">
          <div>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide border-b border-slate-700/50 pb-2 mb-4">
              {phase === 1 ? "شاشة التحقق والاعتماد (المرحلة الأولى)" : "بيانات التنفيذ (المرحلة الثانية)"}
            </h2>

            {/* Premium Step Indicator */}
            <div className="flex items-center justify-between mb-6 bg-[#102222] p-3 rounded-lg border border-slate-700/30">
              <button
                type="button"
                onClick={() => setPhase(1)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${phase === 1 ? 'bg-emerald-500 text-slate-900 shadow shadow-emerald-500/50' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}>1</span>
                <span className={`text-xs font-semibold transition-all ${phase === 1 ? 'text-slate-100' : 'text-slate-400 hover:text-slate-300'}`}>شاشة التحقق</span>
              </button>
              <div className="flex-1 mx-4 h-0.5 bg-slate-700/50"></div>
              <button
                type="button"
                disabled={!currentForm.installationStatus}
                onClick={() => setPhase(2)}
                className="flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${phase === 2 ? 'bg-emerald-500 text-slate-900 shadow shadow-emerald-500/50' : 'bg-slate-700/50 text-slate-400'}`}>2</span>
                <span className={`text-xs font-semibold transition-all ${phase === 2 ? 'text-slate-100' : 'text-slate-400'}`}>بيانات التنفيذ</span>
              </button>
            </div>

            {phase === 1 ? (
              /* PHASE 1 FORM FIELDS */
              <div className="space-y-4">
                {/* 1. Request Priority Level */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">مستوى أولوية الطلب</label>
                  <select
                    value={currentForm.requestPriorityLevel || ""}
                    onChange={(e) => handleChange("requestPriorityLevel", e.target.value)}
                    className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/60"
                  >
                    <option value="">اختر الأولوية</option>
                    <option value="Low">منخفض</option>
                    <option value="Medium">متوسط</option>
                    <option value="High">مرتفع</option>
                    <option value="Urgent">عاجل</option>
                  </select>
                </div>

                {/* 2. Action / إجراء الطلب */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">إجراء الطلب</label>
                  <select
                    value={currentForm.pushBack || ""}
                    onChange={(e) => handleChange("pushBack", e.target.value)}
                    className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/60"
                  >
                    <option value="">بدون إجراء</option>
                    <option value="Return to Tech">إعادة للفني</option>
                    <option value="Return to Supervisor">إعادة للمشرف</option>
                    <option value="Return to Admin">إعادة للإدارة</option>
                  </select>
                </div>

                {/* 3. Installation Status */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">حالة التركيب *</label>
                  <select
                    value={currentForm.installationStatus || ""}
                    onChange={(e) => handleChange("installationStatus", e.target.value)}
                    className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/60"
                  >
                    <option value="">اختر الحالة</option>
                    <option value="Installation Completed">مكتمل</option>
                    <option value="Not Completed">غير مكتمل</option>
                    <option value="Customer Not Answering">العميل لا يرد</option>
                    <option value="In Progress">تحت الإجراء</option>
                  </select>
                </div>

                {/* 4. Response Date */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">تاريخ الرد (تاريخ المراجعة)</label>
                  <input
                    type="date"
                    value={currentForm.responseDate || ""}
                    onChange={(e) => handleChange("responseDate", e.target.value)}
                    className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/60"
                  />
                </div>

                {/* 5. Client Notes / ملاحظات العميل */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">ملاحظات العميل / المشرف</label>
                  <textarea
                    value={currentForm.customerNotes || ""}
                    onChange={(e) => handleChange("customerNotes", e.target.value)}
                    rows={4}
                    className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/60 resize-none font-sans"
                    placeholder="أي ملاحظات أو تعليقات تخص العميل أو مستوى الخدمة..."
                  />
                </div>
              </div>
            ) : (
              /* PHASE 2 FORM FIELDS */
              <div className="space-y-4">
                {/* Device SN */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">الرقم التسلسلي للجهاز (SN)</label>
                  <input
                    value={currentForm.sn || ""}
                    onChange={(e) => handleChange("sn", e.target.value)}
                    placeholder="أدخل الرقم التسلسلي للجهاز"
                    className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/60 font-mono"
                  />
                </div>

                {/* SIM Serial */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">الرقم التسلسلي للشريحة (ICCID)</label>
                  <input
                    value={currentForm.simSerial || ""}
                    onChange={(e) => handleChange("simSerial", e.target.value)}
                    placeholder="89..."
                    className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/60 font-mono"
                  />
                </div>

                {/* SIM Type */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">نوع الشريحة</label>
                  <select
                    value={currentForm.simType || ""}
                    onChange={(e) => handleChange("simType", e.target.value)}
                    className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/60"
                  >
                    <option value="">اختر النوع</option>
                    {lookups?.simTypes.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Technician (Read-only) */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">الفني المسؤول (من بيانات الطلب الأصلية)</label>
                  <div className="bg-[#102222]/50 border border-slate-700/30 rounded-lg px-3 py-2 text-sm text-slate-300 font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    👤 {currentForm.salesTechnician || request?.tecName || "غير محدد"} 
                    {currentForm.technicianCode && (
                      <span className="text-xs text-slate-500 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                        {currentForm.technicianCode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delivery Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">تاريخ التنفيذ</label>
                    <input
                      type="date"
                      value={currentForm.deliveryDate || ""}
                      onChange={(e) => handleChange("deliveryDate", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">وقت التنفيذ</label>
                    <input
                      type="time"
                      value={currentForm.time || ""}
                      onChange={(e) => handleChange("time", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/60"
                    />
                  </div>
                </div>

                {/* Paper Roll */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">رول الورق</label>
                  <select
                    value={currentForm.paperRoll || ""}
                    onChange={(e) => handleChange("paperRoll", e.target.value)}
                    className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/60"
                  >
                    <option value="">اختر</option>
                    <option value="Yes">نعم</option>
                    <option value="No">لا</option>
                  </select>
                </div>

                {/* Failure Reason (conditional) */}
                {currentForm.installationStatus === "Not Completed" && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">سبب الفشل *</label>
                    <select
                      value={currentForm.responseReasonCode || ""}
                      onChange={(e) => handleChange("responseReasonCode", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/60"
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

          {/* Wizard Action Buttons */}
          <div className="flex items-center justify-between border-t border-slate-700/30 pt-4 mt-6">
            {phase === 1 ? (
              <>
                <div />
                <button
                  type="button"
                  onClick={handleNextPhase}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  التالي (بيانات التنفيذ)
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPhase(1)}
                  className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  السابق (بيانات التحقق)
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isDirty || mutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
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

      {/* Auto-deduction Info Banner */}
      {currentForm.installationStatus?.includes("Completed") && (
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">خصم تلقائي من المخزون والعهدة المسلسلة</p>
            <p className="text-xs text-emerald-400/70 mt-0.5">
              عند الحفظ بحالة "مكتمل"، سيتم خصم الأجهزة المُدخلة تلقائياً من عهدة الفني في منظومة المخزون العام وخصم الأرقام التسلسلية (SN/SIM) من عهدته المسلسلة النشطة (Scan-Out).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
