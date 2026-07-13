import { useTranslation, t } from "@/lib/language";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import ExcelJS from "exceljs";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Eye,
  Edit,
  FileSpreadsheet,
  KeyRound,
  MapPin,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AdminStats, InsertRegion, InsertUser, Region, RegionWithStats, UserSafe } from "@shared/schema";
import { ROLE_LABELS_AR, ROLES } from "@shared/roles";

const regionFormSchema = z.object({
  name: z.string().min(1, t('common.name_region_2')),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const userFormSchema = z.object({
  username: z.string().min(3, t('common.name_user_1')),
  email: z.string().email(t('common.item_36713')),
  password: z.string().min(6, t('common.item_49699')),
  fullName: z.string().min(1, t('common.name_1')),
  role: z.enum(["admin", "supervisor", "technician"]),
  regionId: z.string().optional(),
  isActive: z.boolean().default(true),
});

type RoleFilter = "all" | "managers" | "technicians";

function userInitials(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean);
  return (parts[0]?.[0] || t('common.item_1605')) + (parts[1]?.[0] || "");
}

function arNumber(value: number): string {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function roleBadgeClass(role: string): string {
  if (role === "admin") return "border-purple-500/25 bg-purple-500/10 text-purple-300";
  if (role === "supervisor") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  return "border-blue-500/25 bg-blue-500/10 text-blue-300";
}

export default function AdminPage() {
  const { t, dir } = useTranslation();
  const { toast } = useToast();

  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [editingUser, setEditingUser] = useState<UserSafe | null>(null);
  const [regionSearchTerm, setRegionSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const { data: adminStats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: regions = [] } = useQuery<RegionWithStats[]>({
    queryKey: ["/api/regions"],
  });

  const { data: users = [] } = useQuery<UserSafe[]>({
    queryKey: ["/api/users"],
  });

  const regionForm = useForm<z.infer<typeof regionFormSchema>>({
    resolver: zodResolver(regionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
    },
  });

  const userForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      fullName: "",
      role: ROLES.TECHNICIAN,
      regionId: "",
      isActive: true,
    },
  });

  const createRegionMutation = useMutation({
    mutationFn: (data: InsertRegion) => apiRequest("POST", "/api/regions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/regions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      handleCloseRegionModal();
      toast({ title: t('common.completed_region_successfully') });
    },
    onError: () => {
      toast({ title: t('common.fail_region'), variant: "destructive" });
    },
  });

  const updateRegionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertRegion> }) => apiRequest("PATCH", `/api/regions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/regions"] });
      handleCloseRegionModal();
      toast({ title: t('common.completed_update_region_succes') });
    },
    onError: () => {
      toast({ title: t('common.fail_update_region'), variant: "destructive" });
    },
  });

  const deleteRegionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/regions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/regions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: t('common.completed_delete_region_succes') });
    },
    onError: (error) => {
      let message = t('common.fail_delete_region');
      if (error instanceof Error) {
        if (error.message.includes("Cannot delete region that has assigned users")) {
          message = t('common.no_delete_region');
        } else if (error.message.includes("Cannot delete region")) {
          message = t('common.no_delete_region_other');
        }
      }
      toast({ title: t('common.delete_region'), description: message, variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: InsertUser) => apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      handleCloseUserModal();
      toast({ title: t('common.completed_user_successfully') });
    },
    onError: () => {
      toast({ title: t('common.fail_user'), variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertUser> }) => apiRequest("PATCH", `/api/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      handleCloseUserModal();
      toast({ title: t('common.completed_update_data_user') });
    },
    onError: () => {
      toast({ title: t('common.fail_update_data_user'), variant: "destructive" });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest("PATCH", `/api/users/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: t('common.completed_update_status_user') });
    },
    onError: () => {
      toast({ title: t('common.fail_update_status_user'), variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: t('common.completed_delete_user') });
    },
    onError: () => {
      toast({ title: t('common.fail_delete_user'), variant: "destructive" });
    },
  });

  const bulkUserStatusMutation = useMutation({
    mutationFn: (isActive: boolean) => apiRequest("POST", "/api/users/bulk-status", { isActive }),
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: isActive ? t('common.completed_users_successfully') : t('common.completed_users_successfully_1'),
        description: isActive
          ? t('common.completed_system_successfully')
          : t('common.completed_system'),
      });
    },
    onError: () => {
      toast({ title: t('common.fail_update_status_users'), variant: "destructive" });
    },
  });

  const handleCloseRegionModal = () => {
    setShowRegionModal(false);
    setEditingRegion(null);
    regionForm.reset({ name: "", description: "", isActive: true });
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
    userForm.reset({
      username: "",
      email: "",
      password: "",
      fullName: "",
      role: ROLES.TECHNICIAN,
      regionId: "",
      isActive: true,
    });
  };

  const handleEditRegion = (region: Region) => {
    setEditingRegion(region);
    regionForm.reset({
      name: region.name,
      description: region.description || "",
      isActive: region.isActive,
    });
    setShowRegionModal(true);
  };

  const handleEditUser = (user: UserSafe) => {
    setEditingUser(user);
    userForm.reset({
      username: user.username,
      email: user.email,
      password: "",
      fullName: user.fullName,
      role: user.role as "admin" | "supervisor" | "technician",
      regionId: user.regionId || "",
      isActive: user.isActive,
    });
    setShowUserModal(true);
  };

  const handleRegionSubmit = (values: z.infer<typeof regionFormSchema>) => {
    if (editingRegion) {
      updateRegionMutation.mutate({ id: editingRegion.id, data: values });
      return;
    }

    createRegionMutation.mutate(values);
  };

  const handleUserSubmit = (values: z.infer<typeof userFormSchema>) => {
    const normalizedData = {
      ...values,
      regionId: values.regionId || undefined,
    };

    if (editingUser) {
      const { password, ...rest } = normalizedData;
      const data = password ? normalizedData : rest;
      updateUserMutation.mutate({ id: editingUser.id, data });
      return;
    }

    createUserMutation.mutate(normalizedData as InsertUser);
  };

  const filteredRegions = useMemo(() => {
    const normalized = regionSearchTerm.trim().toLowerCase();
    if (!normalized) return regions;

    return regions.filter((region) => {
      const name = (region.name || "").toLowerCase();
      const description = (region.description || "").toLowerCase();
      return name.includes(normalized) || description.includes(normalized);
    });
  }, [regions, regionSearchTerm]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const normalized = userSearchTerm.trim().toLowerCase();
      const matchesSearch =
        !normalized ||
        user.username.toLowerCase().includes(normalized) ||
        user.fullName.toLowerCase().includes(normalized) ||
        user.email.toLowerCase().includes(normalized);

      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "technicians" && user.role === "technician") ||
        (roleFilter === "managers" && (user.role === "admin" || user.role === "supervisor"));

      const matchesRegion = selectedRegionId === "all" || user.regionId === selectedRegionId;

      return matchesSearch && matchesRole && matchesRegion;
    });
  }, [users, userSearchTerm, roleFilter, selectedRegionId]);

  const totalUsers = adminStats?.totalUsers ?? users.length;
  const activeUsers = adminStats?.activeUsers ?? users.filter((user) => user.isActive).length;
  const registrationRequests = Math.max(0, totalUsers - activeUsers);
  const managersCount = users.filter((user) => user.role === "admin" || user.role === "supervisor").length;
  const techniciansCount = users.filter((user) => user.role === "technician").length;
  const displayedFrom = filteredUsers.length > 0 ? 1 : 0;
  const displayedTo = filteredUsers.length;

  const handleExportUsers = async () => {
    if (filteredUsers.length === 0) {
      toast({
        title: t('common.no_data'),
        description: t('common.no_results_search'),
        variant: "destructive",
      });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(t('common.item_15933'));

    worksheet.addRow(["#", t('common.name_user'), t('common.name'), t('common.item_9533'), t('common.item_7955'), t('common.region'), t('common.status')]);

    filteredUsers.forEach((user, index) => {
      const regionName = regions.find((region) => region.id === user.regionId)?.name || "-";
      worksheet.addRow([
        index + 1,
        user.username,
        user.fullName,
        user.email,
        ROLE_LABELS_AR[user.role as keyof typeof ROLE_LABELS_AR],
        regionName,
        user.isActive ? t('common.active_1') : t('common.active_2'),
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `users_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: t('common.completed_export_successfully'),
      description: t('common.completed_export_1', { var_0: filteredUsers.length }),
    });
  };

  return (
      <div className="-m-8 min-h-[calc(100vh-5rem)] bg-[#050a0a] p-6 md:p-8 relative overflow-hidden" dir={dir}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-cyan-400/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-cyan-300 to-blue-500 rounded-full" />
              <h1 className="text-2xl md:text-3xl font-black text-white">{t('common.management_users')}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => {
                  if (window.confirm(t('common.users_3'))) {
                    bulkUserStatusMutation.mutate(true);
                  }
                }}
                disabled={bulkUserStatusMutation.isPending}
                variant="outline"
                className="border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/25 font-bold"
              >
                <UserCheck className="h-4 w-4 ml-2" />
                {t('common.users')}
              </Button>
              <Button
                onClick={() => {
                  if (window.confirm(t('common.warning_users'))) {
                    bulkUserStatusMutation.mutate(false);
                  }
                }}
                disabled={bulkUserStatusMutation.isPending}
                variant="outline"
                className="border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/25 font-bold"
              >
                <XCircle className="h-4 w-4 ml-2" />
                {t('common.users_1')}
              </Button>
              <Button
                onClick={() => {
                  setEditingUser(null);
                  setShowUserModal(true);
                }}
                className="bg-gradient-to-r from-cyan-300 to-blue-500 text-[#061113] hover:opacity-90 font-bold"
                data-testid="button-add-user"
              >
                <UserPlus className="h-4 w-4 ml-2" />
                {t('common.add_new')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="group relative overflow-hidden rounded-3xl border border-cyan-400/15 bg-[#0a1314]/80 backdrop-blur-xl p-6 flex items-center justify-between transition-all hover:border-cyan-300/35">
              <div className="absolute inset-0 bg-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-slate-400 text-sm">{t('common.total_users')}</p>
                <p className="text-4xl font-black text-white mt-2">{arNumber(totalUsers)}</p>
              </div>
              <div className="size-14 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 flex items-center justify-center">
                <Users className="h-7 w-7" />
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-3xl border border-green-500/20 bg-[#0a1314]/80 backdrop-blur-xl p-6 flex items-center justify-between transition-all hover:border-green-400/40">
              <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-slate-400 text-sm">{t('common.users_2')}</p>
                <p className="text-4xl font-black text-white mt-2 flex items-center gap-2">
                  {arNumber(activeUsers)}
                  <span className="size-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.9)]" />
                </p>
              </div>
              <div className="size-14 rounded-2xl border border-green-500/30 bg-green-500/10 text-green-400 flex items-center justify-center">
                <UserCheck className="h-7 w-7" />
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-3xl border border-orange-500/20 bg-[#0a1314]/80 backdrop-blur-xl p-6 flex items-center justify-between transition-all hover:border-orange-400/40">
              <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-slate-400 text-sm">{t('common.requests')}</p>
                <p className="text-4xl font-black text-white mt-2">{arNumber(registrationRequests)}</p>
              </div>
              <div className="size-14 rounded-2xl border border-orange-500/30 bg-orange-500/10 text-orange-400 flex items-center justify-center">
                <UserPlus className="h-7 w-7" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            <div className="lg:col-span-3 rounded-3xl border border-cyan-400/15 bg-[#0a1314]/80 backdrop-blur-xl p-5 h-[calc(100vh-320px)] flex flex-col relative overflow-hidden">
              <div className="absolute inset-0 bg-cyan-400/5 pointer-events-none" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-cyan-300" />
                  {t('common.management')}
                </h3>
                <Button
                  size="icon"
                  variant="outline"
                  className="border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/15"
                  onClick={() => {
                    setEditingRegion(null);
                    setShowRegionModal(true);
                  }}
                  data-testid="button-add-region"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="relative mb-4">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={regionSearchTerm}
                  onChange={(event) => setRegionSearchTerm(event.target.value)}
                  placeholder={t('common.region_3')}
                  className="bg-black/30 border-white/10 pr-10 pl-10 text-white"
                />
                {regionSearchTerm.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRegionSearchTerm("")}
                    aria-label={t('common.scan_search_3')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 relative z-10">
                <button
                  type="button"
                  onClick={() => setSelectedRegionId("all")}
                  className={
                    selectedRegionId === "all"
                      ? "w-full text-right p-4 rounded-xl border border-cyan-400/35 bg-cyan-400/10"
                      : "w-full text-right p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
                  }
                >
                  <p className="text-sm font-bold text-white">{t('common.item_14397')}</p>
                  <p className="text-xs text-slate-400">{arNumber(users.length)}{t('common.item_9540')}</p>
                </button>

                {filteredRegions.map((region) => {
                  const usersCount = users.filter((user) => user.regionId === region.id).length;
                  const isSelected = selectedRegionId === region.id;

                  return (
                    <div
                      key={region.id}
                      className={
                        isSelected
                          ? "p-4 rounded-xl border border-cyan-400/35 bg-cyan-400/10 shadow-[0_0_15px_rgba(13,223,242,0.12)]"
                          : "p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRegionId(region.id)}
                          className="text-right flex-1"
                        >
                          <p className={isSelected ? "text-cyan-300 font-bold text-sm" : "text-slate-300 font-bold text-sm"}>{region.name}</p>
                          <p className={isSelected ? "text-cyan-300/80 text-xs" : "text-slate-500 text-xs"}>{arNumber(usersCount)}{t('common.item_9540')}</p>
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-slate-400 hover:text-cyan-300 hover:bg-cyan-400/10"
                          onClick={() => handleEditRegion(region)}
                          data-testid={`button-edit-region-${region.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {filteredRegions.length === 0 && (
                  <div className="text-center text-sm text-slate-500 py-6 border border-dashed border-white/10 rounded-xl">
                    {t('common.no')}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 rounded-3xl border border-cyan-400/15 bg-[#0a1314]/80 backdrop-blur-xl p-5 flex flex-col min-h-[calc(100vh-320px)]">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant={roleFilter === "all" ? "default" : "ghost"}
                    onClick={() => setRoleFilter("all")}
                    className={roleFilter === "all" ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/30" : "text-slate-400 hover:text-white hover:bg-white/5"}
                  >
                    {t('users.all_count', { count: arNumber(filteredUsers.length) })}
                  </Button>
                  <Button
                    variant={roleFilter === "managers" ? "default" : "ghost"}
                    onClick={() => setRoleFilter("managers")}
                    className={roleFilter === "managers" ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/30" : "text-slate-400 hover:text-white hover:bg-white/5"}
                  >
                    {t('users.count', { count: arNumber(managersCount) })}
                  </Button>
                  <Button
                    variant={roleFilter === "technicians" ? "default" : "ghost"}
                    onClick={() => setRoleFilter("technicians")}
                    className={roleFilter === "technicians" ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/30" : "text-slate-400 hover:text-white hover:bg-white/5"}
                  >
                    {t('users.technician_count', { count: arNumber(techniciansCount) })}
                  </Button>
                </div>

                <div className="flex items-center gap-2 w-full xl:w-auto">
                  <div className="relative w-full xl:w-80">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      value={userSearchTerm}
                      onChange={(event) => setUserSearchTerm(event.target.value)}
                      placeholder={t('common.search_1')}
                      className="bg-white/5 border-white/10 pr-10 pl-10 text-white"
                      data-testid="input-search-user"
                    />
                    {userSearchTerm.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => setUserSearchTerm("")}
                        aria-label={t('common.scan_search_3')}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    onClick={handleExportUsers}
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                    data-testid="button-export-users"
                  >
                    <FileSpreadsheet className="h-4 w-4 ml-2" />
                    {t('common.export')}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-[2fr_1.3fr_1.2fr_1fr_1fr] gap-4 px-4 py-3 text-xs font-bold tracking-wider text-slate-400 border-b border-white/10">
                <div>{t('common.user')}</div>
                <div>{t('common.item_20817')}</div>
                <div>{t('common.region')}</div>
                <div className="text-center">{t('common.status')}</div>
                <div className="text-center">{t('common.item_14214')}</div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-2">
                {filteredUsers.map((user) => {
                  const regionName = user.regionId ? regions.find((region) => region.id === user.regionId)?.name || t('common.item_11173') : t('common.region_9');

                  return (
                    <div
                      key={user.id}
                      className="grid grid-cols-[2fr_1.3fr_1.2fr_1fr_1fr] gap-4 items-center px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.03] hover:border-cyan-400/20 hover:bg-cyan-400/[0.04] hover:-translate-y-[1px] hover:shadow-[0_10px_25px_-10px_rgba(13,223,242,0.25)] transition-all"
                      data-testid={`row-user-${user.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-full border border-cyan-400/30 bg-cyan-400/10 text-cyan-200 flex items-center justify-center font-bold text-xs shrink-0">
                          {userInitials(user.fullName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{user.fullName}</p>
                          <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                        </div>
                      </div>

                      <div>
                        <Badge variant="outline" className={roleBadgeClass(user.role)}>
                          {ROLE_LABELS_AR[user.role as keyof typeof ROLE_LABELS_AR]}
                        </Badge>
                      </div>

                      <div className="text-sm text-slate-300">{regionName}</div>

                      <div className="flex items-center justify-center gap-2">
                        <span className={user.isActive ? "w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "w-2.5 h-2.5 rounded-full bg-slate-500"} />
                        <span className={user.isActive ? "text-xs text-green-400 font-bold" : "text-xs text-slate-400 font-bold"}>
                          {user.isActive ? t('common.item_6376') : t('common.item_11197')}
                        </span>
                      </div>

                      <div className="flex items-center justify-center gap-1">
                        {user.role === "technician" && (
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-sky-300 hover:bg-sky-400/10"
                            title={t('common.view_details')}
                            data-testid={`button-user-details-${user.id}`}
                          >
                            <Link href={`/employee-detailed-profile-template?userId=${user.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-cyan-300 hover:bg-cyan-400/10"
                          onClick={() => handleEditUser(user)}
                          title={t('common.edit_4')}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-cyan-300 hover:bg-cyan-400/10"
                          onClick={() => handleEditUser(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={user.isActive ? "text-slate-400 hover:text-orange-300 hover:bg-orange-400/10" : "text-slate-400 hover:text-green-300 hover:bg-green-400/10"}
                          onClick={() => toggleUserStatusMutation.mutate({ id: user.id, isActive: !user.isActive })}
                          data-testid={`button-toggle-user-${user.id}`}
                        >
                          {user.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-red-300 hover:bg-red-400/10"
                          onClick={() => {
                            if (window.confirm(t('common.delete_user', { var_0: user.fullName }))) {
                              deleteUserMutation.mutate(user.id);
                            }
                          }}
                          data-testid={`button-delete-user-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <div className="text-center text-sm text-slate-500 py-10 border border-dashed border-white/10 rounded-xl">
                    {t('common.no_results')}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 flex flex-col items-center gap-3">
                <span className="text-xs text-slate-500">{t('common.view')}{arNumber(displayedFrom)} - {arNumber(displayedTo)}{t('common.item_8007')}{arNumber(totalUsers)}{t('common.item_9540')}</span>
                <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-2xl p-1">
                  <button type="button" className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button type="button" className="w-9 h-9 rounded-xl bg-gradient-to-r from-cyan-300 to-blue-500 text-[#061113] font-bold">
                    {t('common.item_1633')}
                  </button>
                  <button type="button" className="w-9 h-9 rounded-xl text-slate-500">{t('common.item_1634')}</button>
                  <button type="button" className="w-9 h-9 rounded-xl text-slate-500">{t('common.item_1635')}</button>
                  <button type="button" className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Dialog
          open={showRegionModal}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseRegionModal();
            } else {
              setShowRegionModal(true);
            }
          }}
        >
          <DialogContent className="max-w-md bg-[#0a1314] border border-cyan-400/20 text-white">
            <DialogHeader>
              <DialogTitle>{editingRegion ? t('common.update_region') : t('common.add_region')}</DialogTitle>
              <DialogDescription className="text-slate-400">{t('common.data_region')}</DialogDescription>
            </DialogHeader>
            <Form {...regionForm}>
              <form onSubmit={regionForm.handleSubmit(handleRegionSubmit)} className="space-y-4">
                <FormField
                  control={regionForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.name_region')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('common.name_region_1')} className="bg-black/30 border-white/15" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={regionForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.item_19205')}</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder={t('common.region_4')} className="bg-black/30 border-white/15" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={regionForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-white/10 p-3 bg-black/20">
                      <FormLabel>{t('common.region_2')}</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={createRegionMutation.isPending || updateRegionMutation.isPending}>
                    {editingRegion ? t('common.update') : t('common.add')}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCloseRegionModal}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={showUserModal}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseUserModal();
            } else {
              setShowUserModal(true);
            }
          }}
        >
          <DialogContent className="max-w-md bg-[#0a1314] border border-cyan-400/20 text-white">
            <DialogHeader>
              <DialogTitle>{editingUser ? t('common.update_data_user') : t('common.add_new')}</DialogTitle>
              <DialogDescription className="text-slate-400">{t('common.data_user')}</DialogDescription>
            </DialogHeader>
            <Form {...userForm}>
              <form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="space-y-4">
                <FormField
                  control={userForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.name_user')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('common.name_user')} className="bg-black/30 border-white/15" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={userForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.name')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('common.name')} className="bg-black/30 border-white/15" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={userForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.item_25511')}</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder={t('common.item_25511')} className="bg-black/30 border-white/15" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={userForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.item_15983')}{editingUser ? t('common.edit_2') : ""}</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder={t('common.item_15983')} className="bg-black/30 border-white/15" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={userForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.item_7955')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-black/30 border-white/15">
                            <SelectValue placeholder={t('common.item_14307')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">{ROLE_LABELS_AR.admin}</SelectItem>
                          <SelectItem value="supervisor">{ROLE_LABELS_AR.supervisor}</SelectItem>
                          <SelectItem value="technician">{ROLE_LABELS_AR.technician}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={userForm.control}
                  name="regionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.region')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-black/30 border-white/15">
                            <SelectValue placeholder={t('common.region_5')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {regions.map((region) => (
                            <SelectItem key={region.id} value={region.id}>
                              {region.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={userForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-white/10 p-3 bg-black/20">
                      <FormLabel>{t('common.active')}</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                    {editingUser ? t('common.update') : t('common.add')}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCloseUserModal}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    
  );
}

