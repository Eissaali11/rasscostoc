import { useMemo } from "react";
import { useTranslation } from "@/lib/language";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertWithdrawnDeviceSchema } from "@shared/schema";

const getFormSchema = (t: (key: string) => string) => insertWithdrawnDeviceSchema.extend(
{
  city: z.string().min(1, t('reports.city_1')),
  technicianName: z.string().min(1, t('reports.name_technician_3')),
  terminalId: z.string().min(1, t('reports.number_device_3')),
  serialNumber: z.string().min(1, t('reports.number_serial_2')),
  battery: z.string().min(1, t('reports.status_battery_2')),
  chargerCable: z.string().min(1, t('reports.item_23935')),
  chargerHead: z.string().min(1, t('reports.item_22320')),
  hasSim: z.string().min(1, t('reports.sim_4')),
}
);

type FormData = z.infer<ReturnType<typeof getFormSchema>>;

interface AddWithdrawnDeviceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddWithdrawnDeviceModal({ open, onOpenChange }: AddWithdrawnDeviceModalProps) {
  const { t } = useTranslation();
  const formSchema = useMemo(() => getFormSchema(t), [t]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      city: "",
      technicianName: "",
      terminalId: "",
      serialNumber: "",
      battery: "",
      chargerCable: "",
      chargerHead: "",
      hasSim: "",
      simCardType: "",
      damagePart: "",
      notes: "",
    },
  });

  const addDeviceMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/withdrawn-devices", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawn-devices"] });
      toast({
        title: t('reports.completed_add_successfully'),
        description: t('reports.completed_add_device_successfu'),
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('reports.error_add'),
        description: error.message || t('reports.error_add_device'),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    addDeviceMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{t('reports.add_device')}</DialogTitle>
          <DialogDescription className="text-sm">
            {t('reports.data_device_1')}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('reports.city')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('reports.name_city')}
                        {...field}
                        data-testid="input-city"
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
                    <FormLabel>{t('reports.name_technician_1')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('reports.name_technician_2')}
                        {...field}
                        data-testid="input-technician-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="terminalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('reports.number_device_1')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('reports.number_device_2')}
                        {...field}
                        data-testid="input-terminal-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('reports.number_serial')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('reports.number_serial_1')}
                        {...field}
                        data-testid="input-serial-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="battery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('reports.status_battery')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-battery">
                          <SelectValue placeholder={t('reports.status_battery_1')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={t('reports.item_6350')}>{t('reports.item_6350')}</SelectItem>
                        <SelectItem value={t('reports.item_9546')}>{t('reports.item_9546')}</SelectItem>
                        <SelectItem value={t('reports.item_6348')}>{t('reports.item_6348')}</SelectItem>
                        <SelectItem value={t('reports.no_2')}>{t('reports.no_2')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="chargerCable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('reports.item_15919')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-charger-cable">
                          <SelectValue placeholder={t('reports.status_2')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={t('reports.item_7984')}>{t('reports.item_7984')}</SelectItem>
                        <SelectItem value={t('reports.item_12805')}>{t('reports.item_12805')}</SelectItem>
                        <SelectItem value={t('reports.item_6358')}>{t('reports.item_6358')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="chargerHead"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('reports.item_14304')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-charger-head">
                          <SelectValue placeholder={t('reports.status_3')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={t('reports.item_7984')}>{t('reports.item_7984')}</SelectItem>
                        <SelectItem value={t('reports.item_12805')}>{t('reports.item_12805')}</SelectItem>
                        <SelectItem value={t('reports.item_6358')}>{t('reports.item_6358')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hasSim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('reports.sim_2')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-has-sim">
                          <SelectValue placeholder={t('reports.sim_3')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={t('reports.yes')}>{t('reports.yes')}</SelectItem>
                        <SelectItem value={t('reports.no_3')}>{t('reports.no_3')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="simCardType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('reports.type_sim_1')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-sim-type">
                        <SelectValue placeholder={t('reports.type_sim_2')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Mobily">Mobily</SelectItem>
                      <SelectItem value="STC">STC</SelectItem>
                      <SelectItem value="Zain">Zain</SelectItem>
                      <SelectItem value={t('reports.item_11173')}>{t('reports.item_11173')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="damagePart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('reports.device_5')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('reports.device_6')}
                      {...field}
                      value={field.value || ""}
                      data-testid="input-damage-part"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('reports.notes_2')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('reports.notes_3')}
                      {...field}
                      value={field.value || ""}
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center space-x-2 sm:space-x-3 space-x-reverse pt-3 sm:pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="flex-1 text-sm sm:text-base"
                data-testid="button-cancel"
              >
                {t('reports.cancel_1')}
              </Button>
              <Button
                type="submit"
                disabled={addDeviceMutation.isPending}
                className="flex-1 text-sm sm:text-base"
                data-testid="button-submit"
              >
                {addDeviceMutation.isPending ? t('reports.save') : t('reports.save_device')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

