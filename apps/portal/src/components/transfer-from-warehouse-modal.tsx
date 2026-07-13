import { useTranslation } from "@/lib/language";
import { useState, useEffect, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserSafe } from "@shared/schema";
import { useActiveItemTypes, getItemTypeVisuals, type ItemType, type InventoryEntry } from "@/hooks/use-item-types";
import { Loader2, Search, XCircle, Plus, Minus, AlertTriangle } from "lucide-react";

const getFormSchema = (t: (key: string) => string) => z.object(
{
  technicianId: z.string().min(1, t('warehouse.item_22313')),
  notes: z.string().optional(),
}
);

type FormData = z.infer<ReturnType<typeof getFormSchema>>;

interface ItemTransfer {
  selected: boolean;
  quantity: number;
  packagingType: "box" | "unit";
}

const legacyFieldMapping: Record<string, { boxes: string; units: string }> = {
  n950: { boxes: "n950Boxes", units: "n950Units" },
  i9000s: { boxes: "i9000sBoxes", units: "i9000sUnits" },
  i9100: { boxes: "i9100Boxes", units: "i9100Units" },
  rollPaper: { boxes: "rollPaperBoxes", units: "rollPaperUnits" },
  stickers: { boxes: "stickersBoxes", units: "stickersUnits" },
  newBatteries: { boxes: "newBatteriesBoxes", units: "newBatteriesUnits" },
  mobilySim: { boxes: "mobilySimBoxes", units: "mobilySimUnits" },
  stcSim: { boxes: "stcSimBoxes", units: "stcSimUnits" },
  zainSim: { boxes: "zainSimBoxes", units: "zainSimUnits" },
  lebaraSim: { boxes: "lebaraBoxes", units: "lebaraUnits" },
  lebara: { boxes: "lebaraBoxes", units: "lebaraUnits" },
};

interface TransferFromWarehouseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  warehouseName: string;
  currentInventory: any | null;
  currentEntries?: InventoryEntry[];
  warehouseTechnicians?: { id: string; fullName: string; username?: string; city?: string | null }[];
}

