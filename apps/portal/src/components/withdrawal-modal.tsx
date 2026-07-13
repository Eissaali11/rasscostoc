import { useMemo } from "react";
import { useTranslation } from "@/lib/language";
import React, { useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { InventoryItemWithStatus } from "@shared/schema";

const getFormSchema = (t: (key: string) => string) => z.object(
{
  itemId: z.string().min(1, t('common.item_19131')),
  quantity: z.number().min(1, t('common.quantity_8')),
  reason: z.string().optional(),
}
);

type FormData = z.infer<ReturnType<typeof getFormSchema>>;

interface WithdrawalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem?: InventoryItemWithStatus | null;
  inventory?: InventoryItemWithStatus[];
}

export default function WithdrawalModal({ 
  open, 
  onOpenChange, 
  selectedItem, 
  inventory 
}: WithdrawalModalProps) {
  const { t } = useTranslation();
  const formSchema = useMemo(() => getFormSchema(t), [t]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemId: selectedItem?.id || "",
      quantity: 1,
      reason: "",
    },
  });

  // Update form when selectedItem changes
  useEffect(() => {
    if (selectedItem) {
      form.setValue("itemId", selectedItem.id);
    }
  }, [selectedItem, form]);

  const withdrawMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", `/api/inventory/${data.itemId}/withdraw`, {
        quantity: data.quantity,
        reason: data.reason,
      });
      return response.json();
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
        title: t('common.completed_withdraw_successfull'),
        description: t('common.completed_withdraw_quantity_in'),
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error_withdraw'),
        description: error.message || t('common.error_withdraw_inventory_1'),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    withdrawMutation.mutate(data);
  };

  const availableItems = inventory?.filter(item => item.quantity > 0) || [];
  const selectedItemData = inventory?.find(item => item.id === form.watch("itemId"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('common.withdraw_inventory')}</DialogTitle>
          <DialogDescription>
            {t('common.inventory_12')}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.item_14327_1')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-withdraw-item">
                        <SelectValue placeholder={t('common.item_27161')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({t('common.item_9058', { count: item.quantity })})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('common.quantity_18')}
                    {selectedItemData && (
                      <span className="text-muted-foreground mr-2">
                        {t('common.available_qty', { qty: selectedItemData.quantity })}
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max={selectedItemData?.quantity || undefined}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      data-testid="input-withdraw-quantity"
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
                  <FormLabel>{t('common.reason_withdraw')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('common.branch')}
                      className="resize-none"
                      {...field}
                      data-testid="textarea-withdraw-reason"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center space-x-3 space-x-reverse pt-4">
              <Button
                type="submit"
                disabled={withdrawMutation.isPending}
                variant="destructive"
                className="flex-1"
                data-testid="button-submit-withdrawal"
              >
                {withdrawMutation.isPending ? t('common.withdraw_2') : t('common.confirm_withdraw')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-withdrawal"
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
