import { useTranslation } from "@/lib/language";
import { useState, useMemo } from "react";
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

const getFormSchema = (t: (key: string) => string) => insertInventoryItemSchema.extend(
{
  quantity: z.number().min(0, t('common.quantity_6')),
  minThreshold: z.number().min(0, t('common.item_44777')),
  technicianName: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
}
);

type FormData = z.infer<ReturnType<typeof getFormSchema>>;

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddItemModal({ open, onOpenChange }: AddItemModalProps) {
  const { t } = useTranslation();
  const formSchema = useMemo(() => getFormSchema(t), [t]);
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
        title: t('common.completed_add_successfully'),
        description: t('common.completed_add_new_inventory'),
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error_add_1'),
        description: error.message || t('common.error_add'),
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
          <DialogTitle>{t('common.add_new_1')}</DialogTitle>
          <DialogDescription>
            {t('common.data_new_inventory')}
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
                      placeholder={t('common.box_2')}
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
                  <FormLabel>{t('common.type_4')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-item-type">
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
                      placeholder={t('common.item_30312')}
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
                  <FormLabel>{t('common.quantity_5')}</FormLabel>
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
                  <FormLabel>{t('common.item_27140')}</FormLabel>
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
                  <FormLabel>{t('common.name_technician')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('common.item_17624')}
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
                  <FormLabel>{t('common.city_1')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('common.item_31864')}
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
                {addItemMutation.isPending ? t('common.add_8') : t('common.add_2')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-add-item"
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

