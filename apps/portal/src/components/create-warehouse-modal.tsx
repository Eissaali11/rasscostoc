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

interface CreateWarehouseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateWarehouseModal({ 
  open, 
  onOpenChange,
}: CreateWarehouseModalProps) {
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
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const createWarehouseMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("POST", "/api/warehouses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({
        title: t('warehouse.completed_warehouse_successful'),
        description: t('warehouse.completed_add_warehouse_new_sy'),
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('warehouse.error_warehouse'),
        description: error.message || t('warehouse.error_warehouse_1'),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createWarehouseMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('warehouse.add_warehouse_new')}</DialogTitle>
          <DialogDescription>
            {t('warehouse.data_warehouse_new')}
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
                      data-testid="input-warehouse-name"
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
                      data-testid="input-warehouse-location"
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
                      data-testid="textarea-warehouse-description"
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
                      <SelectTrigger data-testid="select-warehouse-region">
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
                disabled={createWarehouseMutation.isPending}
                className="flex-1"
                data-testid="button-submit-warehouse"
              >
                {createWarehouseMutation.isPending ? t('warehouse.item_17610') : t('warehouse.warehouse_2')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-warehouse"
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
