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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowRight, Package } from "lucide-react";
import { useActiveItemTypes, getItemTypeVisuals } from "@/hooks/use-item-types";

type PackagingType = 'box' | 'unit';

interface TransferEntry {
  quantity: number;
  packagingType: PackagingType;
}

interface FixedEntry {
  itemTypeId: string;
  boxes: number;
  units: number;
}

interface TransferToMovingModalProps {
  open: boolean;
  onClose: () => void;
  technicianId: string;
  fixedInventory: {
    n950Boxes: number;
    n950Units: number;
    i9000sBoxes: number;
    i9000sUnits: number;
    i9100Boxes: number;
    i9100Units: number;
    rollPaperBoxes: number;
    rollPaperUnits: number;
    stickersBoxes: number;
    stickersUnits: number;
    newBatteriesBoxes: number;
    newBatteriesUnits: number;
    mobilySimBoxes: number;
    mobilySimUnits: number;
    stcSimBoxes: number;
    stcSimUnits: number;
    zainSimBoxes: number;
    zainSimUnits: number;
  };
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

export function TransferToMovingModal({
  open,
  onClose,
  technicianId,
  fixedInventory,
}: TransferToMovingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: itemTypes } = useActiveItemTypes();
  const { data: fixedEntries } = useQuery<FixedEntry[]>({
    queryKey: ['/api/technician-fixed-entries', technicianId],
  });

  const [transfers, setTransfers] = useState<Record<string, TransferEntry>>({});

  useEffect(() => {
    if (itemTypes && itemTypes.length > 0) {
      const initialTransfers: Record<string, TransferEntry> = {};
      itemTypes.forEach((itemType) => {
        if (!transfers[itemType.id]) {
          initialTransfers[itemType.id] = { quantity: 0, packagingType: 'unit' };
        }
      });
      if (Object.keys(initialTransfers).length > 0) {
        setTransfers((prev) => ({ ...initialTransfers, ...prev }));
      }
    }
  }, [itemTypes]);

  const getAvailableForType = (boxes: number, units: number, type: PackagingType) => {
    return type === 'box' ? boxes : units;
  };

  const getItemInventory = (itemTypeId: string): { boxes: number; units: number } => {
    const entry = fixedEntries?.find((e) => e.itemTypeId === itemTypeId);
    if (entry) {
      return { boxes: entry.boxes, units: entry.units };
    }
    const legacy = legacyFieldMapping[itemTypeId];
    if (legacy && fixedInventory) {
      return {
        boxes: (fixedInventory as any)[legacy.boxes] || 0,
        units: (fixedInventory as any)[legacy.units] || 0,
      };
    }
    return { boxes: 0, units: 0 };
  };

