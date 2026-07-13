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

const getFormSchema = (t: (key: string) => string) => z.object(
{
  name: z.string().min(1, t('common.name_9')),
  type: z.enum(["devices", "sim", "papers"], { required_error: t('common.type_6') }),
  unit: z.string().min(1, t('common.unit_3')),
  minThreshold: z.number().min(0, t('common.item_44777')),
}
);

type FormData = z.infer<ReturnType<typeof getFormSchema>>;

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
  const { t } = useTranslation();
  const formSchema = useMemo(() => getFormSchema(t), [t]);
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
        title: t('common.completed_edit_successfully'),
        description: t('common.completed_update_data_successf'),
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error_edit'),
        description: error.message || t('common.error_update_data'),
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
          <DialogTitle>{t('common.edit_3')}</DialogTitle>
          <DialogDescription>
            {t('inventory.edit_item_data', { name: selectedItem?.name })}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.name_8')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('common.item_27402')}
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
                  <FormLabel>{t('common.type_4')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-type">
                        <SelectValue placeholder={t('common.type_5')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="devices">{t('common.devices_3')}</SelectItem>
                      <SelectItem value="sim">{t('common.sims_1')}</SelectItem>
                      <SelectItem value="papers">{t('common.item_7941')}</SelectItem>
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
                  <FormLabel>{t('common.unit_2')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('common.box_1')}
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
                  <FormLabel>{t('common.item_27140')}</FormLabel>
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
                {editItemMutation.isPending ? t('common.update_3') : t('common.save_1')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-edit"
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
