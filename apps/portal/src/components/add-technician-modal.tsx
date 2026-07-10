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
import { insertTechnicianInventorySchema } from "@shared/schema";
import { useAuth } from "@/lib/auth";

const formSchema = insertTechnicianInventorySchema.extend({
  n950Boxes: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  n950Units: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  i9000sBoxes: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  i9000sUnits: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  i9100Boxes: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  i9100Units: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  rollPaperBoxes: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  rollPaperUnits: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  stickersBoxes: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  stickersUnits: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  newBatteriesBoxes: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  newBatteriesUnits: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  mobilySimBoxes: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  mobilySimUnits: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  stcSimBoxes: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  stcSimUnits: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  zainSimBoxes: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  zainSimUnits: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
}).omit({ technicianName: true, city: true });

type FormData = z.infer<typeof formSchema>;

interface AddTechnicianModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddTechnicianModal({ open, onOpenChange }: AddTechnicianModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      n950Boxes: 0,
      n950Units: 0,
      i9000sBoxes: 0,
      i9000sUnits: 0,
      i9100Boxes: 0,
      i9100Units: 0,
      rollPaperBoxes: 0,
      rollPaperUnits: 0,
      stickersBoxes: 0,
      stickersUnits: 0,
      newBatteriesBoxes: 0,
      newBatteriesUnits: 0,
      mobilySimBoxes: 0,
      mobilySimUnits: 0,
      stcSimBoxes: 0,
      stcSimUnits: 0,
      zainSimBoxes: 0,
      zainSimUnits: 0,
      notes: "",
    },
  });

  const addTechMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const dataWithUserInfo = {
        ...data,
        technicianName: user?.fullName || "",
        city: user?.city || ""
      };
      const response = await apiRequest("POST", "/api/technicians", dataWithUserInfo);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      toast({
        title: "تم إضافة بيانات المندوب بنجاح",
        description: "تم إضافة البيانات الجديدة للمندوب",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إضافة البيانات",
        description: error.message || "حدث خطأ أثناء إضافة البيانات",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    addTechMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">إضافة بيانات مندوب</DialogTitle>
          <DialogDescription className="text-sm">
            أدخل بيانات المندوب الجديد وتجهيزاته
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
            {/* عرض معلومات المندوب المسجل */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-800">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">اسم المندوب:</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-white">{user?.fullName || "غير محدد"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">المدينة:</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-white">{user?.city || "غير محدد"}</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">سيتم إضافة البيانات باسمك ومدينتك تلقائياً</p>
            </div>

            {/* N950 Devices */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">أجهزة N950</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="n950Boxes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">كراتين</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-n950-boxes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="n950Units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">وحدات</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-n950-units"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* I9000s Devices */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">أجهزة I9000s</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="i9000sBoxes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">كراتين</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-i9000s-boxes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="i9000sUnits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">وحدات</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-i9000s-units"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* I9100 Devices */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">أجهزة I9100</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="i9100Boxes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">كراتين</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-i9100-boxes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="i9100Units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">وحدات</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-i9100-units"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Roll Paper */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">أوراق رول</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="rollPaperBoxes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">كراتين</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-roll-paper-boxes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rollPaperUnits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">وحدات</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-roll-paper-units"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Stickers */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">ملصقات مدى</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="stickersBoxes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">كراتين</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-stickers-boxes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stickersUnits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">وحدات</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-stickers-units"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* New Batteries */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">بطاريات جديدة</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="newBatteriesBoxes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">كراتين</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-new-batteries-boxes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newBatteriesUnits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">وحدات</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-new-batteries-units"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Mobily SIM */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">شرائح موبايلي</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="mobilySimBoxes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">كراتين</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-mobily-sim-boxes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobilySimUnits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">وحدات</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-mobily-sim-units"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* STC SIM */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">شرائح STC</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="stcSimBoxes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">كراتين</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-stc-sim-boxes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stcSimUnits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">وحدات</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-stc-sim-units"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Zain SIM */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">شرائح زين</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="zainSimBoxes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">كراتين</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-zain-sim-boxes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zainSimUnits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">وحدات</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          value={field.value || 0}
                          data-testid="input-zain-sim-units"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                disabled={addTechMutation.isPending}
                className="flex-1 text-sm sm:text-base"
                data-testid="button-submit"
              >
                {addTechMutation.isPending ? "جاري الإضافة..." : "إضافة البيانات"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

