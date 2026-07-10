import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import type { Region } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(1, "اسم المستودع مطلوب"),
  location: z.string().min(1, "الموقع مطلوب"),
  description: z.string().optional(),
  regionId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface WarehouseData {
  id: string;
  name: string;
  location: string;
  description: string | null;
  regionId: string | null;
}

interface EditWarehouseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse: WarehouseData | null;
}

export default function EditWarehouseModal({ 
  open, 
  onOpenChange,
  warehouse,
}: EditWarehouseModalProps) {
  const { toast } = useToast();

  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ["/api/regions"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      location: "",
      description: "",
      regionId: "",
    },
  });

  useEffect(() => {
    if (warehouse && open) {
      form.reset({
        name: warehouse.name,
        location: warehouse.location,
        description: warehouse.description || "",
        regionId: warehouse.regionId || "",
      });
    }
  }, [warehouse, open, form]);

  const updateWarehouseMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("PUT", `/api/warehouses/${warehouse?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({
        title: "تم تحديث المستودع بنجاح",
        description: "تم حفظ التعديلات على المستودع",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في تحديث المستودع",
        description: error.message || "حدث خطأ أثناء تحديث المستودع",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    updateWarehouseMutation.mutate(data);
  };

  if (!warehouse) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تعديل بيانات المستودع</DialogTitle>
          <DialogDescription>
            قم بتحديث بيانات المستودع
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم المستودع</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="مثل: مستودع الرياض الرئيسي"
                      {...field}
                      data-testid="input-edit-warehouse-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الموقع</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="مثل: الرياض - حي الملك فهد"
                      {...field}
                      data-testid="input-edit-warehouse-location"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الوصف (اختياري)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="وصف المستودع..."
                      className="resize-none"
                      {...field}
                      data-testid="textarea-edit-warehouse-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="regionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المنطقة (اختياري)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-warehouse-region">
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

            <div className="flex items-center space-x-3 space-x-reverse pt-4">
              <Button
                type="submit"
                disabled={updateWarehouseMutation.isPending}
                className="flex-1 bg-gradient-to-r from-[#18B2B0] to-teal-500 hover:from-[#16a09e] hover:to-teal-600"
                data-testid="button-submit-edit-warehouse"
              >
                {updateWarehouseMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-edit-warehouse"
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
