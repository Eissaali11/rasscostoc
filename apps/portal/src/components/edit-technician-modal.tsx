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
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertTechnicianInventorySchema, TechnicianInventory } from "@shared/schema";
import { useEffect } from "react";

const formSchema = insertTechnicianInventorySchema.extend({
  n950Devices: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  i900Devices: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  rollPaper: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  stickers: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  mobilySim: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  stcSim: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  zainSim: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
});

type FormData = z.infer<typeof formSchema>;

interface EditTechnicianModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technician: TechnicianInventory | null;
}

export default function EditTechnicianModal({ open, onOpenChange, technician }: EditTechnicianModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      technicianName: "",
      city: "",
      n950Devices: 0,
      i900Devices: 0,
      rollPaper: 0,
      stickers: 0,
      mobilySim: 0,
      stcSim: 0,
      zainSim: 0,
      notes: "",
    },
  });

  // Update form when technician changes
  useEffect(() => {
    if (technician) {
      form.reset({
        technicianName: technician.technicianName,
        city: technician.city,
        n950Devices: (technician.n950Boxes * 10) + technician.n950Units,
        i900Devices: (technician.i9000sBoxes * 10) + technician.i9000sUnits,
        rollPaper: (technician.rollPaperBoxes * 10) + technician.rollPaperUnits,
        stickers: (technician.stickersBoxes * 10) + technician.stickersUnits,
        mobilySim: (technician.mobilySimBoxes * 10) + technician.mobilySimUnits,
        stcSim: (technician.stcSimBoxes * 10) + technician.stcSimUnits,
        zainSim: (technician.zainSimBoxes * 10) + technician.zainSimUnits,
        notes: technician.notes || "",
        regionId: technician.regionId,
      });
    }
  }, [technician, form]);

  const updateTechMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!technician) return;
      const response = await apiRequest("PATCH", `/api/technicians/${technician.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      toast({
        title: "تم التعديل بنجاح",
        description: "تم تحديث بيانات المندوب",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في التعديل",
        description: error.message || "حدث خطأ أثناء تحديث البيانات",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    updateTechMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">تعديل بيانات مندوب</DialogTitle>
          <DialogDescription className="text-sm">
            قم بتعديل بيانات المندوب وتجهيزاته
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="n950Devices"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>أجهزة N950</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        value={field.value || 0}
                        data-testid="input-n950"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="i900Devices"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>أجهزة I900</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        value={field.value || 0}
                        data-testid="input-i900"
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
                name="rollPaper"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>أوراق رول</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        value={field.value || 0}
                        data-testid="input-roll-paper"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stickers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ملصقات مداى</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        value={field.value || 0}
                        data-testid="input-stickers"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="mobilySim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>شرائح موبايلي</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        value={field.value || 0}
                        data-testid="input-mobily"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stcSim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>شرائح STC</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        value={field.value || 0}
                        data-testid="input-stc"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zainSim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>شرائح زين</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        value={field.value || 0}
                        data-testid="input-zain"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                disabled={updateTechMutation.isPending}
                className="flex-1 text-sm sm:text-base"
                data-testid="button-submit"
              >
                {updateTechMutation.isPending ? "جاري التحديث..." : "حفظ التعديلات"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