export default function TransferFromWarehouseModal({ 
  open, 
  onOpenChange,
  warehouseId,
  warehouseName,
  currentInventory,
  currentEntries = [],
  warehouseTechnicians = [],
}: TransferFromWarehouseModalProps) {
  const { t } = useTranslation();
  const formSchema = useMemo(() => getFormSchema(t), [t]);
  const { toast } = useToast();
  const { data: itemTypes, isLoading: itemTypesLoading } = useActiveItemTypes();

  const { data: authData } = useQuery<{ user: UserSafe }>({
    queryKey: ["/api/auth/me"],
  });
  
  const currentUser = authData?.user;

  const { data: users = [] } = useQuery<UserSafe[]>({
    queryKey: currentUser?.role === 'admin' ? ["/api/users"] : ["/api/supervisor/technicians"],
    enabled: !!currentUser,
  });

  // Prefer technicians passed from warehouse data when available (avoids additional API dependency)
  const employees = (warehouseTechnicians && warehouseTechnicians.length > 0)
    ? warehouseTechnicians as any
    : (currentUser?.role === 'admin'
      ? users.filter(user => user.role === "technician")
      : users);

  const [technicianSearchQuery, setTechnicianSearchQuery] = useState("");
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  const filteredEmployees = useMemo(() => {
    const normalized = technicianSearchQuery.trim().toLowerCase();
    if (!normalized) return employees;

    return employees.filter((employee: any) => {
      const fullName = (employee.fullName || "").toLowerCase();
      const username = (employee.username || "").toLowerCase();
      const city = (employee.city || "").toLowerCase();
      return fullName.includes(normalized) || username.includes(normalized) || city.includes(normalized);
    });
  }, [employees, technicianSearchQuery]);

  const [itemTransfers, setItemTransfers] = useState<{[key: string]: ItemTransfer}>({});

  const entryMap = useMemo(() => {
    return new Map(currentEntries.map((e) => [e.itemTypeId, e]));
  }, [currentEntries]);

  useEffect(() => {
    if (itemTypes && open) {
      const initial: {[key: string]: ItemTransfer} = {};
      itemTypes.forEach((itemType) => {
        initial[itemType.id] = { selected: false, quantity: 0, packagingType: "unit" };
      });
      setItemTransfers(initial);
    }
  }, [itemTypes, open]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      technicianId: "",
      notes: "",
    },
  });

  const selectedTechnicianId = form.watch("technicianId");
  const selectedTechnician = useMemo(
    () => employees.find((employee: any) => employee.id === selectedTechnicianId),
    [employees, selectedTechnicianId],
  );

  useEffect(() => {
    if (!open) {
      form.reset();
      setTechnicianSearchQuery("");
      setItemSearchQuery("");
      setShowAvailableOnly(false);
    }
  }, [open, form]);

  const getAvailableStock = (itemTypeId: string, packagingType: "box" | "unit") => {
    const entry = entryMap.get(itemTypeId);
    if (entry) {
      return packagingType === "box" ? entry.boxes : entry.units;
    }

    if (currentInventory) {
      const legacy = legacyFieldMapping[itemTypeId];
      if (legacy) {
        return packagingType === "box" 
          ? (currentInventory[legacy.boxes] || 0)
          : (currentInventory[legacy.units] || 0);
      }
    }
    return 0;
  };

  const transferMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const items = Object.entries(itemTransfers)
        .filter(([_, transfer]) => transfer.selected && transfer.quantity > 0)
        .map(([itemKey, transfer]) => ({
          itemType: itemKey,
          packagingType: transfer.packagingType,
          quantity: transfer.quantity,
        }));

      return await apiRequest("POST", "/api/warehouse-transfers", {
        warehouseId,
        technicianId: data.technicianId,
        notes: data.notes,
        items,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses", warehouseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses", warehouseId, "inventory-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-inventory", warehouseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-transfers"] });
      toast({
        title: t('warehouse.completed_successfully'),
        description: t('warehouse.completed_technician'),
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('warehouse.error'),
        description: error.message || t('warehouse.error_1'),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    const hasSelectedItems = Object.values(itemTransfers).some(transfer => transfer.selected && transfer.quantity > 0);
    
    if (!hasSelectedItems) {
      toast({
        title: t('warehouse.no_1'),
        description: t('warehouse.item_48006'),
        variant: "destructive",
      });
      return;
    }

    const errors: string[] = [];
    Object.entries(itemTransfers).forEach(([itemKey, transfer]) => {
      if (transfer.selected) {
        const available = getAvailableStock(itemKey, transfer.packagingType);
        if (transfer.quantity > available) {
          const itemType = itemTypes?.find(t => t.id === itemKey);
          const itemName = itemType?.nameAr || itemKey;
          errors.push(t('warehouse.quantity_1', { var_0: itemName, var_1: transfer.quantity, var_2: available }));
        }
      }
    });

    if (errors.length > 0) {
      toast({
        title: t('warehouse.error_2'),
        description: errors.join("\n"),
        variant: "destructive",
      });
      return;
    }

    transferMutation.mutate(data);
  };

  const updateItemTransfer = (itemKey: string, field: keyof ItemTransfer, value: any) => {
    setItemTransfers(prev => ({
      ...prev,
      [itemKey]: {
        ...prev[itemKey],
        [field]: value,
      }
    }));
  };

  const visibleItems = useMemo(() => {
    if (!itemTypes) return [];
    const categoryCounters: Record<string, number> = {};
    return itemTypes
      .filter((t) => t.isActive && t.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((itemType) => {
        const categoryIndex = categoryCounters[itemType.category] || 0;
        categoryCounters[itemType.category] = categoryIndex + 1;
        const visuals = getItemTypeVisuals(itemType, categoryIndex);
        return { ...itemType, ...visuals };
      });
  }, [itemTypes]);

  const filteredVisibleItems = visibleItems.filter((item) => {
    const availableBoxes = getAvailableStock(item.id, "box");
    const availableUnits = getAvailableStock(item.id, "unit");
    const hasAvailable = availableBoxes > 0 || availableUnits > 0;

    if (showAvailableOnly && !hasAvailable) return false;

    const normalized = itemSearchQuery.trim().toLowerCase();
    if (!normalized) return true;

    const nameAr = (item.nameAr || "").toLowerCase();
    const nameEn = (item.nameEn || "").toLowerCase();
    const category = (item.category || "").toLowerCase();
    return nameAr.includes(normalized) || nameEn.includes(normalized) || category.includes(normalized);
  });

  const selectedTransfers = Object.entries(itemTransfers).filter(
    ([_, transfer]) => transfer.selected && transfer.quantity > 0,
  );
  const selectedItemsCount = selectedTransfers.length;
  const totalSelectedQuantity = selectedTransfers.reduce((sum, [_, transfer]) => sum + transfer.quantity, 0);
  const overflowItemsCount = selectedTransfers.filter(([itemKey, transfer]) => {
    const available = getAvailableStock(itemKey, transfer.packagingType);
    return transfer.quantity > available;
  }).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{t('warehouse.warehouse_3')}</DialogTitle>
          <DialogDescription>
            {t('warehouse.transfer_items_from', { name: warehouseName })}
          </DialogDescription>
        </DialogHeader>
        
        {itemTypesLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="technicianId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('warehouse.technician_3')}</FormLabel>
                    <div className="relative mb-2">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={technicianSearchQuery}
                        onChange={(event) => setTechnicianSearchQuery(event.target.value)}
                        placeholder={t('warehouse.city')}
                        className="pr-10 pl-10"
                      />
                      {technicianSearchQuery.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTechnicianSearchQuery("")}
                          aria-label={t('warehouse.scan_search_3')}
                          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <Select onValueChange={field.onChange} value={field.value} disabled={employees.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={employees.length === 0 ? t('warehouse.no_2') : t('warehouse.technician_3')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredEmployees.map((employee: any) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.fullName} - {employee.city}
                          </SelectItem>
                        ))}
                        {filteredEmployees.length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">{t('warehouse.no_results')}</div>
                        )}
                      </SelectContent>
                    </Select>
                    {selectedTechnician && (
                      <div className="mt-2 rounded-md border bg-muted/20 px-3 py-1.5 text-xs sm:text-sm">
                        {t('warehouse.technician_1')} <span className="font-semibold">{selectedTechnician.fullName}</span>
                        {selectedTechnician.city ? <span className="text-muted-foreground"> - {selectedTechnician.city}</span> : null}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={itemSearchQuery}
                    onChange={(event) => setItemSearchQuery(event.target.value)}
                    placeholder={t('warehouse.item_31890')}
                    className="pr-10 pl-10"
                  />
                  {itemSearchQuery.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => setItemSearchQuery("")}
                      aria-label={t('warehouse.scan_search_4')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={showAvailableOnly}
                      onCheckedChange={(checked) => setShowAvailableOnly(checked === true)}
                    />
                    {t('warehouse.view_1')}
                  </label>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{filteredVisibleItems.length}{t('warehouse.item_4796')}</span>
                </div>
              </div>

              <div className="h-[220px] sm:h-[350px] overflow-y-auto pr-2 space-y-3 border rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/50">
                {filteredVisibleItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {t('warehouse.no')}
                  </div>
                ) : filteredVisibleItems.map((item) => {
                  const Icon = item.icon;
                  const transfer = itemTransfers[item.id] || { selected: false, quantity: 0, packagingType: "unit" };
                  const availableBoxes = getAvailableStock(item.id, "box");
                  const availableUnits = getAvailableStock(item.id, "unit");
                  const totalAvailable = availableBoxes + availableUnits;
                  const isUnavailable = totalAvailable === 0;
                  const selectedPackagingAvailable = getAvailableStock(item.id, transfer.packagingType);
                  const hasQuantityError = transfer.selected && transfer.quantity > selectedPackagingAvailable;

                  return (
                    <div key={item.id} className="p-4 rounded-lg bg-white dark:bg-gray-800 border shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <Checkbox
                          disabled={isUnavailable}
                          checked={transfer.selected}
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true;
                            updateItemTransfer(item.id, "selected", isChecked);
                            if (!isChecked) updateItemTransfer(item.id, "quantity", 0);
                          }}
                        />
                        <div className={`p-2 rounded-lg bg-gradient-to-r ${item.gradient} text-white shrink-0`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm sm:text-base truncate">{item.nameAr}</h4>
                          <p className="text-xs text-muted-foreground">
                            {t('warehouse.available_boxes_units', { boxes: availableBoxes, units: availableUnits })}
                          </p>
                          {isUnavailable && <p className="text-xs text-red-500 mt-1">{t('warehouse.item_20748')}</p>}
                        </div>
                      </div>

                      {transfer.selected && (
                        <div className="space-y-3 mr-8 border-t pt-2 mt-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <Label className="text-xs font-medium">{t('warehouse.type')}</Label>
                            <RadioGroup
                              value={transfer.packagingType}
                              onValueChange={(value) => updateItemTransfer(item.id, "packagingType", value as "box" | "unit")}
                              className="flex gap-4"
                            >
                              <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="box" id={`${item.id}-box`} />
                                <Label htmlFor={`${item.id}-box`} className="text-xs cursor-pointer">{t('warehouse.box_2')}{availableBoxes})</Label>
                              </div>
                              <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="unit" id={`${item.id}-unit`} />
                                <Label htmlFor={`${item.id}-unit`} className="text-xs cursor-pointer">{t('warehouse.unit_3')}{availableUnits})</Label>
                              </div>
                            </RadioGroup>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Label className="text-xs font-medium">{t('warehouse.quantity')}</Label>
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => updateItemTransfer(item.id, "quantity", Math.max(0, transfer.quantity - 1))}
                                disabled={transfer.quantity <= 0}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                min="0"
                                max={selectedPackagingAvailable}
                                value={transfer.quantity}
                                onChange={(e) => updateItemTransfer(item.id, "quantity", Math.max(0, parseInt(e.target.value) || 0))}
                                className="text-center h-8 px-1 min-w-[50px] w-20 flex-1 sm:flex-initial"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => updateItemTransfer(item.id, "quantity", Math.min(selectedPackagingAvailable, transfer.quantity + 1))}
                                disabled={transfer.quantity >= selectedPackagingAvailable}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8 px-2 text-xs shrink-0"
                                onClick={() => updateItemTransfer(item.id, "quantity", selectedPackagingAvailable)}
                                disabled={selectedPackagingAvailable === 0}
                              >
                                {t('warehouse.item_15925')}
                              </Button>
                            </div>
                          </div>
                          {hasQuantityError && (
                            <div className="inline-flex items-center gap-1 text-xs text-red-500">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {t('warehouse.quantity_count', { count: selectedPackagingAvailable })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('warehouse.notes')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('warehouse.notes_operation')}
                        className="resize-none h-16 text-xs sm:text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-lg border bg-muted/20 px-3 py-1.5 text-xs sm:text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('warehouse.item_23834')}</span>
                  <span className="font-semibold">{selectedItemsCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('warehouse.total_quantity')}</span>
                  <span className="font-semibold">{totalSelectedQuantity}</span>
                </div>
                {overflowItemsCount > 0 && (
                  <div className="inline-flex items-center gap-1 text-xs text-red-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {t('warehouse.overflow_items_count', { count: overflowItemsCount })}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3 space-x-reverse pt-2">
                <Button
                  type="submit"
                  disabled={transferMutation.isPending || selectedItemsCount === 0 || overflowItemsCount > 0}
                  className="flex-1"
                >
                  {transferMutation.isPending ? t('warehouse.item_14511') : t('warehouse.confirm')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  {t('warehouse.cancel')}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

