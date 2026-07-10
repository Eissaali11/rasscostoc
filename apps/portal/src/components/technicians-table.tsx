import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileSpreadsheet, Edit, Trash2, Search, Smartphone, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TechnicianInventory } from "@shared/schema";
import AddTechnicianModal from "./add-technician-modal";
import EditTechnicianModal from "./edit-technician-modal";
import ExcelJS from 'exceljs';
import { useAuth } from "@/lib/auth";

export default function TechniciansTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianInventory | null>(null);

  const getTotalForItem = (boxes: number, units: number) => (boxes || 0) + (units || 0);

  const { data: technicians, isLoading } = useQuery<TechnicianInventory[]>({
    queryKey: ["/api/technicians"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/technicians/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف بيانات المندوب",
      });
    },
    onError: () => {
      toast({
        title: "خطأ في الحذف",
        description: "حدث خطأ أثناء حذف البيانات",
        variant: "destructive",
      });
    },
  });

  const filteredTechnicians = technicians?.filter(
    (tech) =>
      tech.technicianName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tech.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (tech: TechnicianInventory) => {
    setSelectedTechnician(tech);
    setShowEditModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("هل أنت متأكد من حذف بيانات هذا المندوب؟")) {
      deleteMutation.mutate(id);
    }
  };

  const handleExport = async () => {
    if (!filteredTechnicians || filteredTechnicians.length === 0) {
      toast({
        title: "لا توجد بيانات للتصدير",
        description: "يجب أن يكون هناك بيانات لتصديرها",
        variant: "destructive",
      });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('تقرير المندوبين');
    
    const currentDate = new Date().toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Calculate totals
    const totalN950 = filteredTechnicians.reduce((sum, t) => sum + getTotalForItem(t.n950Boxes, t.n950Units), 0);
    const totalI9000s = filteredTechnicians.reduce((sum, t) => sum + getTotalForItem(t.i9000sBoxes, t.i9000sUnits), 0);
    const totalI9100 = filteredTechnicians.reduce((sum, t) => sum + getTotalForItem(t.i9100Boxes, t.i9100Units), 0);
    const totalRoll = filteredTechnicians.reduce((sum, t) => sum + getTotalForItem(t.rollPaperBoxes, t.rollPaperUnits), 0);
    const totalStickers = filteredTechnicians.reduce((sum, t) => sum + getTotalForItem(t.stickersBoxes, t.stickersUnits), 0);
    const totalNewBatteries = filteredTechnicians.reduce((sum, t) => sum + getTotalForItem(t.newBatteriesBoxes, t.newBatteriesUnits), 0);
    const totalMobily = filteredTechnicians.reduce((sum, t) => sum + getTotalForItem(t.mobilySimBoxes, t.mobilySimUnits), 0);
    const totalSTC = filteredTechnicians.reduce((sum, t) => sum + getTotalForItem(t.stcSimBoxes, t.stcSimUnits), 0);
    const totalZain = filteredTechnicians.reduce((sum, t) => sum + getTotalForItem(t.zainSimBoxes, t.zainSimUnits), 0);
    
    // Add title row
    worksheet.mergeCells('A1:M1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'نظام إدارة مخزون المندوبين';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 35;
    
    // Add date row
    worksheet.mergeCells('A2:M2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `تاريخ التقرير: ${currentDate}`;
    dateCell.font = { size: 12, bold: true };
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    worksheet.getRow(2).height = 25;
    
    // Add header row
    const headerRow = worksheet.getRow(4);
    headerRow.values = ['#', 'اسم المندوب', 'المدينة', 'أجهزة N950', 'أجهزة I9000s', 'أجهزة I9100', 'أوراق رول', 'ملصقات مداى', 'بطاريات جديدة', 'شرائح موبايلي', 'شرائح STC', 'شرائح زين', 'ملاحظات'];
    headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    
    // Add borders to header
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    
    // Add technician data
    filteredTechnicians.forEach((tech, index) => {
      const row = worksheet.addRow([
        index + 1,
        tech.technicianName,
        tech.city,
        getTotalForItem(tech.n950Boxes, tech.n950Units),
        getTotalForItem(tech.i9000sBoxes, tech.i9000sUnits),
        getTotalForItem(tech.i9100Boxes, tech.i9100Units),
        getTotalForItem(tech.rollPaperBoxes, tech.rollPaperUnits),
        getTotalForItem(tech.stickersBoxes, tech.stickersUnits),
        getTotalForItem(tech.newBatteriesBoxes, tech.newBatteriesUnits),
        getTotalForItem(tech.mobilySimBoxes, tech.mobilySimUnits),
        getTotalForItem(tech.stcSimBoxes, tech.stcSimUnits),
        getTotalForItem(tech.zainSimBoxes, tech.zainSimUnits),
        tech.notes || ''
      ]);
      
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.height = 22;
      
      // Alternate row colors
      if (index % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
      
      // Add borders
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
      
      // Right align text columns
      row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(13).alignment = { horizontal: 'right', vertical: 'middle' };
    });
    
    // Add statistics section
    const statsStartRow = worksheet.lastRow!.number + 2;
    
    // Stats title
    worksheet.mergeCells(`A${statsStartRow}:M${statsStartRow}`);
    const statsTitle = worksheet.getCell(`A${statsStartRow}`);
    statsTitle.value = 'الإحصائيات الإجمالية';
    statsTitle.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    statsTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    statsTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(statsStartRow).height = 30;
    
    // Stats data
    const statsData = [
      ['عدد المندوبين', filteredTechnicians.length, 'أجهزة N950', totalN950, 'أجهزة I9000s', totalI9000s],
      ['أجهزة I9100', totalI9100, 'أوراق رول', totalRoll, 'ملصقات مداى', totalStickers],
      ['بطاريات جديدة', totalNewBatteries, 'شرائح موبايلي', totalMobily, 'شرائح STC', totalSTC],
      ['شرائح زين', totalZain, '', '', '', '']
    ];
    
    statsData.forEach((data, idx) => {
      const row = worksheet.getRow(statsStartRow + idx + 1);
      row.values = ['', ...data];
      row.height = 25;
      
      // Style labels (odd cells)
      [2, 4, 6].forEach(col => {
        const cell = row.getCell(col);
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      // Style values (even cells)
      [3, 5, 7].forEach(col => {
        const cell = row.getCell(col);
        cell.font = { bold: true, color: { argb: 'FF1E40AF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // Set column widths
    worksheet.columns = [
      { width: 6 },   // #
      { width: 25 },  // اسم المندوب
      { width: 18 },  // المدينة
      { width: 14 },  // N950
      { width: 14 },  // I9000s
      { width: 14 },  // I9100
      { width: 14 },  // أوراق رول
      { width: 16 },  // ملصقات مداى
      { width: 16 },  // بطاريات جديدة
      { width: 16 },  // موبايلي
      { width: 14 },  // STC
      { width: 14 },  // زين
      { width: 35 },  // ملاحظات
    ];
    
    // Write file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_المندوبين_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "تم تصدير التقرير بنجاح",
      description: `تم تصدير ${filteredTechnicians.length} سجل بتنسيق احترافي`,
    });
  };

  if (isLoading) {
    return <div className="text-center py-8">جاري التحميل...</div>;
  }

  return (
    <>
      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl md:text-2xl font-bold text-foreground">بيانات المندوبين</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="relative flex-1 sm:flex-initial">
                <Input
                  type="text"
                  placeholder="ابحث..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64 bg-white dark:bg-gray-900 text-sm"
                  data-testid="input-search"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              </div>
              
              <div className="flex gap-2">
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 sm:flex-initial gap-1.5 sm:gap-2 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-950 text-xs sm:text-sm"
                >
                  <Link href="/withdrawn-devices" data-testid="button-withdrawn-devices">
                    <Smartphone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-orange-700 dark:text-orange-300">الأجهزة</span>
                  </Link>
                </Button>

                {user?.role === 'admin' && (
                  <Button
                    asChild
                    variant="outline"
                    className="flex-1 sm:flex-initial gap-1.5 sm:gap-2 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-xs sm:text-sm"
                  >
                    <Link href="/users" data-testid="button-users">
                      <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-blue-700 dark:text-blue-300">المستخدمين</span>
                    </Link>
                  </Button>
                )}
                
                <Button
                  onClick={handleExport}
                  variant="outline"
                  className="flex-1 sm:flex-initial gap-1.5 sm:gap-2 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-xs sm:text-sm"
                  data-testid="button-export-excel"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-300">تصدير</span>
                </Button>
                
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="flex-1 sm:flex-initial gap-1.5 sm:gap-2 text-xs sm:text-sm"
                  data-testid="button-add-technician"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>إضافة</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {!filteredTechnicians || filteredTechnicians.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? "لا توجد نتائج للبحث" : "لا توجد بيانات"}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block lg:hidden space-y-3">
                {filteredTechnicians.map((tech) => (
                  <div key={tech.id} className="bg-card border border-border rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm text-foreground">{tech.technicianName}</h3>
                          <span className="text-xs text-muted-foreground">• {tech.city}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(tech)}
                          className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400"
                          data-testid={`button-edit-${tech.id}`}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(tech.id)}
                          className="h-8 w-8 hover:bg-destructive/10"
                          data-testid={`button-delete-${tech.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">N950: </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-[10px] font-semibold">
                          {getTotalForItem(tech.n950Boxes, tech.n950Units)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">I9000s: </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100 text-[10px] font-semibold">
                          {getTotalForItem(tech.i9000sBoxes, tech.i9000sUnits)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">رول: </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 text-[10px] font-semibold">
                          {getTotalForItem(tech.rollPaperBoxes, tech.rollPaperUnits)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ملصقات: </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-100 text-[10px] font-semibold">
                          {getTotalForItem(tech.stickersBoxes, tech.stickersUnits)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">موبايلي: </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 text-[10px] font-semibold">
                          {getTotalForItem(tech.mobilySimBoxes, tech.mobilySimUnits)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">STC: </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-100 text-[10px] font-semibold">
                          {getTotalForItem(tech.stcSimBoxes, tech.stcSimUnits)}
                        </span>
                      </div>
                    </div>
                    
                    {tech.notes && (
                      <div className="mt-3 pt-3 border-t border-border space-y-1 text-xs">
                        <p><span className="text-muted-foreground">ملاحظات:</span> {tech.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto -mx-4 sm:mx-0 rounded-lg">
                <div className="inline-block min-w-full align-middle">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                      <tr>
                        <th className="whitespace-nowrap px-2 py-2 sm:px-4 sm:py-3 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">المندوب</th>
                        <th className="hidden md:table-cell whitespace-nowrap px-2 py-2 sm:px-4 sm:py-3 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">المدينة</th>
                        <th className="whitespace-nowrap px-1 py-2 sm:px-4 sm:py-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">N950</th>
                        <th className="whitespace-nowrap px-1 py-2 sm:px-4 sm:py-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">I9000s</th>
                        <th className="hidden lg:table-cell whitespace-nowrap px-2 py-2 sm:px-4 sm:py-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">رول</th>
                        <th className="hidden lg:table-cell whitespace-nowrap px-2 py-2 sm:px-4 sm:py-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">ملصقات</th>
                        <th className="hidden xl:table-cell whitespace-nowrap px-1 py-2 sm:px-4 sm:py-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">موبايلي</th>
                        <th className="hidden xl:table-cell whitespace-nowrap px-1 py-2 sm:px-4 sm:py-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">STC</th>
                        <th className="hidden xl:table-cell whitespace-nowrap px-2 py-2 sm:px-4 sm:py-3 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">ملاحظات</th>
                        <th className="whitespace-nowrap px-1 py-2 sm:px-4 sm:py-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-background">
                      {filteredTechnicians.map((tech) => (
                        <tr key={tech.id} className="hover:bg-accent/50 transition-colors">
                          <td className="whitespace-nowrap px-2 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-sm font-medium text-foreground" data-testid={`text-name-${tech.id}`}>
                            {tech.technicianName}
                          </td>
                          <td className="hidden md:table-cell whitespace-nowrap px-2 py-2 sm:px-4 sm:py-3 text-[10px] sm:text-sm text-muted-foreground" data-testid={`text-city-${tech.id}`}>
                            {tech.city}
                          </td>
                          <td className="whitespace-nowrap px-1 py-2 sm:px-4 sm:py-3 text-center text-[10px] sm:text-sm" data-testid={`text-n950-${tech.id}`}>
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-[10px] sm:text-sm font-semibold">
                              {getTotalForItem(tech.n950Boxes, tech.n950Units)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-1 py-2 sm:px-4 sm:py-3 text-center text-[10px] sm:text-sm" data-testid={`text-i9000s-${tech.id}`}>
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100 text-[10px] sm:text-sm font-semibold">
                              {getTotalForItem(tech.i9000sBoxes, tech.i9000sUnits)}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell whitespace-nowrap px-2 py-2 sm:px-4 sm:py-3 text-center text-xs sm:text-sm" data-testid={`text-roll-${tech.id}`}>
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 font-semibold">
                              {getTotalForItem(tech.rollPaperBoxes, tech.rollPaperUnits)}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell whitespace-nowrap px-2 py-2 sm:px-4 sm:py-3 text-center text-xs sm:text-sm" data-testid={`text-stickers-${tech.id}`}>
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-100 font-semibold">
                              {getTotalForItem(tech.stickersBoxes, tech.stickersUnits)}
                            </span>
                          </td>
                          <td className="hidden xl:table-cell whitespace-nowrap px-1 py-2 sm:px-4 sm:py-3 text-center text-[10px] sm:text-sm" data-testid={`text-mobily-${tech.id}`}>
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 text-[10px] sm:text-sm font-semibold">
                              {getTotalForItem(tech.mobilySimBoxes, tech.mobilySimUnits)}
                            </span>
                          </td>
                          <td className="hidden xl:table-cell whitespace-nowrap px-1 py-2 sm:px-4 sm:py-3 text-center text-[10px] sm:text-sm" data-testid={`text-stc-${tech.id}`}>
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-100 text-[10px] sm:text-sm font-semibold">
                              {getTotalForItem(tech.stcSimBoxes, tech.stcSimUnits)}
                            </span>
                          </td>
                          <td className="hidden xl:table-cell px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-muted-foreground max-w-xs truncate" data-testid={`text-notes-${tech.id}`}>
                            {tech.notes || '-'}
                          </td>
                          <td className="whitespace-nowrap px-1 py-2 sm:px-4 sm:py-3">
                            <div className="flex items-center justify-center space-x-0.5 sm:space-x-1 space-x-reverse">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(tech)}
                                className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-accent"
                                title="تعديل"
                                data-testid={`button-edit-${tech.id}`}
                              >
                                <Edit className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(tech.id)}
                                className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-destructive/10"
                                title="حذف"
                                data-testid={`button-delete-${tech.id}`}
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          
          {filteredTechnicians && filteredTechnicians.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground text-center">
                إجمالي المندوبين: <span className="font-semibold text-foreground">{filteredTechnicians.length}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddTechnicianModal open={showAddModal} onOpenChange={setShowAddModal} />
      <EditTechnicianModal 
        open={showEditModal} 
        onOpenChange={setShowEditModal}
        technician={selectedTechnician}
      />
    </>
  );
}

