import { useTranslation } from "@/lib/language";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Badge,
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
  Car,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  Smartphone,
  User,
  Warehouse,
  X,
  ZoomIn,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getRoleLabel } from "@shared/roles";
import type { EmployeeProfileResponse, EmployeeStoredFile } from "@/lib/employee-profile-extra";
import {
  exportEmployeeProfileToExcel,
  exportEmployeeProfileToPdf,
} from "@/lib/export-employee-profile";
import type {
  RegionWithStats,
  TechnicianFixedInventoryEntry,
  TechnicianMovingInventoryEntry,
} from "@shared/schema";

type GalleryDoc = {
  id: string;
  label: string;
  file: EmployeeStoredFile;
};

function formatDate(value?: string | Date | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function employeeCode(userId?: string | null): string {
  if (!userId) return "-";
  return `SP-${userId.slice(0, 4).toUpperCase()}`;
}

function isImageAttachment(file?: { type?: string; name?: string } | null): boolean {
  if (!file) return false;
  if (file.type?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name || "");
}

const brand = {
  primary: "#18B2B0",
  primaryHover: "#149D9B",
  bg: "#F8FAFB",
  card: "#FFFFFF",
  text: "#2D3135",
  muted: "#6B7280",
  border: "#E6E8EC",
  warning: "#F4B740",
  danger: "#E05252",
  success: "#18B2B0",
} as const;

export default function EmployeeDetailedProfileTemplatePage() {
  const { t, dir } = useTranslation();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [location] = useLocation();
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const targetUserId = useMemo(() => {
    const queryString = location.includes("?") ? `?${location.split("?")[1]}` : "";
    const search = typeof window !== "undefined" ? window.location.search : queryString;
    const fromQuery = new URLSearchParams(search).get("userId");
    return fromQuery || authUser?.id || "";
  }, [authUser?.id, location]);

  const isViewingAnotherUser = !!targetUserId && !!authUser?.id && targetUserId !== authUser.id;

  const {
    data: profileResponse,
    isLoading: isLoadingUser,
    error: selectedUserError,
  } = useQuery<EmployeeProfileResponse>({
    queryKey: [`/api/users/${targetUserId}/employee-profile`],
    enabled: !!targetUserId,
  });

  const { data: regions = [] } = useQuery<RegionWithStats[]>({
    queryKey: ["/api/regions"],
    enabled: !!authUser,
  });

  const selectedUser = profileResponse?.user;
  const shownUser = isViewingAnotherUser ? selectedUser : selectedUser || authUser;
  const shownUserId = shownUser?.id;
  const extraProfile = profileResponse?.profile || null;

  const fixedEntriesQuery = useQuery<TechnicianFixedInventoryEntry[]>({
    queryKey: [`/api/technicians/${shownUserId}/fixed-inventory-entries`],
    enabled: !!shownUserId && shownUser?.role === "technician",
  });

  const movingEntriesQuery = useQuery<TechnicianMovingInventoryEntry[]>({
    queryKey: [`/api/technicians/${shownUserId}/moving-inventory-entries`],
    enabled: !!shownUserId && shownUser?.role === "technician",
  });

  const fixedEntries = Array.isArray(fixedEntriesQuery.data) ? fixedEntriesQuery.data : [];
  const movingEntries = Array.isArray(movingEntriesQuery.data) ? movingEntriesQuery.data : [];

  const regionName = useMemo(() => {
    if (!shownUser?.regionId) return t("users.item_11173");
    return regions.find((region) => region.id === shownUser.regionId)?.name || t("users.item_11173");
  }, [regions, shownUser?.regionId, t]);

  const roleLabel = extraProfile?.jobTitle || getRoleLabel(shownUser?.role || "");
  const isActive = !!shownUser?.isActive;
  const jobOfferFile = extraProfile?.jobOfferFile || null;
  const promissoryNoteFile = extraProfile?.promissoryNoteFile || null;
  const carHandoverFile = extraProfile?.carHandoverFile || null;
  const otherFiles = Array.isArray(extraProfile?.otherFiles) ? extraProfile.otherFiles : [];

  const workDocuments = useMemo<GalleryDoc[]>(() => {
    const docs: GalleryDoc[] = [];
    if (jobOfferFile?.dataUrl) {
      docs.push({ id: "job-offer", label: t("users.image_view"), file: jobOfferFile });
    }
    if (promissoryNoteFile?.dataUrl) {
      docs.push({ id: "promissory", label: "سند لأمر", file: promissoryNoteFile });
    }
    if (carHandoverFile?.dataUrl) {
      docs.push({ id: "car-handover", label: t("users.loading_receive"), file: carHandoverFile });
    }
    otherFiles.forEach((file, index) => {
      if (!file?.dataUrl) return;
      docs.push({
        id: `other-${index}-${file.name}`,
        label: file.name || `${t("users.other")}${index + 1}`,
        file,
      });
    });
    return docs;
  }, [carHandoverFile, jobOfferFile, otherFiles, promissoryNoteFile, t]);

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const buildExportPayload = () => {
    if (!shownUser) return null;
    return {
      user: {
        id: shownUser.id,
        fullName: shownUser.fullName,
        username: shownUser.username,
        email: shownUser.email,
        city: shownUser.city,
        role: shownUser.role,
        profileImage: shownUser.profileImage,
        isActive: shownUser.isActive,
        createdAt: shownUser.createdAt,
        updatedAt: shownUser.updatedAt,
        employeeCode: shownUser.employeeCode,
        technicianCode: shownUser.technicianCode,
      },
      profile: extraProfile,
      roleLabel,
      regionName,
      employeeNumber: extraProfile?.employeeNumber || employeeCode(shownUser.id),
      documents: workDocuments,
    };
  };

  const handleExportExcel = async () => {
    const payload = buildExportPayload();
    if (!payload) return;
    try {
      setExporting("excel");
      await exportEmployeeProfileToExcel(payload);
      toast({ title: "تم تصدير Excel بنجاح" });
    } catch (error) {
      toast({
        title: "تعذر تصدير Excel",
        description: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    const payload = buildExportPayload();
    if (!payload) return;
    try {
      setExporting("pdf");
      await exportEmployeeProfileToPdf(payload);
      toast({ title: "تم تصدير PDF بنجاح" });
    } catch (error) {
      toast({
        title: "تعذر تصدير PDF",
        description: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const personalInfoRows = [
    { label: t("users.name"), value: shownUser?.fullName || "-" },
    { label: t("users.number"), value: extraProfile?.nationalId || shownUser?.id || "-" },
    { label: t("users.number_mobile"), value: extraProfile?.phoneNumber || shownUser?.username || "-", accent: true },
    { label: t("users.date"), value: extraProfile?.birthDate || formatDate(shownUser?.createdAt) },
    { label: t("users.item_19123"), value: extraProfile?.nationalIdExpiryDate || formatDate(shownUser?.updatedAt), danger: true },
    { label: t("users.name_1"), value: extraProfile?.sponsorName || shownUser?.email || "-" },
    { label: t("users.item_19054"), value: extraProfile?.licenseExpiryDate || "-" },
    { label: t("users.number_1"), value: extraProfile?.passportNumber || shownUser?.username || "-" },
    { label: t("users.item_19070"), value: extraProfile?.passportExpiryDate || "-" },
    { label: t("users.item_11139"), value: extraProfile?.nationality || regionName || "-" },
    { label: t("users.number_2"), value: extraProfile?.absherNumber || (shownUser?.id ? shownUser.id.slice(-6) : "-") },
    { label: t("users.item_12720"), value: extraProfile?.qualification || roleLabel || "-" },
  ];

  if (isLoadingUser && !shownUser) {
    return (
      <div className="min-h-screen flex items-center justify-center rassco-light-surface" style={{ background: brand.bg, color: brand.text }} dir={dir}>
        <p className="text-sm" style={{ color: brand.muted }}>{t("users.loading_data")}</p>
      </div>
    );
  }

  if (selectedUserError) {
    const status = (selectedUserError as { status?: number }).status;
    return (
      <div className="min-h-screen flex items-center justify-center rassco-light-surface" style={{ background: brand.bg }} dir={dir}>
        <div className="text-center space-y-3 max-w-md px-6">
          <p className="text-sm font-semibold" style={{ color: brand.danger }}>
            {status === 429
              ? "تم تجاوز حد الطلبات مؤقتاً. انتظر دقيقة ثم حدّث الصفحة."
              : t("users.loading_file_user")}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl text-white text-sm font-bold"
            style={{ background: brand.primary }}
          >
            تحديث الصفحة
          </button>
        </div>
      </div>
    );
  }

  if (!shownUser) {
    return (
      <div className="min-h-screen flex items-center justify-center rassco-light-surface" style={{ background: brand.bg }} dir={dir}>
        <p className="text-sm" style={{ color: brand.muted }}>{t("users.no_data")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen rassco-light-surface" style={{ background: brand.bg, color: brand.text }} dir={dir}>
      <main className="min-h-screen flex flex-col overflow-y-auto">
        <header
          className="sticky top-0 z-40 px-6 md:px-8 py-4 flex items-center justify-between backdrop-blur-md"
          style={{ background: "rgba(248,250,251,0.92)", borderBottom: `1px solid ${brand.border}` }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold" style={{ color: brand.text }}>{t("users.file")}</h2>
            <span
              className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
              style={
                isActive
                  ? { background: "rgba(24,178,176,0.1)", color: brand.primary, borderColor: "rgba(24,178,176,0.25)" }
                  : { background: "rgba(224,82,82,0.1)", color: brand.danger, borderColor: "rgba(224,82,82,0.25)" }
              }
            >
              {isActive ? t("users.active") : t("users.inactive")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!!exporting}
              className="px-3.5 py-2 rounded-xl text-sm font-bold border bg-white inline-flex items-center gap-2 transition-all hover:border-[#18B2B0] disabled:opacity-50"
              style={{ borderColor: "rgba(24,178,176,0.35)", color: brand.text }}
            >
              {exporting === "excel" ? (
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: brand.primary }} />
              ) : (
                <FileSpreadsheet className="h-4 w-4" style={{ color: brand.primary }} />
              )}
              تصدير Excel
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!!exporting}
              className="px-3.5 py-2 rounded-xl text-sm font-bold border bg-white inline-flex items-center gap-2 transition-all hover:border-[#18B2B0] disabled:opacity-50"
              style={{ borderColor: "rgba(24,178,176,0.35)", color: brand.text }}
            >
              {exporting === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: brand.primary }} />
              ) : (
                <FileText className="h-4 w-4" style={{ color: brand.primary }} />
              )}
              تصدير PDF
            </button>
            <Link
              href={`/employee-edit-profile-template?userId=${shownUserId || targetUserId}`}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all inline-flex items-center gap-2 text-white shadow-sm"
              style={{ background: brand.primary }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = brand.primaryHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = brand.primary; }}
            >
              <Edit3 className="h-4 w-4" />
              {t("users.edit_data")}
            </Link>
          </div>
        </header>

        <div className="p-6 md:p-8 space-y-8">
          {/* Hero identity banner */}
          <section
            className="rounded-2xl p-6 relative overflow-hidden border bg-white"
            style={{ borderColor: "rgba(24,178,176,0.28)", boxShadow: "0 12px 30px rgba(24,178,176,0.08)" }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(135deg, rgba(24,178,176,0.12) 0%, rgba(244,183,64,0.06) 42%, transparent 70%)",
              }}
            />
            <div className="absolute -top-16 -end-16 size-56 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(24,178,176,0.18)" }} />
            <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
              <div className="relative">
                <div
                  className="size-40 rounded-2xl overflow-hidden border-4 bg-[#F3F4F6]"
                  style={{ borderColor: "rgba(24,178,176,0.35)", boxShadow: "0 10px 24px rgba(24,178,176,0.2)" }}
                >
                  {shownUser?.profileImage ? (
                    <img
                      className="w-full h-full object-cover"
                      alt={shownUser.fullName || ""}
                      src={shownUser.profileImage}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ color: brand.primary }}>
                      <User className="h-16 w-16" />
                    </div>
                  )}
                </div>
                <Link
                  href={`/employee-edit-profile-template?userId=${shownUserId || targetUserId}`}
                  className="absolute -bottom-2 -start-2 size-10 rounded-full flex items-center justify-center border-4 border-white text-white"
                  style={{ background: brand.primary }}
                  aria-label={t("users.edit_data")}
                >
                  <Camera className="h-4 w-4" />
                </Link>
              </div>

              <div className="flex-1 space-y-4 pt-2">
                <div>
                  <p className="text-xs font-bold tracking-wide mb-1" style={{ color: brand.primary }}>RASSCO · Employee File</p>
                  <h3 className="text-3xl font-bold mb-1" style={{ color: brand.text }}>{shownUser?.fullName || "-"}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: brand.muted }}>
                    <span className="flex items-center gap-1.5">
                      <Badge className="h-4 w-4" style={{ color: brand.primary }} />
                      {t("users.number_11")}
                      {extraProfile?.employeeNumber || employeeCode(shownUser?.id)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <BriefcaseBusiness className="h-4 w-4" style={{ color: brand.primary }} />
                      {roleLabel} - {regionName}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div
                    className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 border"
                    style={{ background: "rgba(24,178,176,0.08)", borderColor: "rgba(24,178,176,0.2)", color: brand.text }}
                  >
                    <span className="size-2 rounded-full animate-pulse" style={{ background: brand.primary }} />
                    {t("users.item_19150")}
                  </div>
                  <div
                    className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 border"
                    style={{ background: "rgba(244,183,64,0.12)", borderColor: "rgba(244,183,64,0.3)", color: brand.text }}
                  >
                    <BadgeCheck className="h-3 w-3" style={{ color: brand.warning }} />
                    {t("users.item_14402")}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5" style={{ color: brand.primary }} />
                  <h4 className="text-lg font-bold" style={{ color: brand.text }}>{t("users.info")}</h4>
                </div>

                <div className="bg-white rounded-2xl overflow-hidden border" style={{ borderColor: "rgba(24,178,176,0.22)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {personalInfoRows.map((row, index) => (
                      <div
                        key={row.label}
                        className="p-4 transition-colors hover:bg-[#F8FAFB]"
                        style={{
                          borderBottom: index < 9 ? `1px solid ${brand.border}` : undefined,
                          borderInlineEnd: index % 3 !== 2 ? `1px solid ${brand.border}` : undefined,
                        }}
                      >
                        <p className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: brand.muted }}>{row.label}</p>
                        <p
                          className="text-sm font-semibold"
                          style={{
                            color: row.danger ? brand.danger : row.accent ? brand.primary : brand.text,
                          }}
                        >
                          {row.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Warehouse className="h-5 w-5" style={{ color: brand.primary }} />
                  <h4 className="text-lg font-bold" style={{ color: brand.text }}>{t("users.item_12788")}</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div
                    className="bg-white rounded-2xl p-5 border border-s-4"
                    style={{ borderColor: brand.border, borderInlineStartColor: brand.primary, boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(24,178,176,0.12)" }}>
                          <Car className="h-5 w-5" style={{ color: brand.primary }} />
                        </div>
                        <h5 className="font-bold" style={{ color: brand.text }}>{t("users.item_17505")}</h5>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded border uppercase font-bold tracking-tighter" style={{ color: brand.muted, borderColor: brand.border, background: "#F8FAFB" }}>
                        {t("users.system")}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {[
                        [t("users.number_dashboard"), extraProfile?.carPlateNumber],
                        [t("users.type"), extraProfile?.carType],
                        [t("users.item_11189"), extraProfile?.carModel],
                        [t("users.item_19050"), extraProfile?.carYear],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="flex justify-between items-center text-sm py-1" style={{ borderBottom: `1px solid ${brand.border}` }}>
                          <span style={{ color: brand.muted }}>{label}</span>
                          <span className="font-semibold" style={{ color: brand.text }}>{value || "-"}</span>
                        </div>
                      ))}
                      {carHandoverFile ? (
                        <a
                          href={carHandoverFile.dataUrl}
                          download={carHandoverFile.name}
                          className="w-full mt-2 py-2 rounded-lg text-xs font-bold border inline-flex items-center justify-center gap-2 transition-all"
                          style={{ background: "rgba(24,178,176,0.1)", color: brand.primary, borderColor: "rgba(24,178,176,0.25)" }}
                        >
                          <Download className="h-3 w-3" />
                          {t("users.loading_receive")}
                        </a>
                      ) : (
                        <button
                          className="w-full mt-2 py-2 rounded-lg text-xs font-bold border inline-flex items-center justify-center gap-2 cursor-not-allowed"
                          style={{ background: "#F8FAFB", color: brand.muted, borderColor: brand.border }}
                          disabled
                          type="button"
                        >
                          <Download className="h-3 w-3" />
                          {t("users.no")}
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    className="bg-white rounded-2xl p-5 border border-s-4"
                    style={{ borderColor: brand.border, borderInlineStartColor: brand.warning, boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(244,183,64,0.15)" }}>
                          <Smartphone className="h-5 w-5" style={{ color: brand.warning }} />
                        </div>
                        <h5 className="font-bold" style={{ color: brand.text }}>{t("users.mobile")}</h5>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded border uppercase font-bold tracking-tighter" style={{ color: brand.muted, borderColor: brand.border, background: "#F8FAFB" }}>
                        Enterprise Device
                      </span>
                    </div>
                    <div className="space-y-3">
                      {[
                        [t("users.type_mobile"), extraProfile?.phoneType],
                        [t("users.serial"), extraProfile?.phoneSerial, true],
                        [t("users.number_6"), extraProfile?.businessPhoneNumber],
                        [t("users.type_sim"), extraProfile?.simType],
                      ].map(([label, value, mono]) => (
                        <div key={String(label)} className="flex justify-between items-center text-sm py-1" style={{ borderBottom: `1px solid ${brand.border}` }}>
                          <span style={{ color: brand.muted }}>{label}</span>
                          <span className={mono ? "font-mono text-xs font-semibold" : "font-semibold"} style={{ color: mono ? brand.primary : brand.text }}>
                            {(value as string) || "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <BriefcaseBusiness className="h-5 w-5" style={{ color: brand.primary }} />
                  <h4 className="text-lg font-bold" style={{ color: brand.text }}>{t("users.info_1")}</h4>
                </div>

                <div className="bg-white rounded-2xl p-5 space-y-4 border" style={{ borderColor: "rgba(24,178,176,0.22)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold" style={{ color: brand.muted }}>{t("users.item_20739")}</p>
                    <p className="text-sm font-bold flex items-center gap-2" style={{ color: brand.text }}>
                      {extraProfile?.projectName || t("users.item_8979", { var_0: regionName })}
                      <span className="size-2 rounded-full" style={{ background: brand.primary }} />
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold" style={{ color: brand.muted }}>{t("users.city")}</p>
                    <p className="text-sm font-bold" style={{ color: brand.text }}>{extraProfile?.city || shownUser?.city || "-"}</p>
                  </div>

                  <div className="pt-4 space-y-3" style={{ borderTop: `1px solid ${brand.border}` }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold" style={{ color: brand.muted }}>{t("users.item_15951")}</p>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border"
                        style={{ color: brand.primary, borderColor: "rgba(24,178,176,0.25)", background: "rgba(24,178,176,0.08)" }}
                      >
                        <FolderOpen className="h-3 w-3" />
                        {workDocuments.length}
                      </span>
                    </div>

                    <WorkDocumentsGallery
                      documents={workDocuments}
                      emptyLabel={t("users.no_1")}
                      onOpen={(index) => setPreviewIndex(index)}
                    />
                  </div>
                </div>
              </section>

              <section
                className="rounded-2xl p-5 border"
                style={{
                  background: "linear-gradient(145deg, rgba(24,178,176,0.12), rgba(244,183,64,0.08))",
                  borderColor: "rgba(24,178,176,0.28)",
                }}
              >
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: brand.text }}>
                  <Cpu className="h-4 w-4" style={{ color: brand.primary }} />
                  {t("users.item_20639")}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border bg-white" style={{ borderColor: brand.border }}>
                    <p className="text-[10px] mb-1" style={{ color: brand.muted }}>{t("users.item_15921")}</p>
                    <p className="text-lg font-bold" style={{ color: brand.primary }}>98%</p>
                  </div>
                  <div className="p-3 rounded-xl border bg-white" style={{ borderColor: brand.border }}>
                    <p className="text-[10px] mb-1" style={{ color: brand.muted }}>{t("users.item_20736")}</p>
                    <p className="text-lg font-bold" style={{ color: brand.primary }}>{fixedEntries.length + movingEntries.length}</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>

        <footer className="mt-auto p-8 text-center text-[10px] uppercase tracking-widest" style={{ borderTop: `1px solid ${brand.border}`, color: brand.muted }}>
          {t("users.system_3")}
        </footer>
      </main>

      {previewIndex !== null && workDocuments[previewIndex] && (
        <DocumentLightbox
          documents={workDocuments}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onChange={setPreviewIndex}
        />
      )}
    </div>
  );
}

function WorkDocumentsGallery({
  documents,
  emptyLabel,
  onOpen,
}: {
  documents: GalleryDoc[];
  emptyLabel: string;
  onOpen: (index: number) => void;
}) {
  if (documents.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed px-4 py-8 text-center"
        style={{ borderColor: "rgba(24,178,176,0.28)", background: "linear-gradient(135deg, #F8FAFB, rgba(24,178,176,0.06))" }}
      >
        <FolderOpen className="mx-auto mb-2 h-8 w-8" style={{ color: "rgba(24,178,176,0.35)" }} />
        <p className="text-xs font-semibold" style={{ color: brand.muted }}>{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className="employee-docs-scroll flex gap-3 overflow-x-auto pb-2 pe-1 ps-1 snap-x snap-mandatory"
        dir="rtl"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(24,178,176,0.45) rgba(24,178,176,0.08)",
        }}
      >
        {documents.map((doc, index) => {
          const isImage = isImageAttachment(doc.file);
          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => onOpen(index)}
              className="group relative shrink-0 w-[148px] snap-start overflow-hidden rounded-2xl border bg-white text-start transition-all duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18B2B0]/40"
              style={{
                borderColor: "rgba(24,178,176,0.28)",
                boxShadow: "0 8px 20px rgba(24,178,176,0.1)",
              }}
            >
              <div className="relative h-[112px] w-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                {isImage ? (
                  <img
                    src={doc.file.dataUrl}
                    alt={doc.label}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ background: "linear-gradient(145deg, #F8FAFB, rgba(24,178,176,0.12))" }}>
                    <FileText className="h-8 w-8" style={{ color: brand.primary }} />
                    <span className="text-[10px] font-bold" style={{ color: brand.muted }}>PDF / File</span>
                  </div>
                )}
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: "linear-gradient(180deg, transparent 35%, rgba(15,30,32,0.55))" }}
                />
                <span
                  className="absolute end-2 top-2 inline-flex size-7 items-center justify-center rounded-full text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: "rgba(24,178,176,0.92)", boxShadow: "0 4px 12px rgba(24,178,176,0.35)" }}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="space-y-0.5 px-3 py-2.5">
                <p className="truncate text-[11px] font-extrabold" style={{ color: brand.text }} title={doc.label}>
                  {doc.label}
                </p>
                <p className="truncate text-[10px]" style={{ color: brand.muted }} title={doc.file.name}>
                  {doc.file.name}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DocumentLightbox({
  documents,
  index,
  onClose,
  onChange,
}: {
  documents: GalleryDoc[];
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const current = documents[index];
  const isImage = isImageAttachment(current.file);
  const hasPrev = index > 0;
  const hasNext = index < documents.length - 1;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(15, 23, 28, 0.72)", backdropFilter: "blur(10px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={current.label}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-3xl border bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{ borderColor: "rgba(24,178,176,0.28)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between gap-3 px-5 py-4"
          style={{ borderBottom: `1px solid ${brand.border}`, background: "linear-gradient(180deg, rgba(248,250,251,0.98), #fff)" }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold" style={{ color: brand.text }}>{current.label}</p>
            <p className="truncate text-xs" style={{ color: brand.muted }}>
              {current.file.name} · {index + 1}/{documents.length}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={current.file.dataUrl}
              download={current.file.name}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition-colors"
              style={{ background: brand.primary }}
            >
              <Download className="h-3.5 w-3.5" />
              تحميل
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-9 items-center justify-center rounded-xl border bg-white transition-colors hover:bg-[#F3F4F6]"
              style={{ borderColor: brand.border, color: brand.muted }}
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-[280px] items-center justify-center p-4 sm:p-6" style={{ background: "#0f171a" }}>
          {hasPrev && (
            <button
              type="button"
              onClick={() => onChange(index - 1)}
              className="absolute start-3 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border text-white transition hover:scale-105"
              style={{ background: "rgba(24,178,176,0.92)", borderColor: "rgba(255,255,255,0.2)" }}
              aria-label="السابق"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={() => onChange(index + 1)}
              className="absolute end-3 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border text-white transition hover:scale-105"
              style={{ background: "rgba(24,178,176,0.92)", borderColor: "rgba(255,255,255,0.2)" }}
              aria-label="التالي"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {isImage ? (
            <img
              src={current.file.dataUrl}
              alt={current.label}
              className="max-h-[70vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-2xl border px-8 py-10 text-center" style={{ borderColor: "rgba(24,178,176,0.35)", background: "rgba(255,255,255,0.04)" }}>
              <FileText className="h-14 w-14" style={{ color: brand.primary }} />
              <p className="text-sm font-bold text-white">{current.file.name}</p>
              <a
                href={current.file.dataUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl px-4 py-2 text-xs font-bold text-white"
                style={{ background: brand.primary }}
              >
                فتح الملف
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
