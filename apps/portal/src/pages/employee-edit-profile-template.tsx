import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  BriefcaseBusiness,
  Car,
  FileImage,
  FileText,
  IdCard,
  ImagePlus,
  Save,
  Smartphone,
  SunMoon,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getRoleLabel } from "@shared/roles";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  getEmployeeProfileExtra,
  setEmployeeProfileExtra,
  type EmployeeStoredFile,
} from "@/lib/employee-profile-extra";
import type { RegionWithStats, UserSafe } from "@shared/schema";

type EditFormData = {
  fullName: string;
  nationalId: string;
  phoneNumber: string;
  birthDate: string;
  nationalIdExpiryDate: string;
  sponsorName: string;
  licenseExpiryDate: string;
  passportNumber: string;
  passportExpiryDate: string;
  nationality: string;
  absherNumber: string;
  qualification: string;
  jobTitle: string;
  employeeNumber: string;
  projectName: string;
  city: string;
  carPlateNumber: string;
  carType: string;
  carModel: string;
  carYear: string;
  phoneType: string;
  phoneSerial: string;
  businessPhoneNumber: string;
  simType: string;
};

const INITIAL_FORM_DATA: EditFormData = {
  fullName: "",
  nationalId: "",
  phoneNumber: "",
  birthDate: "",
  nationalIdExpiryDate: "",
  sponsorName: "",
  licenseExpiryDate: "",
  passportNumber: "",
  passportExpiryDate: "",
  nationality: "سعودي",
  absherNumber: "",
  qualification: "",
  jobTitle: "",
  employeeNumber: "",
  projectName: "",
  city: "",
  carPlateNumber: "",
  carType: "",
  carModel: "",
  carYear: "",
  phoneType: "",
  phoneSerial: "",
  businessPhoneNumber: "",
  simType: "eSIM",
};

function employeeCode(userId?: string | null): string {
  if (!userId) return "";
  return `SP-${userId.slice(0, 4).toUpperCase()}`;
}

const MAX_ATTACHMENT_SIZE_BYTES = 1.5 * 1024 * 1024;
const MAX_OTHER_FILES = 5;

function fileToStoredFile(file: File): Promise<EmployeeStoredFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("تعذر قراءة الملف"));
        return;
      }

      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: reader.result,
        uploadedAt: new Date().toISOString(),
      });
    };
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

