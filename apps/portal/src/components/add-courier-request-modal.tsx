import { useTranslation } from "@/lib/language";
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
  const { t } = useTranslation();
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
      toast({ title: t('courier.completed_save_successfully'), description: t('courier.completed_request_new_successf_1') });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courier/dashboard/stats"] });
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(newReq.id);
      }
    },
    onError: () => {
      toast({ title: t('courier.error'), description: t('courier.fail_save_verification'), variant: "destructive" });
    },
  });

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tid) {
      toast({ title: t('courier.alert'), description: t('courier.item_13106'), variant: "destructive" });
      return;
    }
    if (!form.customerName) {
      toast({ title: t('courier.alert'), description: t('courier.name_customer_3'), variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-white border-[1.5px] border-[rgba(24,178,176,0.28)] text-[#2D3135] p-0 shadow-[0_20px_50px_rgba(24,178,176,0.12)] rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-[rgba(24,178,176,0.16)] relative bg-[#F8FAFC]/80">
          <DialogTitle className="text-xl font-extrabold text-[#2D3135] flex items-center gap-2">
            {t('courier.add_request_new_1')}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6B7280] mt-1.5">
            {t('courier.data_customer_request_new')}
          </DialogDescription>
        </DialogHeader>

        {lookupsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#6B7280] gap-2">
            <Loader2 className="animate-spin w-8 h-8 text-[#18B2B0]" />
            <span className="text-sm">{t('courier.loading_1')}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-6">
              
              {/* Section 1: Basic Operational Data */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#18B2B0] uppercase tracking-wide flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  {t('courier.data_4')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.date_6')}</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => handleChange("date", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">TID *</label>
                    <input
                      type="text"
                      required
                      placeholder={t('courier.enter_tid_code')}
                      value={form.tid}
                      onChange={(e) => handleChange("tid", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">Terminal ID</label>
                    <input
                      type="text"
                      placeholder={t('courier.enter_terminal_id')}
                      value={form.terminalId}
                      onChange={(e) => handleChange("terminalId", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Customer Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#18B2B0] uppercase tracking-wide flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  {t('courier.data_customer_1')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.name_customer_2')}</label>
                    <input
                      type="text"
                      required
                      placeholder={t('courier.name_customer_received')}
                      value={form.customerName}
                      onChange={(e) => handleChange("customerName", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.name_2')}</label>
                    <input
                      type="text"
                      placeholder={t('courier.name_3')}
                      value={form.retailerName}
                      onChange={(e) => handleChange("retailerName", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.number_mobile_2')}</label>
                    <input
                      type="text"
                      required
                      placeholder="05xxxxxxxx"
                      value={form.mobile}
                      onChange={(e) => handleChange("mobile", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.number_mobile_3')}</label>
                    <input
                      type="text"
                      placeholder="05xxxxxxxx"
                      value={form.mobile2}
                      onChange={(e) => handleChange("mobile2", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.city_2')}</label>
                    <select
                      required
                      value={form.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0]"
                    >
                      <option value="">{t('courier.city_1')}</option>
                      {lookups?.cities.map((c) => (
                        <option key={c.id} value={c.name_en}>
                          {c.name_ar ? `${c.name_ar} (${c.name_en})` : c.name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.item_23936')}</label>
                  <textarea
                    placeholder={t('courier.delivery')}
                    value={form.addressAr}
                    onChange={(e) => handleChange("addressAr", e.target.value)}
                    rows={2}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0] resize-none"
                  />
                </div>
              </div>

              {/* Section 3: Technical / Hardware Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#18B2B0] uppercase tracking-wide flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5" />
                  {t('courier.data_devices')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.type')}</label>
                    <select
                      value={form.installationType}
                      onChange={(e) => handleChange("installationType", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0]"
                    >
                      <option value="New Install">{t('courier.new')}</option>
                      <option value="Replacement">{t('courier.item_12327')}</option>
                      <option value="Maintenance">{t('courier.maintenance')}</option>
                      <option value="Withdrawal">{t('courier.withdraw_device')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.type_device_1')}</label>
                    <select
                      value={form.vendorType}
                      onChange={(e) => handleChange("vendorType", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0]"
                    >
                      <option value="">{t('courier.item_27065')}</option>
                      {lookups?.vendorTypes.map((v) => (
                        <option key={v.id} value={v.name}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.type_sim_1')}</label>
                    <select
                      value={form.sim}
                      onChange={(e) => handleChange("sim", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0]"
                    >
                      <option value="">{t('courier.sim_2')}</option>
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
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.item_5051')}</label>
                    <input
                      type="text"
                      placeholder={t('courier.verification_4')}
                      value={form.otp}
                      onChange={(e) => handleChange("otp", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.number_4')}</label>
                    <input
                      type="text"
                      placeholder="Incident No."
                      value={form.incidentNumber}
                      onChange={(e) => handleChange("incidentNumber", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">TRSM</label>
                    <input
                      type="text"
                      placeholder="TRSM code"
                      value={form.trsm}
                      onChange={(e) => handleChange("trsm", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.item_5039')}</label>
                    <input
                      type="text"
                      placeholder="PIN code"
                      value={form.pinCode}
                      onChange={(e) => handleChange("pinCode", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.technician_admin')}</label>
                    <select
                      required
                      value={form.tecName}
                      onChange={(e) => handleChange("tecName", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0]"
                    >
                      <option value="">{t('courier.technician_3')}</option>
                      {lookups?.technicians.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6B7280] mb-1 font-medium">{t('courier.number_serial_7')}</label>
                    <input
                      type="text"
                      placeholder="ICCID Serial"
                      value={form.simSn}
                      onChange={(e) => handleChange("simSn", e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#2D3135] outline-none focus:border-[#18B2B0] font-mono"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-[#F8FAFC] hover:bg-[#4B5563] border border-[#E2E8F0] text-[#4B5563] hover:text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                {t('courier.cancel_undo_1')}
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex items-center gap-2 bg-[#18B2B0] hover:bg-[#149D9B] disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-[#18B2B0]/20 cursor-pointer"
              >
                {mutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {t('courier.save_request_1')}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
