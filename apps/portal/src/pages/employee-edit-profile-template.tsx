import { useTranslation } from "@/lib/language";
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
  nationality: "",
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

function fileToStoredFile(file: File, t: (key: string) => string): Promise<EmployeeStoredFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(t('users.file_2')));
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
    reader.onerror = () => reject(new Error(t('users.file_2')));
    reader.readAsDataURL(file);
  });
}

export default function EmployeeEditProfileTemplatePage() {
  const { t, dir } = useTranslation();
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [formData, setFormData] = useState<EditFormData>(() => ({
    ...INITIAL_FORM_DATA,
    nationality: t('users.item_7981')
  }));
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
      projectName: regionName ? t('users.item_8979', { var_0: regionName }) : extra.projectName || prev.projectName,
    }));
  }, [regionName, shownUser]);

  const handleChange = (key: keyof EditFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validateFileSize = (file: File): boolean => {
    if (file.size <= MAX_ATTACHMENT_SIZE_BYTES) return true;

    toast({
      title: t('users.size_file'),
      description: t('users.file_4', { var_0: Math.floor(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)) }),
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
      const stored = await fileToStoredFile(file, t);
      setFile(stored);
    } catch {
      toast({
        title: t('users.fail_file'),
        description: t('users.file_other'),
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
      const storedFiles = await Promise.all(validFiles.map((f) => fileToStoredFile(f, t)));
      setOtherFiles(storedFiles);
    } catch {
      toast({
        title: t('users.fail'),
        description: t('users.files'),
        variant: "destructive",
      });
    }
  };

  const updateEmployeeMutation = useMutation({
    mutationFn: async () => {
      if (!shownUser?.id) {
        throw new Error(t('users.no_2'));
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
          title: t('users.completed_save_data'),
          description: t('users.save_size_files_other'),
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
        title: t('users.completed_save_successfully'),
        description: t('users.completed_update_data'),
      });

      setLocation(`/employee-detailed-profile-template?userId=${updatedUser.id}`);
    },
    onError: (error: any) => {
      toast({
        title: t('users.save_data'),
        description: error?.message || t('users.error_save_data'),
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!formData.fullName.trim()) {
      toast({
        title: t('users.name_2'),
        description: t('users.submit_name_save'),
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
      <div className="min-h-screen bg-[#0f2323] text-slate-100 flex items-center justify-center" dir={dir}>
        <p className="text-sm text-slate-300">{t('users.loading_data_1')}</p>
      </div>
    );
  }

  if (isEditingAnotherUser && selectedUserError) {
    return (
      <div className="min-h-screen bg-[#0f2323] text-slate-100 flex items-center justify-center" dir={dir}>
        <div className="text-center space-y-4">
          <p className="text-sm text-rose-300">{t('users.loading_data_2')}</p>
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg bg-cyan-400 text-[#0f2323] font-bold"
          >
            {t('users.file_1')}
          </button>
        </div>
      </div>
    );
  }

  if (!shownUser) {
    return (
      <div className="min-h-screen bg-[#0f2323] text-slate-100 flex items-center justify-center" dir={dir}>
        <p className="text-sm text-slate-300">{t('users.no_data_1')}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f2323] text-slate-100 min-h-full" dir={dir}>
      <div className="border-b border-slate-700/50 bg-[#0f2323]/80 backdrop-blur-md px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold">{t('users.edit')}</h2>
          <span className="text-slate-500">/</span>
          <span className="text-sm text-cyan-300">{t('users.item_22282')}</span>
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
              <h3 className="text-xl font-bold">{t('users.info_2')}</h3>
              <p className="text-slate-400 text-sm">{t('users.submit_data')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Field label={t('users.name')} value={formData.fullName} onChange={(v) => handleChange("fullName", v)} placeholder={t('users.item_24038')} />
            <Field label={t('users.number_10')} value={formData.nationalId} onChange={(v) => handleChange("nationalId", v)} placeholder="10XXXXXXXX" />
            <Field label={t('users.number_3')} value={formData.phoneNumber} onChange={(v) => handleChange("phoneNumber", v)} placeholder="05XXXXXXXX" type="tel" />

            <Field label={t('users.date')} value={formData.birthDate} onChange={(v) => handleChange("birthDate", v)} type="date" />
            <Field label={t('users.date_1')} value={formData.nationalIdExpiryDate} onChange={(v) => handleChange("nationalIdExpiryDate", v)} type="date" />
            <Field label={t('users.name_1')} value={formData.sponsorName} onChange={(v) => handleChange("sponsorName", v)} />

            <Field label={t('users.date_2')} value={formData.licenseExpiryDate} onChange={(v) => handleChange("licenseExpiryDate", v)} type="date" />
            <Field label={t('users.number_1')} value={formData.passportNumber} onChange={(v) => handleChange("passportNumber", v)} />
            <Field label={t('users.date_3')} value={formData.passportExpiryDate} onChange={(v) => handleChange("passportExpiryDate", v)} type="date" />

            <SelectField
              label={t('users.item_11139')}
              value={formData.nationality}
              onChange={(v) => handleChange("nationality", v)}
              options={[t('users.item_7981'), t('users.item_6389'), t('users.item_12710'), t('users.item_4737')]}
            />
            <Field label={t('users.number_4')} value={formData.absherNumber} onChange={(v) => handleChange("absherNumber", v)} />
            <Field
              label={t('users.item_23920')}
              value={formData.qualification}
              onChange={(v) => handleChange("qualification", v)}
              placeholder={t('users.item_27194')}
            />
          </div>
        </div>

        <div className="bg-[#1a2e2e]/50 rounded-2xl p-8 border border-slate-700/60">
          <div className="flex items-center gap-4 mb-8">
            <div className="size-10 rounded-lg bg-cyan-300/20 flex items-center justify-center text-cyan-300">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{t('users.info_3')}</h3>
              <p className="text-slate-400 text-sm">{t('users.data_2')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Field label={t('users.item_20817')} value={formData.jobTitle} onChange={(v) => handleChange("jobTitle", v)} />
            <Field label={t('users.number_5')} value={formData.employeeNumber} onChange={(v) => handleChange("employeeNumber", v)} />
            <Field label={t('users.item_11158')} value={formData.projectName} onChange={(v) => handleChange("projectName", v)} />
            <Field label={t('users.city')} value={formData.city} onChange={(v) => handleChange("city", v)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <UploadCard
              title={t('users.image_view')}
              subtitle={t('users.image_4')}
              icon={FileImage}
              selectedFiles={jobOfferFile ? [jobOfferFile.name] : []}
              onFilesSelected={(files) => {
                void handleSingleFileUpload(files, setJobOfferFile);
              }}
              onClear={() => setJobOfferFile(null)}
              accept="image/*,.pdf"
            />
            <UploadCard
              title={t('users.image_voucher')}
              subtitle={t('users.image_4')}
              icon={FileText}
              selectedFiles={promissoryNoteFile ? [promissoryNoteFile.name] : []}
              onFilesSelected={(files) => {
                void handleSingleFileUpload(files, setPromissoryNoteFile);
              }}
              onClear={() => setPromissoryNoteFile(null)}
              accept="image/*,.pdf"
            />
            <UploadCard
              title={t('users.images_other')}
              subtitle={t('users.item_14431')}
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
              <h3 className="text-xl font-bold">{t('users.item_12917')}</h3>
              <p className="text-slate-400 text-sm">{t('users.details')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-700/60 pb-4">
                <Car className="h-5 w-5 text-cyan-300" />
                <h4 className="font-bold">{t('users.item_17505')}</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SmallField label={t('users.number_dashboard')} value={formData.carPlateNumber} onChange={(v) => handleChange("carPlateNumber", v)} />
                <SmallField label={t('users.type')} value={formData.carType} onChange={(v) => handleChange("carType", v)} />
                <SmallField label={t('users.item_11189')} value={formData.carModel} onChange={(v) => handleChange("carModel", v)} />
                <SmallField label={t('users.item_19050')} value={formData.carYear} onChange={(v) => handleChange("carYear", v)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">{t('users.receive')}</label>
                <label className="flex items-center gap-3 w-full p-2 border border-dashed border-slate-700 rounded-lg cursor-pointer hover:bg-slate-700/30 transition-all">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-xs text-slate-400 truncate">
                    {carHandoverFile?.name || t('users.loading_document')}
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
                    {t('users.delete_3')}
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-700/60 pb-4">
                <Smartphone className="h-5 w-5 text-cyan-300" />
                <h4 className="font-bold">{t('users.mobile')}</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SmallField label={t('users.type_mobile')} value={formData.phoneType} onChange={(v) => handleChange("phoneType", v)} />
                <SmallField label={t('users.serial')} value={formData.phoneSerial} onChange={(v) => handleChange("phoneSerial", v)} />
                <SmallField label={t('users.number_6')} value={formData.businessPhoneNumber} onChange={(v) => handleChange("businessPhoneNumber", v)} type="tel" />
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">{t('users.type_sim')}</label>
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
          {t('users.cancel_operation')}
        </button>
        <button
          onClick={handleSave}
          type="button"
          disabled={updateEmployeeMutation.isPending}
          className="px-12 py-3 rounded-xl bg-cyan-300 text-slate-900 font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(6,249,249,0.4)] hover:shadow-[0_0_30px_rgba(6,249,249,0.6)] active:scale-95 transition-all inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          {updateEmployeeMutation.isPending ? t('users.save') : t('users.save_data_1')}
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
  const { t } = useTranslation();
  return (
    <div className="relative group">
      <p className="text-sm font-medium text-slate-300 mb-3">{title}</p>
      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/30 hover:bg-slate-800/60 hover:border-cyan-300/50 transition-all cursor-pointer">
        <Icon className="h-8 w-8 text-slate-500 group-hover:text-cyan-300 transition-colors" />
        <span className="text-xs text-slate-400 mt-2">{subtitle}</span>
        {selectedFiles.length > 0 && (
          <span className="mt-2 text-[11px] text-emerald-300 max-w-[90%] truncate">
            {multiple ? t('users.item_7393', { var_0: selectedFiles.length }) : selectedFiles[0]}
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
          {t('users.delete_1')}
        </button>
      )}
    </div>
  );
}
