import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Edit, Trash2, Plus, FileDown, Box, Smartphone, FileText, Sticker, Battery, ArrowRightLeft, Sparkles, Home, ArrowRight, TrendingUp, Layers } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import { TransferToMovingModal } from "@/components/transfer-to-moving-modal";
import { EditFixedInventoryModal } from "@/components/edit-fixed-inventory-modal";
import { useLocation } from "wouter";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { motion } from "framer-motion";
import rasscoLogo from "@assets/39bff80c-2b7d-48a8-80ed-34b372af4da3_transparent_1762470013152.png";
import neoleapLogo from "@assets/image_1762469922998.png";
import madaDevice from "@assets/image_1762469811135.png";
import { StatsKpiCard } from "@/components/dashboard/stats-kpi-card";
import { StockCompositionPie } from "@/components/dashboard/stock-composition-pie";
import { useActiveItemTypes, buildInventoryDisplayItems, type InventoryEntry } from "@/hooks/use-item-types";

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

export default function MyFixedInventory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: existingInventory, isLoading } = useQuery<FixedInventory>({
    queryKey: [`/api/technician-fixed-inventory/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: itemTypesData } = useActiveItemTypes();

  const { data: inventoryEntriesData } = useQuery<InventoryEntry[]>({
    queryKey: ["/api/technicians", user?.id, "fixed-inventory-entries"],
    enabled: !!user?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        "DELETE",
        `/api/technician-fixed-inventory/${user?.id}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/technician-fixed-inventory/${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/fixed-inventory-dashboard'] });
      toast({
        title: "✓ تم الحذف بنجاح",
        description: "تم حذف المخزون الثابت",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "✗ فشل الحذف",
        description: "حدث خطأ أثناء حذف البيانات",
      });
    },
  });

  const getTotalForItem = (boxes: number, units: number) => {
    return boxes + units;
  };

  const exportToExcel = async () => {
    if (!existingInventory) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('المخزون الثابت');

    worksheet.views = [{ rightToLeft: true }];

    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'تقرير المخزون الثابت';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 40;
    
    worksheet.mergeCells('A2:D2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `التاريخ: ${new Date().toLocaleDateString('ar-SA')}`;
    dateCell.font = { size: 12, italic: true };
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    dateCell.alignment = { horizontal: 'center' };
    worksheet.getRow(2).height = 25;

    worksheet.addRow([]);
    const headerRow = worksheet.addRow(['الصنف', 'كراتين', 'وحدات', 'الإجمالي']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    const data = [
      ['أجهزة N950', existingInventory.n950Boxes, existingInventory.n950Units, getTotalForItem(existingInventory.n950Boxes, existingInventory.n950Units)],
      ['أجهزة I9000s', existingInventory.i9000sBoxes, existingInventory.i9000sUnits, getTotalForItem(existingInventory.i9000sBoxes, existingInventory.i9000sUnits)],
      ['أجهزة I9100', existingInventory.i9100Boxes, existingInventory.i9100Units, getTotalForItem(existingInventory.i9100Boxes, existingInventory.i9100Units)],
      ['أوراق رول', existingInventory.rollPaperBoxes, existingInventory.rollPaperUnits, getTotalForItem(existingInventory.rollPaperBoxes, existingInventory.rollPaperUnits)],
      ['ملصقات مدى', existingInventory.stickersBoxes, existingInventory.stickersUnits, getTotalForItem(existingInventory.stickersBoxes, existingInventory.stickersUnits)],
      ['بطاريات جديدة', existingInventory.newBatteriesBoxes, existingInventory.newBatteriesUnits, getTotalForItem(existingInventory.newBatteriesBoxes, existingInventory.newBatteriesUnits)],
      ['شرائح موبايلي', existingInventory.mobilySimBoxes, existingInventory.mobilySimUnits, getTotalForItem(existingInventory.mobilySimBoxes, existingInventory.mobilySimUnits)],
      ['شرائح STC', existingInventory.stcSimBoxes, existingInventory.stcSimUnits, getTotalForItem(existingInventory.stcSimBoxes, existingInventory.stcSimUnits)],
      ['شرائح زين', existingInventory.zainSimBoxes, existingInventory.zainSimUnits, getTotalForItem(existingInventory.zainSimBoxes, existingInventory.zainSimUnits)],
      ['شرائح ليبارا', existingInventory.lebaraBoxes, existingInventory.lebaraUnits, getTotalForItem(existingInventory.lebaraBoxes, existingInventory.lebaraUnits)],
    ];

    data.forEach((rowData) => {
      const row = worksheet.addRow(rowData);
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.height = 25;
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    const grandTotal = data.reduce((sum, row) => sum + (row[3] as number), 0);
    const totalRow = worksheet.addRow(['الإجمالي الكلي', '', '', grandTotal]);
    totalRow.font = { bold: true, size: 14 };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
    totalRow.alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.height = 30;
    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'medium' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    });

    worksheet.columns = [
      { width: 25 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `المخزون_الثابت_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.xlsx`);

    toast({
      title: "✓ تم التصدير بنجاح",
      description: "تم تصدير البيانات إلى ملف Excel",
    });
  };

  const itemsConfig = useMemo(() => {
    if (!itemTypesData) return [];
    const baseItems = buildInventoryDisplayItems(
      itemTypesData,
      inventoryEntriesData || [],
      existingInventory as any
    );
    return baseItems.map((item, index) => ({
      ...item,
      bgGradient: `from-${item.color?.slice(1) || 'blue'}-50/50 via-slate-50/30 to-${item.color?.slice(1) || 'blue'}-50/50`,
      borderColor: `border-slate-300/50`,
      glowColor: `shadow-slate-500/20`,
    }));
  }, [itemTypesData, inventoryEntriesData, existingInventory]);

  const grandTotal = itemsConfig.reduce((sum, item) => sum + getTotalForItem(item.boxes, item.units), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className="relative w-24 h-24 mx-auto mb-6"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-purple-500"></div>
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-pink-500 border-l-cyan-500"></div>
          </motion.div>
          <p className="text-white text-lg font-semibold">جاري التحميل...</p>
        </motion.div>
      </div>
    );
  }

  const handleDeleteClick = () => {
    if (window.confirm('هل أنت متأكد من حذف المخزون الثابت؟ هذا الإجراء لا يمكن التراجع عنه.')) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" dir="rtl">
      {/* Animated Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 shadow-2xl">
        <div className="absolute inset-0 bg-grid-white/5"></div>
        
        {/* Animated Background Shapes */}
        <motion.div
          className="absolute top-0 left-0 w-72 h-72 bg-blue-500/30 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        <div className="relative container mx-auto px-4 py-8">
          {/* Back Button */}
          <motion.div
            className="mb-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => setLocation('/')}
                className="bg-white/95 hover:bg-white text-blue-600 font-bold shadow-xl border-2 border-white/50"
                data-testid="button-back-home"
              >
                <Home className="w-5 h-5 ml-2" />
                الصفحة الرئيسية
                <ArrowRight className="w-5 h-5 mr-2" />
              </Button>
            </motion.div>
          </motion.div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Left Side - Logos Animation */}
            <motion.div 
              className="flex items-center gap-8"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl cursor-pointer"
                whileHover={{ scale: 1.05, rotate: 2 }}
                transition={{ type: "spring", stiffness: 300 }}
                onClick={() => {
                  const dest = user?.role === "technician" ? "/courier/pdf" : "/courier";
                  setLocation(dest);
                }}
              >
                <img src={rasscoLogo} alt="RASSCO" className="h-16 w-auto" />
              </motion.div>
              
              <motion.div
                className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl"
                whileHover={{ scale: 1.05, rotate: -2 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <img src={neoleapLogo} alt="Neoleap" className="h-16 w-auto" />
              </motion.div>
            </motion.div>

            {/* Center - Title */}
            <motion.div 
              className="text-center flex-1"
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.02, 1],
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <h1 className="text-4xl lg:text-5xl font-black text-white mb-2 drop-shadow-2xl flex items-center justify-center gap-3">
                  <Sparkles className="h-10 w-10 text-yellow-300 animate-pulse" />
                  المخزون الثابت
                  <Sparkles className="h-10 w-10 text-yellow-300 animate-pulse" />
                </h1>
                <p className="text-white/90 text-lg font-semibold">نظام إدارة المخزون الاحترافي</p>
              </motion.div>
            </motion.div>

            {/* Right Side - Device Image */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-3xl blur-xl opacity-50"></div>
                <img src={madaDevice} alt="MADA Device" className="h-48 w-auto relative z-10 drop-shadow-2xl" />
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-12 fill-slate-900">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"></path>
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        {/* Personal Analytics Section */}
        {existingInventory && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatsKpiCard
                title="إجمالي الأصناف"
                value={grandTotal}
                icon={Package}
                color="primary"
                delay={0}
              />
              <StatsKpiCard
                title="الأجهزة"
                value={
                  getTotalForItem(existingInventory.n950Boxes, existingInventory.n950Units) +
                  getTotalForItem(existingInventory.i9000sBoxes, existingInventory.i9000sUnits) +
                  getTotalForItem(existingInventory.i9100Boxes, existingInventory.i9100Units)
                }
                icon={Box}
                color="success"
                delay={0.1}
              />
              <StatsKpiCard
                title="الشرائح"
                value={
                  getTotalForItem(existingInventory.mobilySimBoxes, existingInventory.mobilySimUnits) +
                  getTotalForItem(existingInventory.stcSimBoxes, existingInventory.stcSimUnits) +
                  getTotalForItem(existingInventory.zainSimBoxes, existingInventory.zainSimUnits)
                }
                icon={Smartphone}
                color="info"
                delay={0.2}
              />
            </div>

            {/* Pie Chart */}
            <StockCompositionPie
              title="توزيع المخزون الثابت"
              description="تقسيم الأصناف حسب الفئات"
              data={[
                {
                  name: 'أجهزة',
                  value: getTotalForItem(existingInventory.n950Boxes, existingInventory.n950Units) +
                        getTotalForItem(existingInventory.i9000sBoxes, existingInventory.i9000sUnits) +
                        getTotalForItem(existingInventory.i9100Boxes, existingInventory.i9100Units)
                },
                {
                  name: 'شرائح',
                  value: getTotalForItem(existingInventory.mobilySimBoxes, existingInventory.mobilySimUnits) +
                        getTotalForItem(existingInventory.stcSimBoxes, existingInventory.stcSimUnits) +
                        getTotalForItem(existingInventory.zainSimBoxes, existingInventory.zainSimUnits)
                },
                {
                  name: 'أوراق',
                  value: getTotalForItem(existingInventory.rollPaperBoxes, existingInventory.rollPaperUnits) +
                        getTotalForItem(existingInventory.stickersBoxes, existingInventory.stickersUnits)
                },
                {
                  name: 'بطاريات',
                  value: getTotalForItem(existingInventory.newBatteriesBoxes, existingInventory.newBatteriesUnits)
                },
              ]}
              colors={['#18B2B0', '#10B981', '#F59E0B', '#8B5CF6']}
              height={320}
            />
          </motion.div>
        )}

        {/* Action Buttons Card */}
        {existingInventory && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border-2 border-cyan-500/30 shadow-2xl mb-6 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-pink-500/5"></div>
              <CardContent className="p-6 relative">
                <div className="flex gap-3 flex-wrap justify-center">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button 
                      onClick={() => setShowEditModal(true)}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold shadow-lg shadow-blue-500/50 border border-blue-400/30"
                      data-testid="button-edit-inventory"
                    >
                      <Edit className="w-5 h-5 ml-2" />
                      تعديل المخزون
                    </Button>
                  </motion.div>
                  
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button 
                      onClick={() => setShowTransferModal(true)}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold shadow-lg shadow-purple-500/50 border border-purple-400/30"
                      data-testid="button-transfer-to-moving"
                    >
                      <ArrowRightLeft className="w-5 h-5 ml-2" />
                      نقل للمتحرك
                    </Button>
                  </motion.div>
                  
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button 
                      onClick={exportToExcel}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-lg shadow-emerald-500/50 border border-emerald-400/30"
                      data-testid="button-export-excel"
                    >
                      <FileDown className="w-5 h-5 ml-2" />
                      تصدير Excel
                    </Button>
                  </motion.div>
                  
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button 
                      onClick={handleDeleteClick}
                      className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold shadow-lg shadow-red-500/50 border border-red-400/30"
                      data-testid="button-delete-inventory"
                    >
                      <Trash2 className="w-5 h-5 ml-2" />
                      حذف
                    </Button>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {existingInventory ? (
          <>
            {/* Grand Total Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="border-2 border-cyan-500/50 shadow-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl mb-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10"></div>
                <CardContent className="p-8 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        إجمالي الأصناف
                      </p>
                      <motion.p 
                        className="text-6xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent"
                        data-testid="text-grand-total"
                        animate={{ scale: [1, 1.02, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {grandTotal.toLocaleString('ar-SA')}
                      </motion.p>
                    </div>
                    <motion.div 
                      className="p-6 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-3xl shadow-2xl shadow-cyan-500/50"
                      animate={{ rotate: [0, 5, 0, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                    >
                      <Package className="h-16 w-16 text-white drop-shadow-lg" />
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Inventory Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {itemsConfig.map((item, index) => {
                const Icon = item.icon;
                const total = getTotalForItem(item.boxes, item.units);

                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    whileHover={{ y: -5, scale: 1.02 }}
                  >
                    <Card 
                      className={`group relative border-2 ${item.borderColor} hover:shadow-2xl ${item.glowColor} transition-all duration-300 bg-gradient-to-br ${item.bgGradient} backdrop-blur-sm overflow-hidden`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      
                      <CardHeader className="pb-3 relative">
                        <div className="flex items-center gap-3">
                          <motion.div 
                            className={`p-3 bg-gradient-to-br ${item.gradient} rounded-2xl shadow-lg`}
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.6 }}
                          >
                            <Icon className="h-7 w-7 text-white drop-shadow-md" />
                          </motion.div>
                          <div>
                            <CardTitle className="text-lg font-bold text-slate-800">{item.name}</CardTitle>
                            <motion.p 
                              className={`text-3xl font-black bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 200, delay: index * 0.1 + 0.3 }}
                            >
                              {total.toLocaleString('ar-SA')}
                            </motion.p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="relative">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 text-center shadow-md border border-slate-200/50">
                            <p className="text-xs font-semibold text-slate-600 mb-1">كراتين</p>
                            <p className="text-2xl font-black text-slate-800">{item.boxes.toLocaleString('ar-SA')}</p>
                          </div>
                          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 text-center shadow-md border border-slate-200/50">
                            <p className="text-xs font-semibold text-slate-600 mb-1">وحدات</p>
                            <p className="text-2xl font-black text-slate-800">{item.units.toLocaleString('ar-SA')}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="border-2 border-dashed border-cyan-500/50 bg-slate-800/50 backdrop-blur-xl">
              <CardContent className="p-12 text-center">
                <motion.div 
                  className="mx-auto w-20 h-20 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-cyan-500/50"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <Package className="h-10 w-10 text-white" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-3">لا يوجد مخزون ثابت</h3>
                <p className="text-slate-300 mb-6 text-lg">ابدأ بإضافة مخزونك الثابت الآن</p>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    onClick={() => setShowEditModal(true)}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-lg px-8 py-6 shadow-xl shadow-cyan-500/50"
                    data-testid="button-add-first-inventory"
                  >
                    <Plus className="w-6 h-6 ml-2" />
                    إضافة مخزون ثابت
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {showTransferModal && existingInventory && (
        <TransferToMovingModal
          open={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          technicianId={user?.id || ''}
          fixedInventory={existingInventory}
        />
      )}

      {showEditModal && (
        <EditFixedInventoryModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          inventory={existingInventory}
        />
      )}
    </div>
  );
}
