import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Save, Loader2 } from "lucide-react";
import { useActiveItemTypes, getItemTypeVisuals, type InventoryEntry } from "@/hooks/use-item-types";

interface InventoryFormData {
  [key: string]: { boxes: number; units: number };
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

interface EditFixedInventoryModalProps {
  open: boolean;
  onClose: () => void;
  inventory?: any;
  inventoryEntries?: InventoryEntry[];
}

export function EditFixedInventoryModal({
  open,
  onClose,
  inventory,
  inventoryEntries = [],
}: EditFixedInventoryModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: itemTypes, isLoading: itemTypesLoading } = useActiveItemTypes();
  const [formData, setFormData] = useState<InventoryFormData>({});

  const entryMap = useMemo(() => {
    return new Map(inventoryEntries.map((e) => [e.itemTypeId, e]));
  }, [inventoryEntries]);

  useEffect(() => {
    if (itemTypes && open) {
      const initial: InventoryFormData = {};
      itemTypes.forEach((itemType) => {
        const entry = entryMap.get(itemType.id);
        let boxes = entry?.boxes || 0;
        let units = entry?.units || 0;

        if (!entry && inventory) {
          const legacy = legacyFieldMapping[itemType.id];
          if (legacy) {
            boxes = inventory[legacy.boxes] || 0;
            units = inventory[legacy.units] || 0;
          }
        }

        initial[itemType.id] = { boxes, units };
      });
      setFormData(initial);
    }
  }, [itemTypes, inventory, entryMap, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises = Object.entries(formData).map(([itemTypeId, values]) =>
        apiRequest("POST", `/api/technicians/${user?.id}/fixed-inventory-entries`, {
          itemTypeId,
          boxes: values.boxes,
          units: values.units,
        })
      );
      await Promise.all(promises);

      const legacyData: any = { technicianId: user?.id };
      Object.entries(formData).forEach(([itemTypeId, values]) => {
        const legacy = legacyFieldMapping[itemTypeId];
        if (legacy) {
          legacyData[legacy.boxes] = values.boxes;
          legacyData[legacy.units] = values.units;
        }
      });
      await apiRequest("PUT", `/api/technician-fixed-inventory/${user?.id}`, legacyData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/technician-fixed-inventory/${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians", user?.id, "fixed-inventory-entries"] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/fixed-inventory-dashboard'] });
      toast({
        title: "تم الحفظ بنجاح",
        description: "تم حفظ المخزون الثابت",
      });
      onClose();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "فشل الحفظ",
        description: "حدث خطأ أثناء حفظ البيانات",
      });
    },
  });

  const handleValueChange = (itemTypeId: string, field: 'boxes' | 'units', value: number) => {
    setFormData((prev) => ({
      ...prev,
      [itemTypeId]: {
        ...prev[itemTypeId],
        [field]: Math.max(0, value),
      },
    }));
  };

  const handleSubmit = () => {
    saveMutation.mutate();
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>تعديل المخزون الثابت</DialogTitle>
          <DialogDescription>
            قم بتعديل كميات المخزون الثابت الخاص بك
          </DialogDescription>
        </DialogHeader>

        {itemTypesLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const values = formData[item.id] || { boxes: 0, units: 0 };

                  return (
                    <div key={item.id} className="p-4 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-r ${item.gradient} text-white`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <h4 className="font-semibold">{item.nameAr}</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>الكراتين</Label>
                          <Input
                            type="number"
                            min="0"
                            value={values.boxes}
                            onChange={(e) => handleValueChange(item.id, 'boxes', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>الوحدات</Label>
                          <Input
                            type="number"
                            min="0"
                            value={values.units}
                            onChange={(e) => handleValueChange(item.id, 'units', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 ml-2" />
                {saveMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
