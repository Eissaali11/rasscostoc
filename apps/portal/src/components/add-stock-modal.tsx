import { useTranslation } from "@/lib/language";
import { useEffect, useMemo } from "react";
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

const getFormSchema = (t: (key: string) => string) => z.object({
  quantity: z.number().min(1, t('common.quantity_8')),
  reason: z.string().optional(),
});

type FormData = z.infer<ReturnType<typeof getFormSchema>>;

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
  const { t } = useTranslation();
  const { toast } = useToast();

  const formSchema = useMemo(() => getFormSchema(t), [t]);

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
        title: t('common.completed_add_successfully_1'),
        description: t('common.completed_add_quantity_invento'),
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error_add_2'),
        description: error.message || t('common.error_add_inventory'),
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
          <DialogTitle>{t('common.add_9')}</DialogTitle>
          <DialogDescription>
            {t('inventory.add_quantity_of', { name: selectedItem?.name })}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">{t('common.item_19111')}</p>
              <p className="font-semibold">{selectedItem?.name}</p>
              <p className="text-sm text-muted-foreground">{t('common.quantity_17')}{selectedItem?.quantity}</p>
            </div>

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.quantity_7')}</FormLabel>
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
                  <FormLabel>{t('common.reason_add')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('common.returned_customer')}
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
                {addStockMutation.isPending ? t('common.add_8') : t('common.confirm_add')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-add"
              >
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
