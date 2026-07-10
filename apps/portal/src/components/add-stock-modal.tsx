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
import { InventoryItemWithStatus } from "@shared/schema";

const formSchema = z.object({
  quantity: z.number().min(1, "الكمية يجب أن تكون أكثر من صفر"),
  reason: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem: InventoryItemWithStatus | null;
}

export default function AddStockModal({ 
  open, 
  onOpenChange, 
  selectedItem 
}: AddStockModalProps) {
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      reason: "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const addStockMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!selectedItem) throw new Error("No item selected");
      return await apiRequest("POST", `/api/inventory/${selectedItem.id}/add`, {
        quantity: data.quantity,
        reason: data.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/transactions"),
      });
      toast({
        title: "تم الإضافة بنجاح",
        description: "تم إضافة الكمية المطلوبة إلى المخزون",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في الإضافة",
        description: error.message || "حدث خطأ أثناء الإضافة إلى المخزون",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    addStockMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>إضافة للمخزون</DialogTitle>
          <DialogDescription>
            إضافة كمية جديدة من "{selectedItem?.name}" إلى المخزون
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">الصنف المختار</p>
              <p className="font-semibold">{selectedItem?.name}</p>
              <p className="text-sm text-muted-foreground">الكمية الحالية: {selectedItem?.quantity}</p>
            </div>

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الكمية المطلوب إضافتها</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      data-testid="input-add-quantity"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>سبب الإضافة (اختياري)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="مثل: شراء جديد، مرتجع من العميل..."
                      className="resize-none"
                      {...field}
                      data-testid="textarea-add-reason"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center space-x-3 space-x-reverse pt-4">
              <Button
                type="submit"
                disabled={addStockMutation.isPending}
                className="flex-1"
                data-testid="button-submit-add"
              >
                {addStockMutation.isPending ? "جاري الإضافة..." : "تأكيد الإضافة"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-add"
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
