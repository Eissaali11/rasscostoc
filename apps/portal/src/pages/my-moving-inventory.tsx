import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TruckIcon, MinusCircle, ArrowRight, ArrowLeftRight, FileDown, Home, Package, RefreshCw, Bell, Smartphone } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useState, useMemo } from "react";
import { UpdateMovingInventoryModal } from "@/components/update-moving-inventory-modal";
import { TransferToMovingModal } from "@/components/transfer-to-moving-modal";
import { useLocation } from "wouter";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { motion } from "framer-motion";
import { GridBackground } from "@/components/dashboard/GridBackground";
import dashboardBg from "@assets/image_1762515061799.png";
import { useActiveItemTypes, buildInventoryDisplayItems } from "@/hooks/use-item-types";
import type { TechnicianMovingInventoryEntry } from "@shared/schema";

interface MovingInventory {
  id: string;
  technicianName: string;
  city: string;
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

interface FixedInventory {
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

interface WarehouseTransfer {
  id: string;
  warehouseId: string;
  technicianId: string;
  itemType: string;
  packagingType: string;
  quantity: number;
  performedBy: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected';
  rejectionReason?: string;
  respondedAt?: Date;
  createdAt: Date;
  warehouseName?: string;
  technicianName?: string;
  performedByName?: string;
  itemNameAr?: string;
}

export default function MyMovingInventory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: inventory, isLoading, refetch } = useQuery<MovingInventory>({
    queryKey: [`/api/technicians/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: fixedInventory } = useQuery<FixedInventory>({
    queryKey: [`/api/technician-fixed-inventory/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: pendingTransfers } = useQuery<WarehouseTransfer[]>({
    queryKey: ["/api/warehouse-transfers", user?.id],
    enabled: !!user?.id,
    select: (data) => data.filter(t => t.status === 'pending' && t.technicianId === user?.id),
  });

  const { data: itemTypes } = useActiveItemTypes();

  const { data: dynamicMovingEntries } = useQuery<TechnicianMovingInventoryEntry[]>({
    queryKey: [`/api/technicians/${user?.id}/moving-inventory-entries`],
    enabled: !!user?.id,
  });

  const { data: serializedCustody } = useQuery<any[]>({
    queryKey: [`/api/technicians/${user?.id}/serialized-custody`],
    enabled: !!user?.id,
  });

  const displayItems = useMemo(() => {
    if (!itemTypes || itemTypes.length === 0) return [];
    const entries = (dynamicMovingEntries || []).map(e => ({
      itemTypeId: e.itemTypeId,
      boxes: e.boxes,
      units: e.units
    }));
    const legacyInventory = inventory ? {
      n950Boxes: inventory.n950Boxes || 0,
      n950Units: inventory.n950Units || 0,
      i9000sBoxes: inventory.i9000sBoxes || 0,
      i9000sUnits: inventory.i9000sUnits || 0,
      i9100Boxes: inventory.i9100Boxes || 0,
      i9100Units: inventory.i9100Units || 0,
      rollPaperBoxes: inventory.rollPaperBoxes || 0,
      rollPaperUnits: inventory.rollPaperUnits || 0,
      stickersBoxes: inventory.stickersBoxes || 0,
      stickersUnits: inventory.stickersUnits || 0,
      newBatteriesBoxes: inventory.newBatteriesBoxes || 0,
      newBatteriesUnits: inventory.newBatteriesUnits || 0,
      mobilySimBoxes: inventory.mobilySimBoxes || 0,
      mobilySimUnits: inventory.mobilySimUnits || 0,
      stcSimBoxes: inventory.stcSimBoxes || 0,
      stcSimUnits: inventory.stcSimUnits || 0,
      zainSimBoxes: inventory.zainSimBoxes || 0,
      zainSimUnits: inventory.zainSimUnits || 0,
      lebaraBoxes: inventory.lebaraBoxes || 0,
      lebaraUnits: inventory.lebaraUnits || 0,
    } : undefined;
    return buildInventoryDisplayItems(itemTypes, entries, legacyInventory);
  }, [itemTypes, inventory, dynamicMovingEntries]);

  const acceptMutation = useMutation({
    mutationFn: async (transferId: string) => {
      return apiRequest("POST", `/api/warehouse-transfers/${transferId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-transfers"] });
      queryClient.invalidateQueries({ queryKey: [`/api/technicians/${user?.id}`] });
      toast({
        title: "✅ تم القبول",
        description: "تم قبول عملية النقل وإضافة الكميات للمخزون المتحرك",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ خطأ",
        description: error.message || "فشل قبول عملية النقل",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ transferId, reason }: { transferId: string; reason?: string }) => {
      return apiRequest("POST", `/api/warehouse-transfers/${transferId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse-transfers"] });
      setRejectDialogOpen(false);
      setSelectedTransferId(null);
      setRejectionReason("");
      toast({
        title: "تم الرفض",
        description: "تم رفض عملية النقل",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل رفض عملية النقل",
        variant: "destructive",
      });
    },
  });

  const handleReject = (transferId: string) => {
    setSelectedTransferId(transferId);
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (selectedTransferId) {
      rejectMutation.mutate({ transferId: selectedTransferId, reason: rejectionReason });
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "تم التحديث",
      description: "تم تحديث المخزون بنجاح",
    });
  };

  const getTotalItems = () => {
    return displayItems.reduce((sum, item) => sum + item.boxes + item.units, 0);
  };

  const exportToExcel = async () => {
    if (displayItems.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('المخزون المتحرك');

    worksheet.views = [{ rightToLeft: true }];

    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'تقرير المخزون المتحرك';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF18B2B0' }
    };
    worksheet.getRow(1).height = 30;
    
    worksheet.mergeCells('A2:D2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `التاريخ: ${new Date().toLocaleDateString('ar-SA')}`;
    dateCell.alignment = { horizontal: 'center' };
    dateCell.font = { bold: true };
    dateCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0F7F7' }
    };
    worksheet.getRow(2).height = 25;

    worksheet.addRow([]);
    const headerRow = worksheet.addRow(['الصنف', 'كراتين', 'وحدات', 'الإجمالي']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF18B2B0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    displayItems.forEach(item => {
      const dataRow = worksheet.addRow([
        item.nameAr,
        item.boxes,
        item.units,
        item.boxes + item.units
      ]);
      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { horizontal: 'center' };
      });
    });

    worksheet.addRow([]);
    const totalBoxes = displayItems.reduce((sum, item) => sum + item.boxes, 0);
    const totalUnits = displayItems.reduce((sum, item) => sum + item.units, 0);
    const totalRow = worksheet.addRow(['الإجمالي', totalBoxes, totalUnits, getTotalItems()]);
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { horizontal: 'center' };
    });

    worksheet.columns = [
      { width: 25 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `المخزون_المتحرك_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        <GridBackground />
        <div className="flex items-center justify-center min-h-screen relative z-10">
          <div className="text-center">
            <motion.div
              className="relative w-20 h-20 mx-auto mb-6"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#18B2B0] border-r-[#18B2B0] shadow-lg shadow-[#18B2B0]/50"></div>
            </motion.div>
            <p className="text-white text-lg font-medium">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!inventory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden" dir="rtl">
        <GridBackground />
        <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full"
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
              <CardContent className="py-12 text-center">
                <TruckIcon className="h-20 w-20 mx-auto mb-6 text-[#18B2B0]" />
                <h3 className="text-2xl font-bold mb-3 text-white">لا يوجد مخزون متحرك</h3>
                <p className="text-gray-300 mb-6">
                  قم بنقل بعض العناصر من المخزون الثابت أولاً
                </p>
                <button
                  onClick={() => setLocation("/")}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#18B2B0] to-[#16a09e] text-white font-medium rounded-xl hover:shadow-lg hover:shadow-[#18B2B0]/50 transition-all duration-300 transform hover:scale-105"
                  type="button"
                >
                  <Home className="w-5 h-5" />
                  <span>العودة للصفحة الرئيسية</span>
                </button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  const categoryColorMap: Record<string, string> = {
    devices: "from-blue-500 to-blue-600",
    papers: "from-amber-500 to-amber-600",
    accessories: "from-green-500 to-green-600",
    sim: "from-teal-500 to-teal-600",
  };

  const categoryIconMap: Record<string, string> = {
    devices: "📱",
    papers: "📜",
    accessories: "🔋",
    sim: "📱",
  };

  const inventoryItems = displayItems.map((item, index) => {
    const colors = ["from-blue-500 to-blue-600", "from-purple-500 to-purple-600", "from-indigo-500 to-indigo-600", 
                    "from-amber-500 to-amber-600", "from-pink-500 to-pink-600", "from-green-500 to-green-600",
                    "from-teal-500 to-teal-600", "from-cyan-500 to-cyan-600", "from-violet-500 to-violet-600"];
    return {
      category: item.nameAr,
      icon: categoryIconMap[item.category] || "📦",
      color: categoryColorMap[item.category] || colors[index % colors.length],
      items: [
        { label: "كرتون", value: item.boxes },
        { label: "وحدات", value: item.units }
      ]
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden" dir="rtl">
      <GridBackground />
      
      <div
        className="absolute inset-0 opacity-5 bg-center bg-cover"
        style={{
          backgroundImage: `url(${dashboardBg})`,
          backgroundBlendMode: 'overlay'
        }}
      />

      <div className="relative z-10">
        <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
          
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-[#18B2B0] to-[#16a09e] rounded-2xl shadow-lg shadow-[#18B2B0]/30">
                  <TruckIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1">
                    المخزون المتحرك
                  </h1>
                  <p className="text-gray-400 text-sm">
                    {inventory?.technicianName} • {inventory?.city}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setLocation('/')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium rounded-xl hover:bg-white/20 transition-all duration-300 text-sm focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  type="button"
                  data-testid="button-back-home"
                >
                  <Home className="h-4 w-4" />
                  <span>الرئيسية</span>
                </button>
                
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#18B2B0] to-[#16a09e] text-white font-medium rounded-xl hover:shadow-lg hover:shadow-[#18B2B0]/50 transition-all duration-300 transform hover:scale-105 text-sm focus-visible:ring-2 focus-visible:ring-[#18B2B0] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  type="button"
                  data-testid="button-transfer-from-fixed"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>نقل من الثابت</span>
                </button>
                
                <button
                  onClick={handleRefresh}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-105 text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  type="button"
                  data-testid="button-refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>تحديث</span>
                </button>
                
                <button
                  onClick={() => setShowUpdateModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 transform hover:scale-105 text-sm focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  type="button"
                  data-testid="button-update-inventory"
                >
                  <MinusCircle className="h-4 w-4" />
                  <span>تحديث</span>
                </button>
                
                <button
                  onClick={exportToExcel}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-green-500/50 transition-all duration-300 transform hover:scale-105 text-sm focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  type="button"
                  data-testid="button-export-excel"
                >
                  <FileDown className="h-4 w-4" />
                  <span>تصدير Excel</span>
                </button>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#18B2B0] to-[#16a09e] rounded-2xl opacity-10 group-hover:opacity-20 transition-opacity blur-xl"></div>
              <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 hover:border-[#18B2B0]/50 transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gradient-to-br from-[#18B2B0] to-[#16a09e] rounded-xl shadow-lg shadow-[#18B2B0]/30">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-300">إجمالي العناصر</h3>
                </div>
                <p className="text-3xl font-bold text-white" data-testid="text-total-items">
                  {getTotalItems()}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl opacity-10 group-hover:opacity-20 transition-opacity blur-xl"></div>
              <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 hover:border-purple-500/50 transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg shadow-purple-500/30">
                    <TruckIcon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-300">الأجهزة</h3>
                </div>
                <p className="text-3xl font-bold text-white" data-testid="text-total-devices">
                  {(inventory.n950Boxes || 0) + (inventory.n950Units || 0) + (inventory.i9000sBoxes || 0) + (inventory.i9000sUnits || 0) + (inventory.i9100Boxes || 0) + (inventory.i9100Units || 0)}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl opacity-10 group-hover:opacity-20 transition-opacity blur-xl"></div>
              <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 hover:border-amber-500/50 transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg shadow-amber-500/30">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-300">الملحقات</h3>
                </div>
                <p className="text-3xl font-bold text-white" data-testid="text-total-accessories">
                  {(inventory.rollPaperBoxes || 0) + (inventory.rollPaperUnits || 0) + (inventory.stickersBoxes || 0) + (inventory.stickersUnits || 0) + (inventory.newBatteriesBoxes || 0) + (inventory.newBatteriesUnits || 0)}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl opacity-10 group-hover:opacity-20 transition-opacity blur-xl"></div>
              <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 hover:border-green-500/50 transition-all duration-300 transform hover:scale-105">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg shadow-green-500/30">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-300">الشرائح</h3>
                </div>
                <p className="text-3xl font-bold text-white" data-testid="text-total-sims">
                  {(inventory.mobilySimBoxes || 0) + (inventory.mobilySimUnits || 0) + (inventory.stcSimBoxes || 0) + (inventory.stcSimUnits || 0) + (inventory.zainSimBoxes || 0) + (inventory.zainSimUnits || 0) + (inventory.lebaraBoxes || 0) + (inventory.lebaraUnits || 0)}
                </p>
              </div>
            </motion.div>
          </div>

          {pendingTransfers && pendingTransfers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-8"
            >
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#18B2B0]/10 to-transparent rounded-2xl blur-2xl"></div>
                <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg animate-pulse">
                      <Bell className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white">
                      طلبات النقل المعلقة ({pendingTransfers.length})
                    </h2>
                  </div>
                  <div className="overflow-x-auto rounded-xl">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-right py-4 px-4 text-sm font-semibold text-gray-300">الصنف</th>
                          <th className="text-right py-4 px-4 text-sm font-semibold text-gray-300">الكمية</th>
                          <th className="text-right py-4 px-4 text-sm font-semibold text-gray-300">المستودع</th>
                          <th className="text-right py-4 px-4 text-sm font-semibold text-gray-300">التاريخ</th>
                          <th className="text-right py-4 px-4 text-sm font-semibold text-gray-300">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingTransfers.map((transfer, index) => (
                          <motion.tr
                            key={transfer.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 * index }}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-4 px-4 text-white font-medium">{transfer.itemNameAr}</td>
                            <td className="py-4 px-4 text-gray-300">{transfer.quantity} {transfer.packagingType === 'box' ? 'كرتون' : 'مفرد'}</td>
                            <td className="py-4 px-4 text-gray-300">{transfer.warehouseName}</td>
                            <td className="py-4 px-4 text-gray-400 text-sm">{format(new Date(transfer.createdAt), 'PPp', { locale: ar })}</td>
                            <td className="py-4 px-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => acceptMutation.mutate(transfer.id)}
                                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-green-500/50 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                                  disabled={acceptMutation.isPending}
                                >
                                  ✅ قبول
                                </button>
                                <button
                                  onClick={() => handleReject(transfer.id)}
                                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-red-500/50 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                                  disabled={rejectMutation.isPending}
                                >
                                  ❌ رفض
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {inventoryItems.map((item, index) => (
              <motion.div
                key={item.category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="relative group"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} rounded-2xl opacity-10 group-hover:opacity-20 transition-opacity blur-xl`}></div>
                <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 hover:border-white/30 transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{item.icon}</span>
                    <h3 className="text-lg font-bold text-white">{item.category}</h3>
                  </div>
                  <div className="space-y-3">
                    {item.items.map((subItem) => (
                      <div key={subItem.label} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                        <span className="text-gray-300 text-sm">{subItem.label}</span>
                        <span className={`text-xl font-bold bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}>
                          {subItem.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Serialized Custody Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8"
          >
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-2xl blur-2xl"></div>
              <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg">
                    <Smartphone className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    الأصول المسلسلة بعهدتك النشطة ({serializedCustody?.length || 0})
                  </h2>
                </div>

                {!serializedCustody || serializedCustody.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    لا توجد أجهزة أو شرائح مسلسلة بعهدتك حالياً.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-right py-4 px-4 text-sm font-semibold text-gray-300">الرقم التسلسلي</th>
                          <th className="text-right py-4 px-4 text-sm font-semibold text-gray-300">نوع الصنف</th>
                          <th className="text-right py-4 px-4 text-sm font-semibold text-gray-300">الحالة</th>
                          <th className="text-right py-4 px-4 text-sm font-semibold text-gray-300">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serializedCustody.map((item, index) => (
                          <motion.tr
                            key={item.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 * index }}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-4 px-4 text-white font-mono">{item.serialNumber}</td>
                            <td className="py-4 px-4 text-gray-300">
                              {item.itemTypeNameAr || item.itemTypeNameEn || "غير معروف"}
                            </td>
                            <td className="py-4 px-4">
                              <Badge className={
                                item.status === "RECEIVED_BY_TECHNICIAN"
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              }>
                                {item.status === "RECEIVED_BY_TECHNICIAN" ? "مستلمة للفني" : "بانتظار التأكيد"}
                              </Badge>
                            </td>
                            <td className="py-4 px-4 text-gray-400 text-sm">
                              {item.carrierName ? `شريحة ${item.carrierName}` : "جهاز نقطة بيع POS"}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {showUpdateModal && user?.id && inventory && (
        <UpdateMovingInventoryModal
          open={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          technicianId={user.id}
          currentInventory={inventory}
        />
      )}

      {showTransferModal && user?.id && fixedInventory && (
        <TransferToMovingModal
          open={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          technicianId={user.id}
          fixedInventory={fixedInventory}
        />
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">رفض عملية النقل</DialogTitle>
            <DialogDescription className="text-gray-400">
              يرجى تقديم سبب الرفض (اختياري)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="أدخل سبب الرفض..."
            className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
          />
          <DialogFooter className="gap-2">
            <button
              onClick={() => setRejectDialogOpen(false)}
              className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleConfirmReject}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:shadow-lg hover:shadow-red-500/50 transition-all"
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "جاري الرفض..." : "تأكيد الرفض"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