export default function EmployeeEditProfileTemplatePage() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [formData, setFormData] = useState<EditFormData>(INITIAL_FORM_DATA);
  const [jobOfferFile, setJobOfferFile] = useState<EmployeeStoredFile | null>(null);
  const [promissoryNoteFile, setPromissoryNoteFile] = useState<EmployeeStoredFile | null>(null);
  const [carHandoverFile, setCarHandoverFile] = useState<EmployeeStoredFile | null>(null);
  const [otherFiles, setOtherFiles] = useState<EmployeeStoredFile[]>([]);

  const targetUserId = useMemo(() => {
    const queryString = location.includes("?") ? `?${location.split("?")[1]}` : "";
    const search = typeof window !== "undefined" ? window.location.search : queryString;
    const fromQuery = new URLSearchParams(search).get("userId");
    return fromQuery || authUser?.id || "";
  }, [authUser?.id, location]);

  const isEditingAnotherUser = !!targetUserId && !!authUser?.id && targetUserId !== authUser.id;

  const {
    data: selectedUser,
    isLoading: isLoadingSelectedUser,
    error: selectedUserError,
  } = useQuery<UserSafe>({
    queryKey: [`/api/users/${targetUserId}`],
    enabled: !!targetUserId,
  });

  const { data: regions = [] } = useQuery<RegionWithStats[]>({
    queryKey: ["/api/regions"],
    enabled: !!authUser,
  });

  const shownUser = isEditingAnotherUser ? selectedUser : selectedUser || authUser;

  const regionName = useMemo(() => {
    if (!shownUser?.regionId) return "";
    return regions.find((region) => region.id === shownUser.regionId)?.name || "";
  }, [regions, shownUser?.regionId]);

  useEffect(() => {
    if (!shownUser) return;

    const extra = getEmployeeProfileExtra(shownUser.id) || {};
    setJobOfferFile(extra.jobOfferFile || null);
    setPromissoryNoteFile(extra.promissoryNoteFile || null);
    setCarHandoverFile(extra.carHandoverFile || null);
    setOtherFiles(Array.isArray(extra.otherFiles) ? extra.otherFiles : []);

    setFormData((prev) => ({
      ...prev,
      ...extra,
      fullName: shownUser.fullName || "",
      city: shownUser.city || "",
      employeeNumber: employeeCode(shownUser.id),
      jobTitle: getRoleLabel(shownUser.role || ""),
      projectName: regionName ? `مشروع ${regionName}` : extra.projectName || prev.projectName,
    }));
  }, [regionName, shownUser]);

  const handleChange = (key: keyof EditFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validateFileSize = (file: File): boolean => {
    if (file.size <= MAX_ATTACHMENT_SIZE_BYTES) return true;

    toast({
      title: "حجم الملف كبير",
      description: `الحد الأقصى لكل ملف هو ${Math.floor(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024))}MB`,
      variant: "destructive",
    });
    return false;
  };

  const handleSingleFileUpload = async (
    fileList: FileList | null,
    setFile: (file: EmployeeStoredFile | null) => void,
  ) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!validateFileSize(file)) return;

    try {
      const stored = await fileToStoredFile(file);
      setFile(stored);
    } catch {
      toast({
        title: "فشل رفع الملف",
        description: "تعذر قراءة الملف. حاول مرة أخرى.",
        variant: "destructive",
      });
    }
  };

  const handleOtherFilesUpload = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;

    const validFiles = files.filter(validateFileSize).slice(0, MAX_OTHER_FILES);
    if (validFiles.length === 0) return;

    try {
      const storedFiles = await Promise.all(validFiles.map(fileToStoredFile));
      setOtherFiles(storedFiles);
    } catch {
      toast({
        title: "فشل رفع المرفقات",
        description: "تعذر قراءة بعض الملفات. حاول بملفات أصغر أو أقل عددًا.",
        variant: "destructive",
      });
    }
  };

  const updateEmployeeMutation = useMutation({
    mutationFn: async () => {
      if (!shownUser?.id) {
        throw new Error("لا يمكن تحديد الموظف المطلوب تحديثه");
      }

      const payload = {
        username: shownUser.username,
        email: shownUser.email,
        fullName: formData.fullName.trim(),
        role: shownUser.role,
        regionId: shownUser.regionId || undefined,
        isActive: shownUser.isActive,
        city: formData.city.trim() || undefined,
      };

      const response = await apiRequest("PATCH", `/api/users/${shownUser.id}`, payload);
      return (await response.json()) as UserSafe;
    },
    onSuccess: async (updatedUser) => {
      const extraSaved = setEmployeeProfileExtra(updatedUser.id, {
        nationalId: formData.nationalId,
        phoneNumber: formData.phoneNumber,
        birthDate: formData.birthDate,
        nationalIdExpiryDate: formData.nationalIdExpiryDate,
        sponsorName: formData.sponsorName,
        licenseExpiryDate: formData.licenseExpiryDate,
        passportNumber: formData.passportNumber,
        passportExpiryDate: formData.passportExpiryDate,
        nationality: formData.nationality,
        absherNumber: formData.absherNumber,
        qualification: formData.qualification,
        jobTitle: formData.jobTitle,
        employeeNumber: formData.employeeNumber,
        projectName: formData.projectName,
        city: formData.city,
        carPlateNumber: formData.carPlateNumber,
        carType: formData.carType,
        carModel: formData.carModel,
        carYear: formData.carYear,
        phoneType: formData.phoneType,
        phoneSerial: formData.phoneSerial,
        businessPhoneNumber: formData.businessPhoneNumber,
        simType: formData.simType,
        jobOfferFile,
        promissoryNoteFile,
        carHandoverFile,
        otherFiles,
      });

      if (!extraSaved) {
        toast({
          title: "تم حفظ البيانات الأساسية فقط",
          description: "تعذر حفظ بعض المرفقات محليًا. قلل حجم الملفات ثم حاول مرة أخرى.",
          variant: "destructive",
        });
      }

      queryClient.setQueryData([`/api/users/${updatedUser.id}`], updatedUser);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
        queryClient.invalidateQueries({ queryKey: [`/api/users/${updatedUser.id}`] }),
      ]);

      if (authUser?.id === updatedUser.id) {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }

      toast({
        title: "تم الحفظ بنجاح",
        description: "تم تحديث بيانات الموظف.",
      });

      setLocation(`/employee-detailed-profile-template?userId=${updatedUser.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "تعذر حفظ البيانات",
        description: error?.message || "حدث خطأ أثناء حفظ بيانات الموظف.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!formData.fullName.trim()) {
      toast({
        title: "الاسم الكامل مطلوب",
        description: "يرجى إدخال الاسم الكامل قبل الحفظ.",
        variant: "destructive",
      });
      return;
    }

    updateEmployeeMutation.mutate();
  };

  const handleCancel = () => {
    const userId = shownUser?.id || targetUserId;
    setLocation(`/employee-detailed-profile-template?userId=${userId}`);
  };

  if (isEditingAnotherUser && isLoadingSelectedUser) {
    return (
      <div className="min-h-screen bg-[#0f2323] text-slate-100 flex items-center justify-center" dir="rtl">
        <p className="text-sm text-slate-300">جاري تحميل بيانات الموظف للتعديل...</p>
      </div>
    );
  }

  if (isEditingAnotherUser && selectedUserError) {
    return (
      <div className="min-h-screen bg-[#0f2323] text-slate-100 flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <p className="text-sm text-rose-300">تعذر تحميل بيانات الموظف المطلوب للتعديل.</p>
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg bg-cyan-400 text-[#0f2323] font-bold"
          >
            العودة لصفحة الملف
          </button>
        </div>
      </div>
    );
  }

  if (!shownUser) {
    return (
      <div className="min-h-screen bg-[#0f2323] text-slate-100 flex items-center justify-center" dir="rtl">
        <p className="text-sm text-slate-300">لا يمكن العثور على بيانات موظف للتعديل.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f2323] text-slate-100 min-h-full" dir="rtl">
      <div className="border-b border-slate-700/50 bg-[#0f2323]/80 backdrop-blur-md px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold">تعديل بينات الموظف</h2>
          <span className="text-slate-500">/</span>
          <span className="text-sm text-cyan-300">الموارد البشرية</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="size-8 rounded-full flex items-center justify-center bg-slate-800 text-slate-300 hover:text-cyan-300 transition-colors">
            <SunMoon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-8 space-y-8 max-w-6xl mx-auto w-full pb-32">
        <div className="bg-[#1a2e2e]/50 rounded-2xl p-8 border border-slate-700/60">
          <div className="flex items-center gap-4 mb-8">
            <div className="size-10 rounded-lg bg-cyan-300/20 flex items-center justify-center text-cyan-300">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">1. المعلومات الشخصية</h3>
              <p className="text-slate-400 text-sm">يرجى إدخال البيانات الشخصية الرسمية للموظف</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Field label="الاسم الكامل" value={formData.fullName} onChange={(v) => handleChange("fullName", v)} placeholder="مثال: محمد أحمد علي" />
            <Field label="رقم الهوية / الإقامة" value={formData.nationalId} onChange={(v) => handleChange("nationalId", v)} placeholder="10XXXXXXXX" />
            <Field label="رقم التواصل" value={formData.phoneNumber} onChange={(v) => handleChange("phoneNumber", v)} placeholder="05XXXXXXXX" type="tel" />

            <Field label="تاريخ الميلاد" value={formData.birthDate} onChange={(v) => handleChange("birthDate", v)} type="date" />
            <Field label="تاريخ انتهاء الهوية" value={formData.nationalIdExpiryDate} onChange={(v) => handleChange("nationalIdExpiryDate", v)} type="date" />
            <Field label="اسم الكفيل" value={formData.sponsorName} onChange={(v) => handleChange("sponsorName", v)} />

            <Field label="تاريخ انتهاء الرخصة" value={formData.licenseExpiryDate} onChange={(v) => handleChange("licenseExpiryDate", v)} type="date" />
            <Field label="رقم الجواز" value={formData.passportNumber} onChange={(v) => handleChange("passportNumber", v)} />
            <Field label="تاريخ انتهاء الجواز" value={formData.passportExpiryDate} onChange={(v) => handleChange("passportExpiryDate", v)} type="date" />

            <SelectField
              label="الجنسية"
              value={formData.nationality}
              onChange={(v) => handleChange("nationality", v)}
              options={["سعودي", "مصري", "باكستاني", "آخر"]}
            />
            <Field label="رقم خدمات أبشر" value={formData.absherNumber} onChange={(v) => handleChange("absherNumber", v)} />
            <Field
              label="المؤهلات العلمية"
              value={formData.qualification}
              onChange={(v) => handleChange("qualification", v)}
              placeholder="بكالوريوس، ماجستير..."
            />
          </div>
        </div>

        <div className="bg-[#1a2e2e]/50 rounded-2xl p-8 border border-slate-700/60">
          <div className="flex items-center gap-4 mb-8">
            <div className="size-10 rounded-lg bg-cyan-300/20 flex items-center justify-center text-cyan-300">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">2. المعلومات الوظيفية</h3>
              <p className="text-slate-400 text-sm">بيانات التعاقد والموقع الوظيفي والمرفقات</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Field label="المسمى الوظيفي" value={formData.jobTitle} onChange={(v) => handleChange("jobTitle", v)} />
            <Field label="الرقم الوظيفي" value={formData.employeeNumber} onChange={(v) => handleChange("employeeNumber", v)} />
            <Field label="المشروع" value={formData.projectName} onChange={(v) => handleChange("projectName", v)} />
            <Field label="المدينة" value={formData.city} onChange={(v) => handleChange("city", v)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <UploadCard
              title="صورة العرض الوظيفي"
              subtitle="اختر صورة أو PDF"
              icon={FileImage}
              selectedFiles={jobOfferFile ? [jobOfferFile.name] : []}
              onFilesSelected={(files) => {
                void handleSingleFileUpload(files, setJobOfferFile);
              }}
              onClear={() => setJobOfferFile(null)}
              accept="image/*,.pdf"
            />
            <UploadCard
              title="صورة السند لأمر"
              subtitle="اختر صورة أو PDF"
              icon={FileText}
              selectedFiles={promissoryNoteFile ? [promissoryNoteFile.name] : []}
              onFilesSelected={(files) => {
                void handleSingleFileUpload(files, setPromissoryNoteFile);
              }}
              onClear={() => setPromissoryNoteFile(null)}
              accept="image/*,.pdf"
            />
            <UploadCard
              title="صور أخرى"
              subtitle="حتى 5 مرفقات"
              icon={ImagePlus}
              multiple
              selectedFiles={otherFiles.map((file) => file.name)}
              onFilesSelected={(files) => {
                void handleOtherFilesUpload(files);
              }}
              onClear={() => setOtherFiles([])}
              accept="image/*,.pdf"
            />
          </div>
        </div>

        <div className="bg-[#1a2e2e]/50 rounded-2xl p-8 border border-slate-700/60">
          <div className="flex items-center gap-4 mb-8">
            <div className="size-10 rounded-lg bg-cyan-300/20 flex items-center justify-center text-cyan-300">
              <IdCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">3. قسم العهد</h3>
              <p className="text-slate-400 text-sm">تفاصيل الأصول والعهد المسلمة للموظف</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-700/60 pb-4">
                <Car className="h-5 w-5 text-cyan-300" />
                <h4 className="font-bold">عهدة السيارة</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SmallField label="رقم اللوحة" value={formData.carPlateNumber} onChange={(v) => handleChange("carPlateNumber", v)} />
                <SmallField label="نوع السيارة" value={formData.carType} onChange={(v) => handleChange("carType", v)} />
                <SmallField label="الموديل" value={formData.carModel} onChange={(v) => handleChange("carModel", v)} />
                <SmallField label="إصدار السيارة" value={formData.carYear} onChange={(v) => handleChange("carYear", v)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">نموذج الاستلام والتسليم</label>
                <label className="flex items-center gap-3 w-full p-2 border border-dashed border-slate-700 rounded-lg cursor-pointer hover:bg-slate-700/30 transition-all">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-xs text-slate-400 truncate">
                    {carHandoverFile?.name || "تحميل المستند"}
                  </span>
                  <input
                    className="hidden"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) => {
                      void handleSingleFileUpload(event.target.files, setCarHandoverFile);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {carHandoverFile && (
                  <button
                    type="button"
                    onClick={() => setCarHandoverFile(null)}
                    className="text-[11px] text-rose-300 hover:text-rose-200"
                  >
                    حذف المرفق
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-700/60 pb-4">
                <Smartphone className="h-5 w-5 text-cyan-300" />
                <h4 className="font-bold">عهدة الجوال</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SmallField label="نوع الجوال" value={formData.phoneType} onChange={(v) => handleChange("phoneType", v)} />
                <SmallField label="السيريال (IMEI)" value={formData.phoneSerial} onChange={(v) => handleChange("phoneSerial", v)} />
                <SmallField label="رقم العمل" value={formData.businessPhoneNumber} onChange={(v) => handleChange("businessPhoneNumber", v)} type="tel" />
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">نوع الشريحة</label>
                  <select
                    value={formData.simType}
                    onChange={(event) => handleChange("simType", event.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-cyan-300 outline-none"
                  >
                    <option>eSIM</option>
                    <option>Physical SIM</option>
                    <option>Both</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-[#0f2323]/90 backdrop-blur-xl border-t border-slate-700/60 p-6 flex justify-end gap-6 z-20 shadow-2xl">
        <button
          onClick={handleCancel}
          type="button"
          className="px-8 py-3 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-all font-bold text-sm tracking-wide inline-flex items-center gap-2"
        >
          <X className="h-4 w-4" />
          إلغاء العملية
        </button>
        <button
          onClick={handleSave}
          type="button"
          disabled={updateEmployeeMutation.isPending}
          className="px-12 py-3 rounded-xl bg-cyan-300 text-slate-900 font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(6,249,249,0.4)] hover:shadow-[0_0_30px_rgba(6,249,249,0.6)] active:scale-95 transition-all inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          {updateEmployeeMutation.isPending ? "جاري الحفظ..." : "حفظ بيانات الموظف"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300 outline-none transition-all placeholder:text-slate-600"
        placeholder={placeholder}
        type={type}
      />
    </div>
  );
}

function SmallField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-slate-400">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-cyan-300 outline-none"
        type={type}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300 outline-none transition-all"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function UploadCard({
  title,
  subtitle,
  icon: Icon,
  selectedFiles,
  onFilesSelected,
  onClear,
  accept,
  multiple = false,
}: {
  title: string;
  subtitle: string;
  icon: typeof FileImage;
  selectedFiles: string[];
  onFilesSelected: (files: FileList | null) => void;
  onClear: () => void;
  accept?: string;
  multiple?: boolean;
}) {
  return (
    <div className="relative group">
      <p className="text-sm font-medium text-slate-300 mb-3">{title}</p>
      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/30 hover:bg-slate-800/60 hover:border-cyan-300/50 transition-all cursor-pointer">
        <Icon className="h-8 w-8 text-slate-500 group-hover:text-cyan-300 transition-colors" />
        <span className="text-xs text-slate-400 mt-2">{subtitle}</span>
        {selectedFiles.length > 0 && (
          <span className="mt-2 text-[11px] text-emerald-300 max-w-[90%] truncate">
            {multiple ? `${selectedFiles.length} مرفق` : selectedFiles[0]}
          </span>
        )}
        <input
          className="hidden"
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={(event) => {
            onFilesSelected(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {selectedFiles.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 text-[11px] text-rose-300 hover:text-rose-200"
        >
          حذف المرفقات
        </button>
      )}
    </div>
  );
}
