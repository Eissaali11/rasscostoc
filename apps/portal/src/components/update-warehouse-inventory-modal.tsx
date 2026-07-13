import { useTranslation } from "@/lib/language";
import { useEffect, useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useActiveItemTypes, getItemTypeVisuals, type ItemType, type InventoryEntry } from "@/hooks/use-item-types";
import { Loader2, Minus, Plus, Search, XCircle } from "lucide-react";

interface InventoryFormData {
  [key: string]: { boxes: number; units: number };
}

interface UpdateWarehouseInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  currentInventory: any | null;
  currentEntries?: InventoryEntry[];
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
};

export default function UpdateWarehouseInventoryModal({ 
  open, 
  onOpenChange,
  warehouseId,
  currentInventory,
  currentEntries = [],
}: UpdateWarehouseInventoryModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: itemTypes, isLoading: itemTypesLoading } = useActiveItemTypes();
  const [formData, setFormData] = useState<InventoryFormData>({});
  const [productSearchQuery, setProductSearchQuery] = useState("");

  const entryMap = useMemo(() => {
    return new Map(currentEntries.map((e) => [e.itemTypeId, e]));
  }, [currentEntries]);

  useEffect(() => {
    if (itemTypes && open) {
      const initial: InventoryFormData = {};
      itemTypes.forEach((itemType) => {
        const entry = entryMap.get(itemType.id);
        let boxes = entry?.boxes || 0;
        let units = entry?.units || 0;

        if (!entry && currentInventory) {
          const legacy = legacyFieldMapping[itemType.id];
          if (legacy) {
            boxes = currentInventory[legacy.boxes] || 0;
            units = currentInventory[legacy.units] || 0;
          }
        }

        initial[itemType.id] = { boxes, units };
      });
      setFormData(initial);
    }
  }, [itemTypes, currentInventory, entryMap, open]);

  useEffect(() => {
    if (!open) {
      setProductSearchQuery("");
    }
  }, [open]);

  const updateInventoryMutation = useMutation({
    mutationFn: async (data: InventoryFormData) => {
      const promises = Object.entries(data).map(([itemTypeId, values]) => 
        apiRequest("POST", `/api/warehouses/${warehouseId}/inventory-entries`, {
          itemTypeId,
          boxes: values.boxes,
          units: values.units,
        })
      );
      await Promise.all(promises);

      const legacyData: any = {};
      Object.entries(data).forEach(([itemTypeId, values]) => {
        const legacy = legacyFieldMapping[itemTypeId];
        if (legacy) {
          legacyData[legacy.boxes] = values.boxes;
          legacyData[legacy.units] = values.units;
        }
      });
      if (Object.keys(legacyData).length > 0) {
        await apiRequest("PUT", `/api/warehouse-inventory/${warehouseId}`, legacyData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses", warehouseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses", warehouseId, "inventory-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-inventory", warehouseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({
        title: t('warehouse.completed_update_inventory_suc'),
        description: t('warehouse.completed_update_inventory_war'),
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('warehouse.error_update_inventory'),
        description: error.message || t('warehouse.error_update_inventory_1'),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateInventoryMutation.mutate(formData);
  };

  const handleValueChange = (itemTypeId: string, field: 'boxes' | 'units', value: number) => {
    setFormData((prev) => ({
      ...prev,
      [itemTypeId]: {
        ...prev[itemTypeId],
        [field]: Math.max(0, value),
      },
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

  const filteredVisibleItems = useMemo(() => {
    const normalized = productSearchQuery.trim().toLowerCase();
    if (!normalized) return visibleItems;

    return visibleItems.filter((item) => {
      const nameAr = (item.nameAr || "").toLowerCase();
      const nameEn = (item.nameEn || "").toLowerCase();
      const category = (item.category || "").toLowerCase();
      return nameAr.includes(normalized) || nameEn.includes(normalized) || category.includes(normalized);
    });
  }, [visibleItems, productSearchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('warehouse.update_warehouse')}</DialogTitle>
          <DialogDescription>
            {t('warehouse.warehouse_4')}
          </DialogDescription>
        </DialogHeader>
        
        {itemTypesLoading ? (
          <div className="flex items-center justify-center py-10 shrink-0">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="space-y-2 shrink-0">
              <Label>{t('warehouse.search')}</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={productSearchQuery}
                  onChange={(event) => setProductSearchQuery(event.target.value)}
                  placeholder={t('warehouse.item_27039')}
                  className="pr-10 pl-10"
                />
                {productSearchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setProductSearchQuery("")}
                    aria-label={t('warehouse.scan_search_3')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t('warehouse.view_2')}{filteredVisibleItems.length}{t('warehouse.item_3211')}{visibleItems.length}{t('warehouse.item_4796')}</p>
            </div>

            <div className="flex-1 min-h-0 pr-2 overflow-y-auto max-h-[55vh] sm:max-h-[500px] space-y-4">
              {filteredVisibleItems.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t('warehouse.no_3')}
                </div>
              ) : filteredVisibleItems.map((item) => {
                const Icon = item.icon;
                const values = formData[item.id] || { boxes: 0, units: 0 };
                return (
                  <div key={item.id} className="p-4 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-r ${item.gradient} text-white shrink-0`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <h4 className="font-semibold text-base sm:text-lg">{item.nameAr}</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs sm:text-sm">{t('warehouse.boxes')}</Label>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handleValueChange(item.id, 'boxes', values.boxes - 1)}
                            disabled={values.boxes <= 0}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min="0"
                            value={values.boxes}
                            onChange={(e) => handleValueChange(item.id, 'boxes', parseInt(e.target.value) || 0)}
                            className="text-center h-8 px-1 min-w-[50px] flex-1 sm:flex-initial"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handleValueChange(item.id, 'boxes', values.boxes + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 px-2 text-xs shrink-0"
                            onClick={() => handleValueChange(item.id, 'boxes', 0)}
                            disabled={values.boxes === 0}
                          >
                            {t('warehouse.item_7963')}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs sm:text-sm">{t('warehouse.units')}</Label>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handleValueChange(item.id, 'units', values.units - 1)}
                            disabled={values.units <= 0}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min="0"
                            value={values.units}
                            onChange={(e) => handleValueChange(item.id, 'units', parseInt(e.target.value) || 0)}
                            className="text-center h-8 px-1 min-w-[50px] flex-1 sm:flex-initial"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handleValueChange(item.id, 'units', values.units + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 px-2 text-xs shrink-0"
                            onClick={() => handleValueChange(item.id, 'units', 0)}
                            disabled={values.units === 0}
                          >
                            {t('warehouse.item_7963')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center space-x-3 space-x-reverse pt-4 shrink-0 border-t mt-auto">
              <Button
                type="submit"
                disabled={updateInventoryMutation.isPending}
                className="flex-1"
              >
                {updateInventoryMutation.isPending ? t('warehouse.update') : t('warehouse.update_inventory')}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
