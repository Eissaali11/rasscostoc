import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertInventoryItemSchema } from "@shared/schema";

const formSchema = insertInventoryItemSchema.extend({
  quantity: z.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  minThreshold: z.number().min(0, "الحد الأدنى يجب أن يكون صفر أو أكثر"),
  technicianName: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddItemModal({ open, onOpenChange }: AddItemModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "",
      unit: "",
      quantity: 0,
      minThreshold: 5,
      technicianName: "",
      city: "",
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/inventory", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "تم إضافة الصنف بنجاح",
        description: "تم إضافة الصنف الجديد إلى المخزون",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إضافة الصنف",
        description: error.message || "حدث خطأ أثناء إضافة الصنف",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    addItemMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>إضافة صنف جديد</DialogTitle>
          <DialogDescription>
            أدخل بيانات الصنف الجديد لإضافته إلى المخزون
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
                      placeholder="مثل: كرتون نيولاند N950"
                      {...field}
                      data-testid="input-item-name"
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-item-type">
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
                      placeholder="مثل: كرتون، شريحة، رزمة"
                      {...field}
                      data-testid="input-item-unit"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الكمية الأولية</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      data-testid="input-item-quantity"
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
                      data-testid="input-item-threshold"
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
                      placeholder="مثل: محمد أحمد"
                      {...field}
                      value={field.value || ""}
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
                      placeholder="مثل: الرياض، جدة، الدمام"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-city"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center space-x-3 space-x-reverse pt-4">
              <Button
                type="submit"
                disabled={addItemMutation.isPending}
                className="flex-1"
                data-testid="button-submit-add-item"
              >
                {addItemMutation.isPending ? "جاري الإضافة..." : "إضافة الصنف"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-add-item"
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

