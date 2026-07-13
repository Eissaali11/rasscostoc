import { useTranslation } from "@/lib/language";
import { useEffect, useMemo } from "react";
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

const getFormSchema = (t: (key: string) => string) => z.object(
{
  name: z.string().min(1, t('warehouse.name_warehouse_1')),
  location: z.string().min(1, t('warehouse.signed_1')),
  description: z.string().optional(),
  regionId: z.string().optional(),
}
);

type FormData = z.infer<ReturnType<typeof getFormSchema>>;

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
  const { t } = useTranslation();
  const formSchema = useMemo(() => getFormSchema(t), [t]);
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
        title: t('warehouse.completed_update_warehouse_suc'),
        description: t('warehouse.completed_save_warehouse'),
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('warehouse.error_update_warehouse'),
        description: error.message || t('warehouse.error_update_warehouse_1'),
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
          <DialogTitle>{t('warehouse.edit_data_warehouse')}</DialogTitle>
          <DialogDescription>
            {t('warehouse.data_warehouse_1')}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('warehouse.name_warehouse')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('warehouse.warehouse_primary')}
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
                  <FormLabel>{t('warehouse.signed')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('warehouse.item_30563')}
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
                  <FormLabel>{t('warehouse.item_19205')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('warehouse.warehouse_1')}
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
                  <FormLabel>{t('warehouse.region')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-warehouse-region">
                        <SelectValue placeholder={t('warehouse.region_1')} />
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
                {updateWarehouseMutation.isPending ? t('warehouse.save') : t('warehouse.save_1')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-edit-warehouse"
              >
                {t('warehouse.cancel')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