  const items = useMemo(() => {
    if (!itemTypes) return [];

    const categoryCounters: Record<string, number> = {};

    return itemTypes
      .filter((t) => t.isActive && t.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((itemType) => {
        const categoryIndex = categoryCounters[itemType.category] || 0;
        categoryCounters[itemType.category] = categoryIndex + 1;

        const { boxes, units } = getItemInventory(itemType.id);
        const visuals = getItemTypeVisuals(itemType, categoryIndex);

        return {
          id: itemType.id,
          label: itemType.nameAr,
          icon: visuals.icon,
          boxes,
          units,
          transfer: transfers[itemType.id] || { quantity: 0, packagingType: 'unit' as PackagingType },
          gradient: visuals.gradient,
        };
      });
  }, [itemTypes, fixedEntries, fixedInventory, transfers]);

  const transferMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(transfers)
        .filter(([_, transfer]) => transfer.quantity > 0)
        .map(([itemTypeId, transfer]) => ({
          itemTypeId,
          quantity: transfer.quantity,
          packagingType: transfer.packagingType,
        }));

      const legacyPayload: Record<string, any> = { technicianId };
      Object.entries(transfers).forEach(([itemTypeId, transfer]) => {
        if (legacyFieldMapping[itemTypeId]) {
          legacyPayload[itemTypeId] = transfer.quantity;
          legacyPayload[`${itemTypeId}PackagingType`] = transfer.packagingType;
        }
      });

      return await apiRequest(
        "POST",
        `/api/stock-transfer`,
        {
          ...legacyPayload,
          entries,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/technician-fixed-inventory/${technicianId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/technician-fixed-entries', technicianId] });
      queryClient.invalidateQueries({ queryKey: [`/api/technicians/${technicianId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/fixed-inventory-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/all-technicians-inventory'] });
      queryClient.invalidateQueries({ queryKey: [`/api/technician-inventory/${technicianId}`] });
      toast({
        title: "✓ تم النقل بنجاح",
        description: "تم نقل الكميات من المخزون الثابت إلى المتحرك",
      });
      const resetTransfers: Record<string, TransferEntry> = {};
      Object.keys(transfers).forEach((key) => {
        resetTransfers[key] = { quantity: 0, packagingType: 'unit' };
      });
      setTransfers(resetTransfers);
      onClose();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "✗ فشل النقل",
        description: "حدث خطأ أثناء نقل الكميات",
      });
    },
  });

  const handleTransfer = () => {
    let hasExceededQuantity = false;
    let hasAnyTransfer = false;

    for (const item of items) {
      const transfer = transfers[item.id];
      if (!transfer) continue;

      if (transfer.quantity > 0) {
        hasAnyTransfer = true;
        const available = getAvailableForType(item.boxes, item.units, transfer.packagingType);
        if (transfer.quantity > available) {
          hasExceededQuantity = true;
          break;
        }
      }
    }

    if (hasExceededQuantity) {
      toast({
        variant: "destructive",
        title: "خطأ في الكمية",
        description: "الكمية المطلوبة أكبر من المتاح في النوع المحدد",
      });
      return;
    }

    if (!hasAnyTransfer) {
      toast({
        variant: "destructive",
        title: "لا توجد كميات",
        description: "يرجى إدخال كميات للنقل",
      });
      return;
    }

    transferMutation.mutate();
  };

  const updateItemTransfer = (itemId: string, field: 'quantity' | 'packagingType', value: number | PackagingType) => {
    setTransfers(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { quantity: 0, packagingType: 'unit' }),
        [field]: value,
      }
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
              <ArrowRight className="h-6 w-6 text-white" />
            </div>
            نقل إلى المخزون المتحرك
          </DialogTitle>
          <DialogDescription className="text-base">
            أدخل الكميات المراد نقلها من المخزون الثابت إلى المتحرك (اختر نوع التعبئة لكل صنف)
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 py-4">
          {items.map((item) => {
            const Icon = item.icon;
            const available = getAvailableForType(item.boxes, item.units, item.transfer.packagingType);
            
            return (
              <div 
                key={item.id}
                className="space-y-3 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 bg-gradient-to-r ${item.gradient} rounded-lg`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <Label className="font-semibold text-base">
                      {item.label}
                    </Label>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                      كراتين: <span className="font-bold text-foreground">{item.boxes}</span>
                    </span>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-muted-foreground">
                      وحدات: <span className="font-bold text-foreground">{item.units}</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">نوع التعبئة</Label>
                    <RadioGroup
                      value={item.transfer.packagingType}
                      onValueChange={(value) => updateItemTransfer(item.id, 'packagingType', value as PackagingType)}
                      className="flex gap-4"
                      dir="rtl"
                    >
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem 
                          value="box" 
                          id={`${item.id}-box`}
                          data-testid={`radio-${item.id}-box`}
                        />
                        <Label 
                          htmlFor={`${item.id}-box`} 
                          className="cursor-pointer font-medium text-sm"
                        >
                          كراتين ({item.boxes})
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem 
                          value="unit" 
                          id={`${item.id}-unit`}
                          data-testid={`radio-${item.id}-unit`}
                        />
                        <Label 
                          htmlFor={`${item.id}-unit`} 
                          className="cursor-pointer font-medium text-sm"
                        >
                          وحدات ({item.units})
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${item.id}-quantity`} className="text-sm text-muted-foreground">
                      الكمية المراد نقلها
                    </Label>
                    <div className="relative">
                      <Input
                        id={`${item.id}-quantity`}
                        type="number"
                        min="0"
                        max={available}
                        value={item.transfer.quantity}
                        onChange={(e) => updateItemTransfer(
                          item.id, 
                          'quantity', 
                          Math.max(0, Math.min(available, parseInt(e.target.value) || 0))
                        )}
                        className="h-11 text-lg font-semibold border-2 focus:ring-2"
                        data-testid={`input-transfer-${item.id}`}
                      />
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}>
                        / {available}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t" dir="rtl">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={transferMutation.isPending}
            className="flex-1 sm:flex-initial h-11"
            data-testid="button-cancel-transfer"
          >
            إلغاء
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={transferMutation.isPending}
            className="flex-1 sm:flex-initial bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white h-11 font-semibold"
            data-testid="button-confirm-transfer"
          >
            <Package className="w-4 h-4 ml-2" />
            {transferMutation.isPending ? "جاري النقل..." : "نقل الكميات"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
