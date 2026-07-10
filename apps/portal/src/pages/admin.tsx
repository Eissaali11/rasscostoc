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
  name: z.string().min(1, "اسم المنطقة مطلوب"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const userFormSchema = z.object({
  username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"),
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  fullName: z.string().min(1, "الاسم الكامل مطلوب"),
  role: z.enum(["admin", "supervisor", "technician"]),
  regionId: z.string().optional(),
  isActive: z.boolean().default(true),
});

type RoleFilter = "all" | "managers" | "technicians";

function userInitials(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean);
  return (parts[0]?.[0] || "م") + (parts[1]?.[0] || "");
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
      toast({ title: "تم إنشاء المنطقة بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء المنطقة", variant: "destructive" });
    },
  });

  const updateRegionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertRegion> }) => apiRequest("PATCH", `/api/regions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/regions"] });
      handleCloseRegionModal();
      toast({ title: "تم تحديث المنطقة بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث المنطقة", variant: "destructive" });
    },
  });

  const deleteRegionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/regions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/regions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "تم حذف المنطقة بنجاح" });
    },
    onError: (error) => {
      let message = "فشل في حذف المنطقة";
      if (error instanceof Error) {
        if (error.message.includes("Cannot delete region that has assigned users")) {
          message = "لا يمكن حذف المنطقة لأنها مرتبطة بموظفين.";
        } else if (error.message.includes("Cannot delete region")) {
          message = "لا يمكن حذف المنطقة لأنها مرتبطة ببيانات أخرى.";
        }
      }
      toast({ title: "تعذر حذف المنطقة", description: message, variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: InsertUser) => apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      handleCloseUserModal();
      toast({ title: "تم إنشاء المستخدم بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء المستخدم", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertUser> }) => apiRequest("PATCH", `/api/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      handleCloseUserModal();
      toast({ title: "تم تحديث بيانات المستخدم" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث بيانات المستخدم", variant: "destructive" });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest("PATCH", `/api/users/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "تم تحديث حالة المستخدم" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث حالة المستخدم", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "تم حذف المستخدم" });
    },
    onError: () => {
      toast({ title: "فشل في حذف المستخدم", variant: "destructive" });
    },
  });

  const bulkUserStatusMutation = useMutation({
    mutationFn: (isActive: boolean) => apiRequest("POST", "/api/users/bulk-status", { isActive }),
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: isActive ? "تم تفعيل جميع المستخدمين بنجاح" : "تم إيقاف جميع المستخدمين بنجاح",
        description: isActive
          ? "تم تفعيل حسابات جميع مستخدمي النظام بنجاح."
          : "تم إيقاف حسابات جميع مستخدمي النظام باستثناء حسابك الحالي.",
      });
    },
    onError: () => {
      toast({ title: "فشل في تحديث حالة المستخدمين الجماعية", variant: "destructive" });
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
        title: "لا توجد بيانات للتصدير",
        description: "لا يوجد مستخدمون في نتائج البحث الحالية",
        variant: "destructive",
      });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("المستخدمون");

    worksheet.addRow(["#", "اسم المستخدم", "الاسم الكامل", "البريد", "الدور", "المنطقة", "الحالة"]);

    filteredUsers.forEach((user, index) => {
      const regionName = regions.find((region) => region.id === user.regionId)?.name || "-";
      worksheet.addRow([
        index + 1,
        user.username,
        user.fullName,
        user.email,
        ROLE_LABELS_AR[user.role as keyof typeof ROLE_LABELS_AR],
        regionName,
        user.isActive ? "نشط" : "غير نشط",
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
      title: "تم التصدير بنجاح",
      description: `تم تصدير ${filteredUsers.length} مستخدم`,
    });
  };

  return (
      <div className="-m-8 min-h-[calc(100vh-5rem)] bg-[#050a0a] p-6 md:p-8 relative overflow-hidden" dir="rtl">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-cyan-400/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-cyan-300 to-blue-500 rounded-full" />
              <h1 className="text-2xl md:text-3xl font-black text-white">إدارة المستخدمين والمناطق</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => {
                  if (window.confirm("هل أنت متأكد من تفعيل جميع المستخدمين في النظام؟")) {
                    bulkUserStatusMutation.mutate(true);
                  }
                }}
                disabled={bulkUserStatusMutation.isPending}
                variant="outline"
                className="border-green-500/30 text-green-400 bg-green-500/10 hover:bg-green-500/25 font-bold"
              >
                <UserCheck className="h-4 w-4 ml-2" />
                تفعيل جميع المستخدمين
              </Button>
              <Button
                onClick={() => {
                  if (window.confirm("تحذير: هل أنت متأكد من إيقاف جميع المستخدمين في النظام؟ سيتم تعطيل الجميع باستثنائك أنت.")) {
                    bulkUserStatusMutation.mutate(false);
                  }
                }}
                disabled={bulkUserStatusMutation.isPending}
                variant="outline"
                className="border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/25 font-bold"
              >
                <XCircle className="h-4 w-4 ml-2" />
                إيقاف جميع المستخدمين
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
                إضافة مستخدم جديد
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="group relative overflow-hidden rounded-3xl border border-cyan-400/15 bg-[#0a1314]/80 backdrop-blur-xl p-6 flex items-center justify-between transition-all hover:border-cyan-300/35">
              <div className="absolute inset-0 bg-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-slate-400 text-sm">إجمالي المستخدمين</p>
                <p className="text-4xl font-black text-white mt-2">{arNumber(totalUsers)}</p>
              </div>
              <div className="size-14 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 flex items-center justify-center">
                <Users className="h-7 w-7" />
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-3xl border border-green-500/20 bg-[#0a1314]/80 backdrop-blur-xl p-6 flex items-center justify-between transition-all hover:border-green-400/40">
              <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-slate-400 text-sm">المستخدمين النشطين</p>
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
                <p className="text-slate-400 text-sm">طلبات التسجيل</p>
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
                  إدارة المناطق
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
                  placeholder="ابحث عن منطقة"
                  className="bg-black/30 border-white/10 pr-10 pl-10 text-white"
                />
                {regionSearchTerm.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRegionSearchTerm("")}
                    aria-label="مسح البحث"
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
                  <p className="text-sm font-bold text-white">كل المناطق</p>
                  <p className="text-xs text-slate-400">{arNumber(users.length)} مستخدم</p>
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
                          <p className={isSelected ? "text-cyan-300/80 text-xs" : "text-slate-500 text-xs"}>{arNumber(usersCount)} مستخدم</p>
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
                    لا توجد مناطق مطابقة
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
                    الكل ({arNumber(filteredUsers.length)})
                  </Button>
                  <Button
                    variant={roleFilter === "managers" ? "default" : "ghost"}
                    onClick={() => setRoleFilter("managers")}
                    className={roleFilter === "managers" ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/30" : "text-slate-400 hover:text-white hover:bg-white/5"}
                  >
                    المسؤولين ({arNumber(managersCount)})
                  </Button>
                  <Button
                    variant={roleFilter === "technicians" ? "default" : "ghost"}
                    onClick={() => setRoleFilter("technicians")}
                    className={roleFilter === "technicians" ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/30" : "text-slate-400 hover:text-white hover:bg-white/5"}
                  >
                    المندوبين ({arNumber(techniciansCount)})
                  </Button>
                </div>

                <div className="flex items-center gap-2 w-full xl:w-auto">
                  <div className="relative w-full xl:w-80">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      value={userSearchTerm}
                      onChange={(event) => setUserSearchTerm(event.target.value)}
                      placeholder="البحث عن مستخدم، بريد، أو دور..."
                      className="bg-white/5 border-white/10 pr-10 pl-10 text-white"
                      data-testid="input-search-user"
                    />
                    {userSearchTerm.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => setUserSearchTerm("")}
                        aria-label="مسح البحث"
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
                    تصدير
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-[2fr_1.3fr_1.2fr_1fr_1fr] gap-4 px-4 py-3 text-xs font-bold tracking-wider text-slate-400 border-b border-white/10">
                <div>المستخدم</div>
                <div>المسمى الوظيفي</div>
                <div>المنطقة</div>
                <div className="text-center">الحالة</div>
                <div className="text-center">الإجراءات</div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-2">
                {filteredUsers.map((user) => {
                  const regionName = user.regionId ? regions.find((region) => region.id === user.regionId)?.name || "غير محدد" : "بدون منطقة";

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
                          {user.isActive ? "متصل" : "غير متصل"}
                        </span>
                      </div>

                      <div className="flex items-center justify-center gap-1">
                        {user.role === "technician" && (
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-sky-300 hover:bg-sky-400/10"
                            title="عرض تفاصيل الموظف"
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
                          title="تعديل الصلاحيات"
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
                            if (window.confirm(`هل أنت متأكد من حذف المستخدم \"${user.fullName}\"؟`)) {
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
                    لا توجد نتائج مستخدمين مطابقة للفلاتر الحالية
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 flex flex-col items-center gap-3">
                <span className="text-xs text-slate-500">عرض {arNumber(displayedFrom)} - {arNumber(displayedTo)} من أصل {arNumber(totalUsers)} مستخدم</span>
                <div className="flex items-center gap-1 bg-black/30 border border-white/10 rounded-2xl p-1">
                  <button type="button" className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button type="button" className="w-9 h-9 rounded-xl bg-gradient-to-r from-cyan-300 to-blue-500 text-[#061113] font-bold">
                    ١
                  </button>
                  <button type="button" className="w-9 h-9 rounded-xl text-slate-500">٢</button>
                  <button type="button" className="w-9 h-9 rounded-xl text-slate-500">٣</button>
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
              <DialogTitle>{editingRegion ? "تحديث المنطقة" : "إضافة منطقة جديدة"}</DialogTitle>
              <DialogDescription className="text-slate-400">أدخل بيانات المنطقة</DialogDescription>
            </DialogHeader>
            <Form {...regionForm}>
              <form onSubmit={regionForm.handleSubmit(handleRegionSubmit)} className="space-y-4">
                <FormField
                  control={regionForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم المنطقة</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="أدخل اسم المنطقة" className="bg-black/30 border-white/15" />
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
                      <FormLabel>الوصف (اختياري)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="أدخل وصف المنطقة" className="bg-black/30 border-white/15" />
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
                      <FormLabel>منطقة نشطة</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={createRegionMutation.isPending || updateRegionMutation.isPending}>
                    {editingRegion ? "تحديث" : "إضافة"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCloseRegionModal}>
                    إلغاء
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
              <DialogTitle>{editingUser ? "تحديث بيانات المستخدم" : "إضافة مستخدم جديد"}</DialogTitle>
              <DialogDescription className="text-slate-400">أدخل بيانات المستخدم</DialogDescription>
            </DialogHeader>
            <Form {...userForm}>
              <form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="space-y-4">
                <FormField
                  control={userForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم المستخدم</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="اسم المستخدم" className="bg-black/30 border-white/15" />
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
                      <FormLabel>الاسم الكامل</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="الاسم الكامل" className="bg-black/30 border-white/15" />
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
                      <FormLabel>البريد الإلكتروني</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="البريد الإلكتروني" className="bg-black/30 border-white/15" />
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
                      <FormLabel>كلمة المرور {editingUser ? "(اختياري عند التعديل)" : ""}</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="كلمة المرور" className="bg-black/30 border-white/15" />
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
                      <FormLabel>الدور</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-black/30 border-white/15">
                            <SelectValue placeholder="اختر الدور" />
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
                      <FormLabel>المنطقة</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-black/30 border-white/15">
                            <SelectValue placeholder="اختر المنطقة" />
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
                      <FormLabel>حساب نشط</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                    {editingUser ? "تحديث" : "إضافة"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCloseUserModal}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    
  );
}

