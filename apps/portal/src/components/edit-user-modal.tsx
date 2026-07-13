import { useTranslation, t } from "@/lib/language";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import type { UserSafe } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, User as UserIcon, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const editUserFormSchema = insertUserSchema.extend({
  city: z.string().optional(),
  password: z.string().optional(),
  employeeCode: z.string().optional(),
  technicianCode: z.string().optional(),
  department: z.string().optional(),
  permissions: z.string().optional(),
});

type EditUserFormData = z.infer<typeof editUserFormSchema>;

export function EditUserModal({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserSafe | null;
}) {
  const { toast } = useToast();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EditUserFormData, any, EditUserFormData>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      fullName: "",
      profileImage: "",
      city: "",
      role: "technician",
      isActive: true,
      employeeCode: "",
      technicianCode: "",
      department: "",
      permissions: "",
    },
  });

  useEffect(() => {
  const { t } = useTranslation();
    if (user) {
      let initialPermissions = "";
      if (user.permissions) {
        try {
          const parsed = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
          if (Array.isArray(parsed)) {
            initialPermissions = parsed.join(", ");
          }
        } catch (e) {
          initialPermissions = user.permissions;
        }
      }

      form.reset({
        username: user.username,
        email: user.email,
        password: "",
        fullName: user.fullName,
        profileImage: user.profileImage || "",
        city: user.city || "",
        role: user.role as any,
        isActive: user.isActive,
        employeeCode: user.employeeCode || "",
        technicianCode: user.technicianCode || "",
        department: user.department || "",
        permissions: initialPermissions,
      });
      setProfileImage(user.profileImage || null);
    }
  }, [user, form]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: t('users.size_image'),
          description: t('users.image'),
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: t('users.type_file'),
          description: t('users.image_1'),
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProfileImage(base64String);
        form.setValue('profileImage', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setProfileImage(null);
    form.setValue('profileImage', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateUserMutation = useMutation({
    mutationFn: async (data: EditUserFormData) => {
      let processedPermissions = "";
      if (data.permissions) {
        const permsArray = data.permissions
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        processedPermissions = JSON.stringify(permsArray);
      } else {
        processedPermissions = JSON.stringify([]);
      }

      const updateData = {
        ...data,
        employeeCode: data.employeeCode || null,
        technicianCode: data.technicianCode || null,
        department: data.department || null,
        permissions: processedPermissions,
      };
      if (!updateData.password) {
        delete updateData.password;
      }
      updateData.profileImage = profileImage || undefined;
      return await apiRequest("PATCH", `/api/users/${user?.id}`, updateData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      await queryClient.refetchQueries({ queryKey: ["/api/users"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: t('users.completed_update_successfully'),
        description: t('users.completed_update_data_user'),
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('users.error'),
        description: error?.message || t('users.fail_update_user'),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditUserFormData) => {
    updateUserMutation.mutate(data);
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {t('users.edit_user')}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t('users.data_user')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Profile Image Upload */}
            <div className="flex flex-col items-center gap-4 p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700">
              <div className="relative">
                <Avatar key={profileImage || 'no-image'} className="h-32 w-32 border-4 border-white dark:border-slate-700 shadow-xl">
                  <AvatarImage 
                    src={profileImage || undefined} 
                    alt="Profile"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-3xl font-bold">
                    {getInitials(form.watch('fullName'))}
                  </AvatarFallback>
                </Avatar>
                {profileImage && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-lg transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="edit-profile-image-upload"
                />
                <label
                  htmlFor="edit-profile-image-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg cursor-pointer shadow-lg transition-all font-semibold"
                >
                  <Upload className="h-4 w-4" />
                  {profileImage ? t('users.image_2') : t('users.image_3')}
                </label>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  {t('users.phrase_02b1fb67')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t('users.name')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('users.name_3')}
                        className="h-11"
                        data-testid="input-fullname"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t('users.name_user')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('users.name_user_1')}
                        className="h-11"
                        data-testid="input-username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t('users.item_25511')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="example@company.com"
                        className="h-11"
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t('users.item_35144')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={t('users.item_41458')}
                        className="h-11"
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t('users.city_1')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('users.city_2')}
                        className="h-11"
                        data-testid="input-city"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t('users.item_12715')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      data-testid="select-role"
                    >
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={t('users.item_19067')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">{t('users.item_118759')}</SelectItem>
                        <SelectItem value="supervisor">{t('users.supervisor_1')}</SelectItem>
                        <SelectItem value="courier_supervisor">{t('users.supervisor_delivery')}</SelectItem>
                        <SelectItem value="warehouse">{t('users.warehouse_1')}</SelectItem>
                        <SelectItem value="technician">{t('users.item_240988')}</SelectItem>
                        <SelectItem value="viewer">{t('users.item_185495')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t('users.item_19201')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('users.name_4')}
                        className="h-11"
                        data-testid="input-department"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employeeCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t('users.number_8')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('users.number_9')}
                        className="h-11"
                        data-testid="input-employee-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("role") === "technician" && (
                <FormField
                  control={form.control}
                  name="technicianCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">{t('users.number_technician_1')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('users.number_technician_2')}
                          className="h-11"
                          data-testid="input-technician-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel className="font-bold">{t('users.item_47989')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('users.item_10499')}
                        className="h-11"
                        data-testid="input-permissions"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between space-y-0 rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="font-bold">{t('users.status_user')}</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        {field.value ? t('users.active') : t('users.inactive')}
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="px-6"
                data-testid="button-cancel"
              >
                {t('users.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={updateUserMutation.isPending}
                className="px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                data-testid="button-submit"
              >
                {updateUserMutation.isPending ? t('users.update_1') : t('users.save_1')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

