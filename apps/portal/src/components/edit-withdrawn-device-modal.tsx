import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertWithdrawnDeviceSchema, WithdrawnDevice } from "@shared/schema";

const formSchema = insertWithdrawnDeviceSchema.extend({
  city: z.string().min(1, "المدينة مطلوبة"),
  technicianName: z.string().min(1, "اسم المندوب مطلوب"),
  terminalId: z.string().min(1, "رقم الجهاز مطلوب"),
  serialNumber: z.string().min(1, "الرقم التسلسلي مطلوب"),
  battery: z.string().min(1, "حالة البطارية مطلوبة"),
  chargerCable: z.string().min(1, "كابل الشاحن مطلوب"),
  chargerHead: z.string().min(1, "رأس الشاحن مطلوب"),
  hasSim: z.string().min(1, "وجود شريحة مطلوب"),
});

type FormData = z.infer<typeof formSchema>;

interface EditWithdrawnDeviceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: WithdrawnDevice | null;
}

export default function EditWithdrawnDeviceModal({ open, onOpenChange, device }: EditWithdrawnDeviceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      city: "",
      technicianName: "",
      terminalId: "",
      serialNumber: "",
      battery: "",
      chargerCable: "",
      chargerHead: "",
      hasSim: "",
      simCardType: "",
      damagePart: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (device && open) {
      form.reset({
        city: device.city,
        technicianName: device.technicianName,
        terminalId: device.terminalId,
        serialNumber: device.serialNumber,
        battery: device.battery,
        chargerCable: device.chargerCable,
        chargerHead: device.chargerHead,
        hasSim: device.hasSim,
        simCardType: device.simCardType || "",
        damagePart: device.damagePart || "",
        notes: device.notes || "",
      });
    }
  }, [device, open, form]);

  const updateDeviceMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("PATCH", `/api/withdrawn-devices/${device?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawn-devices"] });
      toast({
        title: "تم التحديث بنجاح",
        description: "تم تحديث بيانات الجهاز المسحوب بنجاح",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في التحديث",
        description: error.message || "حدث خطأ أثناء تحديث البيانات",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    updateDeviceMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">تعديل بيانات الجهاز المسحوب</DialogTitle>
          <DialogDescription className="text-sm">
            قم بتعديل بيانات الجهاز المسحوب من الخدمة
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المدينة</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="أدخل اسم المدينة"
                        {...field}
                        data-testid="input-city"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="technicianName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المندوب</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="أدخل اسم المندوب"
                        {...field}
                        data-testid="input-technician-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="terminalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم الجهاز (Terminal ID)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="أدخل رقم الجهاز"
                        {...field}
                        data-testid="input-terminal-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الرقم التسلسلي</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="أدخل الرقم التسلسلي"
                        {...field}
                        data-testid="input-serial-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="battery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>حالة البطارية</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-battery">
                          <SelectValue placeholder="اختر حالة البطارية" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="جيدة">جيدة</SelectItem>
                        <SelectItem value="متوسطة">متوسطة</SelectItem>
                        <SelectItem value="سيئة">سيئة</SelectItem>
                        <SelectItem value="لا توجد">لا توجد</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="chargerCable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كابل الشاحن</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-charger-cable">
                          <SelectValue placeholder="اختر حالة كابل الشاحن" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="موجود">موجود</SelectItem>
                        <SelectItem value="غير موجود">غير موجود</SelectItem>
                        <SelectItem value="تالف">تالف</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="chargerHead"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رأس الشاحن</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-charger-head">
                          <SelectValue placeholder="اختر حالة رأس الشاحن" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="موجود">موجود</SelectItem>
                        <SelectItem value="غير موجود">غير موجود</SelectItem>
                        <SelectItem value="تالف">تالف</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hasSim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>وجود شريحة الاتصال</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-has-sim">
                          <SelectValue placeholder="اختر وجود الشريحة" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="نعم">نعم</SelectItem>
                        <SelectItem value="لا">لا</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="simCardType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نوع شريحة الاتصال</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-sim-type">
                        <SelectValue placeholder="اختر نوع الشريحة" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Mobily">Mobily</SelectItem>
                      <SelectItem value="STC">STC</SelectItem>
                      <SelectItem value="Zain">Zain</SelectItem>
                      <SelectItem value="غير محدد">غير محدد</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="damagePart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الضرر في الجهاز</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="صف الضرر الموجود في الجهاز (إن وجد)"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-damage-part"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ملاحظات</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="أضف ملاحظات إضافية..."
                      {...field}
                      value={field.value || ""}
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center space-x-2 sm:space-x-3 space-x-reverse pt-3 sm:pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1 text-sm sm:text-base"
                data-testid="button-cancel"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={updateDeviceMutation.isPending}
                className="flex-1 text-sm sm:text-base"
                data-testid="button-submit"
              >
                {updateDeviceMutation.isPending ? "جاري التحديث..." : "حفظ التعديلات"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

