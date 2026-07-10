import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Save, Box, Smartphone, FileText, Sticker, Battery, Loader2 } from "lucide-react";

interface FixedInventory {
  id?: string;
  technicianId: string;
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
  lebaraBoxes: number;
  lebaraUnits: number;
}

interface EditTechnicianFixedInventoryModalProps {
  open: boolean;
  onClose: () => void;
  technicianId: string;
  technicianName: string;
}

export function EditTechnicianFixedInventoryModal({
  open,
  onClose,
  technicianId,
  technicianName,
}: EditTechnicianFixedInventoryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existingInventory, isLoading } = useQuery<FixedInventory>({
    queryKey: [`/api/technician-fixed-inventory/${technicianId}`],
    enabled: open && !!technicianId,
  });

  const [formData, setFormData] = useState<FixedInventory>({
    technicianId: technicianId,
    n950Boxes: 0,
    n950Units: 0,
    i9000sBoxes: 0,
    i9000sUnits: 0,
    i9100Boxes: 0,
    i9100Units: 0,
    rollPaperBoxes: 0,
    rollPaperUnits: 0,
    stickersBoxes: 0,
    stickersUnits: 0,
    newBatteriesBoxes: 0,
    newBatteriesUnits: 0,
    mobilySimBoxes: 0,
    mobilySimUnits: 0,
    stcSimBoxes: 0,
    stcSimUnits: 0,
    zainSimBoxes: 0,
    zainSimUnits: 0,
    lebaraBoxes: 0,
    lebaraUnits: 0,
  });

  useEffect(() => {
    if (existingInventory) {
      setFormData(existingInventory);
    }
  }, [existingInventory]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        "PUT",
        `/api/technician-fixed-inventory/${technicianId}`,
        formData
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/technician-fixed-inventory/${technicianId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/fixed-inventory-dashboard'] });
      toast({
        title: "✓ تم الحفظ بنجاح",
        description: `تم حفظ المخزون الثابت لـ ${technicianName}`,
      });
      onClose();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "✗ فشل الحفظ",
        description: "حدث خطأ أثناء حفظ البيانات",
      });
    },
  });

  const handleUpdate = (field: keyof FixedInventory, value: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: Math.max(0, value),
    }));
  };

  const handleSubmit = () => {
    saveMutation.mutate();
  };

  const items = [
    {
      name: 'أجهزة N950',
      icon: Box,
      boxesField: 'n950Boxes' as keyof FixedInventory,
      unitsField: 'n950Units' as keyof FixedInventory,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      name: 'أجهزة I9000s',
      icon: Box,
      boxesField: 'i9000sBoxes' as keyof FixedInventory,
      unitsField: 'i9000sUnits' as keyof FixedInventory,
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      name: 'أجهزة I9100',
      icon: Box,
      boxesField: 'i9100Boxes' as keyof FixedInventory,
      unitsField: 'i9100Units' as keyof FixedInventory,
      gradient: 'from-indigo-500 to-blue-500',
    },
    {
      name: 'أوراق رول',
      icon: FileText,
      boxesField: 'rollPaperBoxes' as keyof FixedInventory,
      unitsField: 'rollPaperUnits' as keyof FixedInventory,
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      name: 'ملصقات مدى',
      icon: Sticker,
      boxesField: 'stickersBoxes' as keyof FixedInventory,
      unitsField: 'stickersUnits' as keyof FixedInventory,
      gradient: 'from-rose-500 to-red-500',
    },
    {
      name: 'بطاريات جديدة',
      icon: Battery,
      boxesField: 'newBatteriesBoxes' as keyof FixedInventory,
      unitsField: 'newBatteriesUnits' as keyof FixedInventory,
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      name: 'شرائح موبايلي',
      icon: Smartphone,
      boxesField: 'mobilySimBoxes' as keyof FixedInventory,
      unitsField: 'mobilySimUnits' as keyof FixedInventory,
      gradient: 'from-green-500 to-lime-500',
    },
    {
      name: 'شرائح STC',
      icon: Smartphone,
      boxesField: 'stcSimBoxes' as keyof FixedInventory,
      unitsField: 'stcSimUnits' as keyof FixedInventory,
      gradient: 'from-teal-500 to-cyan-500',
    },
    {
      name: 'شرائح زين',
      icon: Smartphone,
      boxesField: 'zainSimBoxes' as keyof FixedInventory,
      unitsField: 'zainSimUnits' as keyof FixedInventory,
      gradient: 'from-violet-500 to-purple-500',
    },
    {
      name: 'شرائح ليبارا',
      icon: Smartphone,
      boxesField: 'lebaraBoxes' as keyof FixedInventory,
      unitsField: 'lebaraUnits' as keyof FixedInventory,
      gradient: 'from-pink-500 to-rose-500',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
              <Save className="h-6 w-6 text-white" />
            </div>
            تعديل المخزون الثابت - {technicianName}
          </DialogTitle>
          <DialogDescription className="text-base">
            أدخل الكميات المتوفرة في المخزون الثابت
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
          {items.map((item) => {
            const Icon = item.icon;
            const boxes = formData[item.boxesField] as number;
            const units = formData[item.unitsField] as number;
            const total = boxes + units;

            return (
              <div 
                key={item.name}
                className="space-y-3 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 bg-gradient-to-r ${item.gradient} rounded-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-base">{item.name}</h4>
                    <p className={`text-2xl font-bold bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}>
                      {total.toLocaleString('ar-SA')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${item.name}-boxes`} className="text-sm font-medium">
                    كراتين
                  </Label>
                  <Input
                    id={`${item.name}-boxes`}
                    type="number"
                    value={boxes}
                    onChange={(e) => handleUpdate(item.boxesField, parseInt(e.target.value) || 0)}
                    min="0"
                    className="h-11 text-lg font-semibold border-2 focus:ring-2"
                    data-testid={`input-${item.name.toLowerCase().replace(/\s+/g, '-')}-boxes`}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${item.name}-units`} className="text-sm font-medium">
                    وحدات
                  </Label>
                  <Input
                    id={`${item.name}-units`}
                    type="number"
                    value={units}
                    onChange={(e) => handleUpdate(item.unitsField, parseInt(e.target.value) || 0)}
                    min="0"
                    className="h-11 text-lg font-semibold border-2 focus:ring-2"
                    data-testid={`input-${item.name.toLowerCase().replace(/\s+/g, '-')}-units`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t" dir="rtl">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saveMutation.isPending}
            className="flex-1 sm:flex-initial h-11"
            data-testid="button-cancel"
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            className="flex-1 sm:flex-initial bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white h-11 font-semibold"
            data-testid="button-save"
          >
            <Save className="w-4 h-4 ml-2" />
            {saveMutation.isPending ? "جاري الحفظ..." : "حفظ المخزون"}
          </Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
