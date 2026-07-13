import { useTranslation } from "@/lib/language";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Badge,
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
  Car,
  Cpu,
  Download,
  Edit3,
  Eye,
  FolderOpen,
  MoreVertical,
  Printer,
  Smartphone,
  Upload,
  User,
  Warehouse,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getRoleLabel } from "@shared/roles";
import { getEmployeeProfileExtra } from "@/lib/employee-profile-extra";
import type {
  RegionWithStats,
  TechnicianFixedInventoryEntry,
  TechnicianMovingInventoryEntry,
  UserSafe,
} from "@shared/schema";

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

export default function EmployeeDetailedProfileTemplatePage() {
  const { t, dir } = useTranslation();
  const { user: authUser } = useAuth();
  const [location] = useLocation();

  const targetUserId = useMemo(() => {
    const queryString = location.includes("?") ? `?${location.split("?")[1]}` : "";
    const search = typeof window !== "undefined" ? window.location.search : queryString;
    const fromQuery = new URLSearchParams(search).get("userId");
    return fromQuery || authUser?.id || "";
  }, [authUser?.id, location]);

  const isViewingAnotherUser = !!targetUserId && !!authUser?.id && targetUserId !== authUser.id;

  const {
    data: selectedUser,
    isLoading: isLoadingUser,
    error: selectedUserError,
  } = useQuery<UserSafe>({
    queryKey: [`/api/users/${targetUserId}`],
    enabled: !!targetUserId,
  });

  const { data: regions = [] } = useQuery<RegionWithStats[]>({
    queryKey: ["/api/regions"],
    enabled: !!authUser,
  });

  const shownUser = isViewingAnotherUser ? selectedUser : selectedUser || authUser;
  const shownUserId = shownUser?.id;

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
    if (!shownUser?.regionId) return t('users.item_11173');
    return regions.find((region) => region.id === shownUser.regionId)?.name || t('users.item_11173');
  }, [regions, shownUser?.regionId]);

  const fixedInventoryTotal = useMemo(() => {
    return fixedEntries.reduce((sum, entry) => sum + Number(entry.boxes || 0) + Number(entry.units || 0), 0);
  }, [fixedEntries]);

  const movingInventoryTotal = useMemo(() => {
    return movingEntries.reduce((sum, entry) => sum + Number(entry.boxes || 0) + Number(entry.units || 0), 0);
  }, [movingEntries]);

  const totalInventory = fixedInventoryTotal + movingInventoryTotal;
  const roleLabel = getRoleLabel(shownUser?.role || "");
  const isActive = !!shownUser?.isActive;
  const extraProfile = useMemo(() => getEmployeeProfileExtra(shownUserId), [location, shownUserId]);
  const jobOfferFile = extraProfile?.jobOfferFile || null;
  const promissoryNoteFile = extraProfile?.promissoryNoteFile || null;
  const carHandoverFile = extraProfile?.carHandoverFile || null;
  const otherFiles = Array.isArray(extraProfile?.otherFiles) ? extraProfile.otherFiles : [];

  const fixedInventoryStatus = fixedEntriesQuery.isLoading
    ? t('users.loading')
    : fixedEntriesQuery.error
      ? t('users.data')
      : t('users.data_1');

  const movingInventoryStatus = movingEntriesQuery.isLoading
    ? t('users.loading')
    : movingEntriesQuery.error
      ? t('users.data')
      : t('users.data_1');

  const personalInfoRows = [
    { label: t('users.name'), value: shownUser?.fullName || "-" },
    { label: t('users.number'), value: extraProfile?.nationalId || shownUser?.id || "-" },
    { label: t('users.number_mobile'), value: extraProfile?.phoneNumber || shownUser?.username || "-", className: "text-cyan-300" },
    { label: t('users.date'), value: extraProfile?.birthDate || formatDate(shownUser?.createdAt) },
    { label: t('users.item_19123'), value: extraProfile?.nationalIdExpiryDate || formatDate(shownUser?.updatedAt), className: "text-rose-400" },
    { label: t('users.name_1'), value: extraProfile?.sponsorName || shownUser?.email || "-" },
    { label: t('users.item_19054'), value: extraProfile?.licenseExpiryDate || "-" },
    { label: t('users.number_1'), value: extraProfile?.passportNumber || shownUser?.username || "-" },
    { label: t('users.item_19070'), value: extraProfile?.passportExpiryDate || "-" },
    { label: t('users.item_11139'), value: extraProfile?.nationality || regionName || "-" },
    { label: t('users.number_2'), value: extraProfile?.absherNumber || (shownUser?.id ? shownUser.id.slice(-6) : "-") },
    { label: t('users.item_12720'), value: extraProfile?.qualification || roleLabel || "-" },
  ];

  if (isLoadingUser && !shownUser) {
    return (
      <div className="min-h-screen bg-[#0f2323] text-slate-100 flex items-center justify-center" dir={dir}>
        <p className="text-sm text-slate-300">{t('users.loading_data')}</p>
      </div>
    );
  }

  if (isViewingAnotherUser && selectedUserError) {
    return (
      <div className="min-h-screen bg-[#0f2323] text-slate-100 flex items-center justify-center" dir={dir}>
        <p className="text-sm text-rose-300">{t('users.loading_file_user')}</p>
      </div>
    );
  }

  if (!shownUser) {
    return (
      <div className="min-h-screen bg-[#0f2323] text-slate-100 flex items-center justify-center" dir={dir}>
        <p className="text-sm text-slate-300">{t('users.no_data')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f2323] text-slate-100" dir={dir}>
      <main className="min-h-screen flex flex-col bg-[#0f2323]/50 overflow-y-auto">
          <header className="sticky top-0 z-40 bg-[#0f2323]/80 backdrop-blur-md border-b border-white/5 px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold">{t('users.file')}</h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                {isActive ? t('users.active') : t('users.inactive')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/employee-edit-profile-template?userId=${shownUserId || targetUserId}`}
                className="bg-cyan-400 hover:bg-cyan-300 text-[#0f2323] px-4 py-2 rounded-lg text-sm font-bold transition-all inline-flex items-center gap-2"
              >
                <Edit3 className="h-4 w-4" />
                {t('users.edit_data')}
              </Link>
              <button className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-lg border border-white/10">
                <Printer className="h-4 w-4" />
              </button>
              <button className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-lg border border-white/10">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="p-8 space-y-8">
            <section className="bg-[#152e2e]/60 backdrop-blur-xl border border-cyan-400/10 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/5 rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                <div className="relative group">
                  <div className="size-40 rounded-2xl overflow-hidden border-4 border-cyan-400/20 shadow-[0_0_15px_rgba(6,249,249,0.15)]">
                    <img
                      className="w-full h-full object-cover"
                      alt="Professional employee portrait"
                      src={
                        shownUser?.profileImage ||
                        "https://lh3.googleusercontent.com/aida-public/AB6AXuCPhF1KCGoFud1fJMUkjXy_wnF9DyGqODYq5X6cJynGGPZa-IuvOUkDOkt7YdNgpS798euQV7rEXin4jCYdWwTnmryM2dc0plwoecpgIUnVI8W3-B96aVwBSffqMSSpftl7lqFRrpmT9vpSCmbfqgK0Bo2mDg2sDollJUrCI8Sp7c-dQ9gGs5QIn1d2RUdsdAshPAgwTT1sy6PpzxHo9_DwcjjTn-4j5aHM4wo4whXAXtDNfSpOKevdJ5ZzbVBcrHOVD4QQAAPDcaU"
                      }
                    />
                  </div>
                  <button className="absolute -bottom-2 -left-2 size-10 rounded-full bg-cyan-400 text-[#0f2323] flex items-center justify-center border-4 border-[#0f2323]">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-4 pt-2">
                  <div>
                    <h3 className="text-3xl font-bold text-white mb-1">{shownUser?.fullName || "-"}</h3>
                    <div className="flex flex-wrap items-center gap-4 text-slate-400 text-sm">
                      <span className="flex items-center gap-1">
                        <Badge className="h-4 w-4 text-cyan-300" />{t('users.number_11')}{employeeCode(shownUser?.id)}
                      </span>
                      <span className="flex items-center gap-1">
                        <BriefcaseBusiness className="h-4 w-4 text-cyan-300" />
                        {roleLabel} - {regionName}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs flex items-center gap-2">
                      <span className="size-2 rounded-full bg-cyan-300 animate-pulse" />
                      {t('users.item_19150')}
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs flex items-center gap-2">
                      <BadgeCheck className="h-3 w-3 text-cyan-300" />
                      {t('users.item_14402')}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 space-y-8">
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-5 w-5 text-cyan-300" />
                    <h4 className="text-lg font-bold">{t('users.info')}</h4>
                  </div>

                  <div className="bg-[#152e2e]/60 backdrop-blur-xl border border-cyan-400/10 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {personalInfoRows.map((row, index) => (
                        <div
                          key={row.label}
                          className={`p-4 hover:bg-white/5 transition-colors ${
                            index < 9 ? "border-b border-white/5" : ""
                          } ${index % 3 !== 2 ? "border-l border-white/5" : ""}`}
                        >
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{row.label}</p>
                          <p className={`text-sm font-semibold ${row.className || ""}`}>{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Warehouse className="h-5 w-5 text-cyan-300" />
                    <h4 className="text-lg font-bold">{t('users.item_12788')}</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#152e2e]/60 backdrop-blur-xl border border-cyan-400/10 rounded-2xl p-5 border-r-4 border-cyan-400/40">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 bg-cyan-400/10 rounded-lg flex items-center justify-center">
                            <Car className="h-5 w-5 text-cyan-300" />
                          </div>
                          <h5 className="font-bold">{t('users.item_17505')}</h5>
                        </div>
                        <span className="text-[10px] bg-white/5 px-2 py-1 rounded border border-white/10 uppercase font-bold text-slate-400 tracking-tighter">
                          {t('users.system')}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                          <span className="text-slate-400">{t('users.total_quantity')}</span>
                          <span className="font-semibold">{fixedInventoryTotal}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                          <span className="text-slate-400">{t('users.item_15912')}</span>
                          <span className="font-semibold">{fixedEntries.length}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                          <span className="text-slate-400">{t('users.status_data')}</span>
                          <span className="font-semibold">{fixedInventoryStatus}</span>
                        </div>
                        {carHandoverFile ? (
                          <a
                            href={carHandoverFile.dataUrl}
                            download={carHandoverFile.name}
                            className="w-full mt-2 py-2 rounded-lg bg-cyan-400/10 text-cyan-300 text-xs font-bold border border-cyan-400/20 hover:bg-cyan-400/20 transition-all inline-flex items-center justify-center gap-2"
                          >
                            <Download className="h-3 w-3" />
                            {t('users.loading_receive')}
                          </a>
                        ) : (
                          <button
                            className="w-full mt-2 py-2 rounded-lg bg-white/5 text-slate-400 text-xs font-bold border border-white/10 inline-flex items-center justify-center gap-2 cursor-not-allowed"
                            disabled
                          >
                            <Download className="h-3 w-3" />
                            {t('users.no')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#152e2e]/60 backdrop-blur-xl border border-cyan-400/10 rounded-2xl p-5 border-r-4 border-emerald-500/40">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                            <Smartphone className="h-5 w-5 text-emerald-400" />
                          </div>
                          <h5 className="font-bold">{t('users.mobile')}</h5>
                        </div>
                        <span className="text-[10px] bg-white/5 px-2 py-1 rounded border border-white/10 uppercase font-bold text-slate-400 tracking-tighter">
                          Enterprise Device
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                          <span className="text-slate-400">{t('users.total_quantity')}</span>
                          <span className="font-semibold">{movingInventoryTotal}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                          <span className="text-slate-400">{t('users.item_15912')}</span>
                          <span className="font-mono text-xs text-cyan-300">{movingEntries.length}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                          <span className="text-slate-400">{t('users.total')}</span>
                          <span className="font-semibold">{totalInventory}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                          <span className="text-slate-400">{t('users.status_data')}</span>
                          <span className="font-semibold">{movingInventoryStatus}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm py-1 border-b border-white/5">
                          <span className="text-slate-400">{t('users.update')}</span>
                          <span className="font-semibold">{formatDate(shownUser?.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <aside className="space-y-8">
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <BriefcaseBusiness className="h-5 w-5 text-cyan-300" />
                    <h4 className="text-lg font-bold">{t('users.info_1')}</h4>
                  </div>

                  <div className="bg-[#152e2e]/60 backdrop-blur-xl border border-cyan-400/10 rounded-2xl p-5 space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-slate-500 font-bold">{t('users.item_20739')}</p>
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        {extraProfile?.projectName || t('users.item_8979', { var_0: regionName })}
                        <span className="size-2 rounded-full bg-cyan-300" />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-slate-500 font-bold">{t('users.city')}</p>
                      <p className="text-sm font-bold text-white">{extraProfile?.city || shownUser?.city || "-"}</p>
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-4">
                      <p className="text-xs font-bold text-slate-400">{t('users.item_15951')}</p>

                      <a
                        href={jobOfferFile?.dataUrl || "#"}
                        download={jobOfferFile?.name || undefined}
                        target={jobOfferFile ? "_blank" : undefined}
                        rel={jobOfferFile ? "noreferrer" : undefined}
                        className={`group relative rounded-xl overflow-hidden border transition-all ${
                          jobOfferFile ? "border-white/10 hover:border-cyan-400/50 cursor-pointer" : "border-white/5 opacity-60 cursor-not-allowed"
                        }`}
                        onClick={(event) => {
                          if (!jobOfferFile) event.preventDefault();
                        }}
                      >
                        {jobOfferFile && isImageAttachment(jobOfferFile) ? (
                          <img
                            className="w-full h-24 object-cover brightness-75 group-hover:brightness-100 transition-all"
                            alt={jobOfferFile.name}
                            src={jobOfferFile.dataUrl}
                          />
                        ) : (
                          <div className="w-full h-24 bg-gradient-to-br from-slate-800 to-[#0f2323] flex items-center justify-center">
                            <Upload className="h-10 w-10 text-white/20 group-hover:text-cyan-300/40 transition-all" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex flex-col justify-end p-3 bg-black/25">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold truncate">{jobOfferFile?.name || t('users.no_view')}</span>
                            <Download className="h-3 w-3 text-cyan-300 shrink-0" />
                          </div>
                        </div>
                      </a>

                      <a
                        href={promissoryNoteFile?.dataUrl || "#"}
                        download={promissoryNoteFile?.name || undefined}
                        target={promissoryNoteFile ? "_blank" : undefined}
                        rel={promissoryNoteFile ? "noreferrer" : undefined}
                        className={`group relative rounded-xl overflow-hidden border transition-all ${
                          promissoryNoteFile
                            ? "border-white/10 hover:border-cyan-400/50 cursor-pointer"
                            : "border-white/5 opacity-60 cursor-not-allowed"
                        }`}
                        onClick={(event) => {
                          if (!promissoryNoteFile) event.preventDefault();
                        }}
                      >
                        {promissoryNoteFile && isImageAttachment(promissoryNoteFile) ? (
                          <img
                            className="w-full h-24 object-cover brightness-75 group-hover:brightness-100 transition-all"
                            alt={promissoryNoteFile.name}
                            src={promissoryNoteFile.dataUrl}
                          />
                        ) : (
                          <div className="w-full h-24 bg-gradient-to-br from-slate-800 to-[#0f2323] flex items-center justify-center">
                            <Upload className="h-10 w-10 text-white/20 group-hover:text-cyan-300/40 transition-all" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex flex-col justify-end p-3 bg-black/25">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold truncate">{promissoryNoteFile?.name || t('users.no_voucher')}</span>
                            <Eye className="h-3 w-3 text-cyan-300 shrink-0" />
                          </div>
                        </div>
                      </a>

                      <div className="group relative rounded-xl overflow-hidden border border-white/10 hover:border-cyan-400/50 transition-all">
                        <div className="w-full min-h-24 bg-gradient-to-br from-slate-800 to-[#0f2323] p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold">{t('users.other')}{otherFiles.length})</span>
                            <FolderOpen className="h-3 w-3 text-cyan-300" />
                          </div>
                          {otherFiles.length === 0 ? (
                            <p className="text-[10px] text-slate-400">{t('users.no_1')}</p>
                          ) : (
                            <div className="space-y-1">
                              {otherFiles.slice(0, 3).map((file) => (
                                <a
                                  key={`${file.name}-${file.uploadedAt}`}
                                  href={file.dataUrl}
                                  download={file.name}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-cyan-300 hover:text-cyan-200 block truncate"
                                >
                                  {file.name}
                                </a>
                              ))}
                              {otherFiles.length > 3 && (
                                <p className="text-[10px] text-slate-400">+{otherFiles.length - 3}{t('users.other_1')}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="bg-gradient-to-br from-cyan-400/10 to-transparent border border-cyan-400/20 rounded-2xl p-5">
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-cyan-300" />
                    {t('users.item_20639')}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-500 mb-1">{t('users.item_15921')}</p>
                      <p className="text-lg font-bold text-cyan-300">98%</p>
                    </div>
                    <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-500 mb-1">{t('users.item_20736')}</p>
                      <p className="text-lg font-bold text-cyan-300">{fixedEntries.length + movingEntries.length}</p>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          </div>

          <footer className="mt-auto p-8 border-t border-white/5 text-center text-slate-500 text-[10px] uppercase tracking-widest">
            {t('users.system_3')}
          </footer>
      </main>
    </div>
  );
}
