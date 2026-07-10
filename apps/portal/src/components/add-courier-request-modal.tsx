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
  X
} from "lucide-react";

interface Lookups {
  cities: { id: number; name_ar: string; name_en: string }[];
  simTypes: { id: number; name: string }[];
  vendorTypes: { id: number; name: string }[];
  technicians: { id: string; code: string; name: string }[];
}

export function AddCourierRequestModal({
  open,
  onOpenChange,
  onSuccess
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newReqId: number) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lookups, isLoading: lookupsLoading } = useQuery<Lookups>({
    queryKey: ["/api/courier/lookups"],
    queryFn: () => apiRequest("GET", "/api/courier/lookups").then((r) => r.json()),
    enabled: open
  });

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    tid: "",
    terminalId: "",
    customerName: "",
    retailerName: "",
    city: "",
    addressAr: "",
    mobile: "",
    mobile2: "",
    tecName: "",
    installationType: "New Install",
    vendorType: "",
    sim: "",
    otp: "",
    incidentNumber: "",
    trsm: "",
    pinCode: "",
    simSn: ""
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm({
        date: new Date().toISOString().slice(0, 10),
        tid: "",
        terminalId: "",
        customerName: "",
        retailerName: "",
        city: "",
        addressAr: "",
        mobile: "",
        mobile2: "",
        tecName: "",
        installationType: "New Install",
        vendorType: "",
        sim: "",
        otp: "",
        incidentNumber: "",
        trsm: "",
        pinCode: "",
        simSn: ""
      });
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiRequest("POST", "/api/courier/requests", data).then((r) => r.json()),
    onSuccess: (newReq) => {
      toast({ title: "تم الحفظ بنجاح", description: "تم إنشاء الطلب الجديد بنجاح." });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/dashboard/stats"] });
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(newReq.id);
      }
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حفظ البيانات، يرجى التحقق من المدخلات والمحاولة مجدداً.", variant: "destructive" });
    },
  });

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tid) {
      toast({ title: "تنبيه", description: "حقل TID مطلوب.", variant: "destructive" });
      return;
    }
    if (!form.customerName) {
      toast({ title: "تنبيه", description: "حقل اسم العميل مطلوب.", variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-[#142d2d] border border-slate-700/60 text-slate-100 p-0 shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-slate-700/40 relative">
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            👤 إضافة طلب تحقق ميداني جديد
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 mt-1.5">
            قم بتعبئة بيانات العميل والتفاصيل التقنية لإنشاء طلب تشغيلي جديد.
          </DialogDescription>
        </DialogHeader>

        {lookupsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 className="animate-spin w-8 h-8 text-emerald-450" />
            <span className="text-sm">جاري تحميل قوائم التهيئة...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-6">
              
              {/* Section 1: Basic Operational Data */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wide flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  البيانات التشغيلية الأساسية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">التاريخ *</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => handleChange("date", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">TID *</label>
                    <input
                      type="text"
                      required
                      placeholder="أدخل رمز الـ TID"
                      value={form.tid}
                      onChange={(e) => handleChange("tid", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">Terminal ID</label>
                    <input
                      type="text"
                      placeholder="أدخل معرف الـ Terminal"
                      value={form.terminalId}
                      onChange={(e) => handleChange("terminalId", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Customer Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wide flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  بيانات العميل والتاجر
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">اسم العميل *</label>
                    <input
                      type="text"
                      required
                      placeholder="اسم العميل المستلم"
                      value={form.customerName}
                      onChange={(e) => handleChange("customerName", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">اسم المتجر / التاجر</label>
                    <input
                      type="text"
                      placeholder="اسم المحل التجاري"
                      value={form.retailerName}
                      onChange={(e) => handleChange("retailerName", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">رقم الجوال *</label>
                    <input
                      type="text"
                      required
                      placeholder="05xxxxxxxx"
                      value={form.mobile}
                      onChange={(e) => handleChange("mobile", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">رقم جوال بديل</label>
                    <input
                      type="text"
                      placeholder="05xxxxxxxx"
                      value={form.mobile2}
                      onChange={(e) => handleChange("mobile2", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">المدينة *</label>
                    <select
                      required
                      value={form.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                    >
                      <option value="">اختر المدينة</option>
                      {lookups?.cities.map((c) => (
                        <option key={c.id} value={c.name_en}>
                          {c.name_ar ? `${c.name_ar} (${c.name_en})` : c.name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-medium">العنوان بالتفصيل</label>
                  <textarea
                    placeholder="أدخل عنوان التوصيل بالتفصيل..."
                    value={form.addressAr}
                    onChange={(e) => handleChange("addressAr", e.target.value)}
                    rows={2}
                    className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 resize-none"
                  />
                </div>
              </div>

              {/* Section 3: Technical / Hardware Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wide flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5" />
                  بيانات الأجهزة والشبكة والربط
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">نوع التركيب</label>
                    <select
                      value={form.installationType}
                      onChange={(e) => handleChange("installationType", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                    >
                      <option value="New Install">تركيب جديد (New Install)</option>
                      <option value="Replacement">استبدال (Replacement)</option>
                      <option value="Maintenance">صيانة (Maintenance)</option>
                      <option value="Withdrawal">سحب جهاز (Withdrawal)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">نوع الجهاز / الشركة المصنعة</label>
                    <select
                      value={form.vendorType}
                      onChange={(e) => handleChange("vendorType", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                    >
                      <option value="">اختر الشركة المصنعة</option>
                      {lookups?.vendorTypes.map((v) => (
                        <option key={v.id} value={v.name}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">نوع شريحة الاتصال</label>
                    <select
                      value={form.sim}
                      onChange={(e) => handleChange("sim", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                    >
                      <option value="">اختر مشغل الشريحة</option>
                      {lookups?.simTypes.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">رمز OTP</label>
                    <input
                      type="text"
                      placeholder="رمز التحقق"
                      value={form.otp}
                      onChange={(e) => handleChange("otp", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">رقم الحادثة / التذكرة</label>
                    <input
                      type="text"
                      placeholder="Incident No."
                      value={form.incidentNumber}
                      onChange={(e) => handleChange("incidentNumber", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">TRSM</label>
                    <input
                      type="text"
                      placeholder="TRSM code"
                      value={form.trsm}
                      onChange={(e) => handleChange("trsm", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">رمز PIN</label>
                    <input
                      type="text"
                      placeholder="PIN code"
                      value={form.pinCode}
                      onChange={(e) => handleChange("pinCode", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">الفني المسؤول (التعيين) *</label>
                    <select
                      required
                      value={form.tecName}
                      onChange={(e) => handleChange("tecName", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60"
                    >
                      <option value="">اختر الفني</option>
                      {lookups?.technicians.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">الرقم التسلسلي لشريحة SIM المقترحة</label>
                    <input
                      type="text"
                      placeholder="ICCID Serial"
                      value={form.simSn}
                      onChange={(e) => handleChange("simSn", e.target.value)}
                      className="w-full bg-[#102222] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/60 font-mono"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/40">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                إلغاء التراجع
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-emerald-500/10 cursor-pointer"
              >
                {mutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                حفظ وإنشاء الطلب
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
