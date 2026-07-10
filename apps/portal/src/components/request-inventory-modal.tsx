import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PackageOpen } from "lucide-react";

const formSchema = z.object({
  n950Boxes: z.number().min(0).default(0),
  n950Units: z.number().min(0).default(0),
  i9000sBoxes: z.number().min(0).default(0),
  i9000sUnits: z.number().min(0).default(0),
  i9100Boxes: z.number().min(0).default(0),
  i9100Units: z.number().min(0).default(0),
  rollPaperBoxes: z.number().min(0).default(0),
  rollPaperUnits: z.number().min(0).default(0),
  stickersBoxes: z.number().min(0).default(0),
  stickersUnits: z.number().min(0).default(0),
  newBatteriesBoxes: z.number().min(0).default(0),
  newBatteriesUnits: z.number().min(0).default(0),
  mobilySimBoxes: z.number().min(0).default(0),
  mobilySimUnits: z.number().min(0).default(0),
  stcSimBoxes: z.number().min(0).default(0),
  stcSimUnits: z.number().min(0).default(0),
  zainSimBoxes: z.number().min(0).default(0),
  zainSimUnits: z.number().min(0).default(0),
  lebaraBoxes: z.number().min(0).default(0),
  lebaraUnits: z.number().min(0).default(0),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface RequestInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RequestInventoryModal({ 
  open, 
  onOpenChange, 
}: RequestInventoryModalProps) {
  const { toast } = useToast();

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
      lebaraBoxes: 0,
      lebaraUnits: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const requestMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("POST", "/api/inventory-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-requests/my"] });
      toast({
        title: "تم إرسال الطلب بنجاح",
        description: "سيتم مراجعة طلبك من قبل المدير",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إرسال الطلب",
        description: error.message || "حدث خطأ أثناء إرسال الطلب",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    // تحقق من أن هناك على الأقل صنف واحد مطلوب
    const hasItems = Object.entries(data).some(([key, value]) => {
      return key !== 'notes' && typeof value === 'number' && value > 0;
    });

    if (!hasItems) {
      toast({
        title: "خطأ",
        description: "يجب طلب صنف واحد على الأقل",
        variant: "destructive",
      });
      return;
    }

    requestMutation.mutate(data);
  };

  const inventoryItems = [
    { name: "N950", boxField: "n950Boxes" as const, unitField: "n950Units" as const },
    { name: "I9000S", boxField: "i9000sBoxes" as const, unitField: "i9000sUnits" as const },
    { name: "I9100", boxField: "i9100Boxes" as const, unitField: "i9100Units" as const },
    { name: "ورق الطباعة", boxField: "rollPaperBoxes" as const, unitField: "rollPaperUnits" as const },
    { name: "الملصقات", boxField: "stickersBoxes" as const, unitField: "stickersUnits" as const },
    { name: "البطاريات", boxField: "newBatteriesBoxes" as const, unitField: "newBatteriesUnits" as const },
    { name: "موبايلي", boxField: "mobilySimBoxes" as const, unitField: "mobilySimUnits" as const },
    { name: "STC", boxField: "stcSimBoxes" as const, unitField: "stcSimUnits" as const },
    { name: "زين", boxField: "zainSimBoxes" as const, unitField: "zainSimUnits" as const },
    { name: "ليبارا", boxField: "lebaraBoxes" as const, unitField: "lebaraUnits" as const },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0f0f15] border-[#18B2B0]/20 text-white">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-[#18B2B0] to-teal-500">
              <PackageOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-xl">طلب مخزون</DialogTitle>
              <DialogDescription className="text-gray-400">
                اختر الأصناف والكميات التي تحتاجها
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventoryItems.map((item) => (
                <div key={item.name} className="bg-white/5 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-[#18B2B0] text-sm">{item.name}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name={item.boxField}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-gray-400">كراتين</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              min="0"
                              className="bg-white/10 border-white/20 text-white"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid={`input-${item.boxField}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={item.unitField}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-gray-400">وحدات</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              min="0"
                              className="bg-white/10 border-white/20 text-white"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid={`input-${item.unitField}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">ملاحظات</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="أضف ملاحظات إضافية للطلب..."
                      className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 resize-none"
                      rows={3}
                      {...field}
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                data-testid="button-cancel"
              >
                إلغاء
              </Button>
              <Button 
                type="submit" 
                disabled={requestMutation.isPending}
                className="bg-gradient-to-r from-[#18B2B0] to-teal-500 hover:from-[#16a09e] hover:to-teal-600"
                data-testid="button-submit"
              >
                {requestMutation.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
