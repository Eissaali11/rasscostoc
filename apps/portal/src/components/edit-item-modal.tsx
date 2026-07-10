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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { InventoryItemWithStatus } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(1, "اسم الصنف مطلوب"),
  type: z.enum(["devices", "sim", "papers"], { required_error: "نوع الصنف مطلوب" }),
  unit: z.string().min(1, "الوحدة مطلوبة"),
  minThreshold: z.number().min(0, "الحد الأدنى يجب أن يكون صفر أو أكثر"),
});

type FormData = z.infer<typeof formSchema>;

interface EditItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem: InventoryItemWithStatus | null;
}

export default function EditItemModal({ 
  open, 
  onOpenChange, 
  selectedItem 
}: EditItemModalProps) {
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "devices",
      unit: "",
      minThreshold: 0,
    },
  });

  useEffect(() => {
    if (selectedItem && open) {
      form.reset({
        name: selectedItem.name,
        type: selectedItem.type as "devices" | "sim" | "papers",
        unit: selectedItem.unit,
        minThreshold: selectedItem.minThreshold,
      });
    }
  }, [selectedItem, open, form]);

  const editItemMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!selectedItem) throw new Error("No item selected");
      return await apiRequest("PATCH", `/api/inventory/${selectedItem.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "تم التعديل بنجاح",
        description: "تم تحديث بيانات الصنف بنجاح",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في التعديل",
        description: error.message || "حدث خطأ أثناء تحديث بيانات الصنف",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    editItemMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تعديل الصنف</DialogTitle>
          <DialogDescription>
            تعديل بيانات "{selectedItem?.name}"
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم الصنف</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="مثل: نيوليب، نيولاند..."
                      {...field}
                      data-testid="input-edit-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نوع الصنف</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-type">
                        <SelectValue placeholder="اختر النوع" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="devices">أجهزة</SelectItem>
                      <SelectItem value="sim">شرائح</SelectItem>
                      <SelectItem value="papers">أوراق</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الوحدة</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="مثل: جهاز، قطعة، كرتون..."
                      {...field}
                      data-testid="input-edit-unit"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="minThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الحد الأدنى للتنبيه</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      data-testid="input-edit-min-threshold"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center space-x-3 space-x-reverse pt-4">
              <Button
                type="submit"
                disabled={editItemMutation.isPending}
                className="flex-1"
                data-testid="button-submit-edit"
              >
                {editItemMutation.isPending ? "جاري التحديث..." : "حفظ التعديلات"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-edit"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
