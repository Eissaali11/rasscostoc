import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CheckCircle2, FileDown, Filter, Search, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { useAuth } from "@/lib/auth";
import { useActiveItemTypes, getInventoryValueForItemType, type InventoryEntry } from "@/hooks/use-item-types";

interface TechnicianInventoryData {
  technicianId: string;
  technicianName: string;
  city: string;
  regionId: string;
  fixedInventory: {
    id: string;
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
    lowStockThreshold: number;
    criticalStockThreshold: number;
    entries?: InventoryEntry[];
  } | null;
  movingInventory: {
    id: string;
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
    entries?: InventoryEntry[];
  } | null;
  alertLevel: 'good' | 'warning' | 'critical';
}

function getInventoryValue(inventory: any, entries: InventoryEntry[] | undefined, itemTypeId: string, metric: 'boxes' | 'units'): number {
  return getInventoryValueForItemType(itemTypeId, entries, inventory, metric);
}

export default function AdminInventoryOverview() {
  const [, setLocation] = useLocation();
  const [searchName, setSearchName] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const { user } = useAuth();

  const { data: itemTypes } = useActiveItemTypes();

  const { data, isLoading } = useQuery<{ technicians: TechnicianInventoryData[] }>({
    queryKey: user?.role === 'admin' ? ['/api/admin/all-technicians-inventory'] : ['/api/supervisor/technicians-inventory'],
    enabled: !!user?.id && (user?.role === 'admin' || user?.role === 'supervisor'),
  });

  const activeItemTypes = (itemTypes || []).filter(t => t.isActive && t.isVisible).sort((a, b) => a.sortOrder - b.sortOrder);

  const allTechnicians = data?.technicians || [];
  
  const technicians = allTechnicians.filter(tech => {
    const nameMatch = searchName === "" || tech.technicianName.toLowerCase().includes(searchName.toLowerCase());
    const regionMatch = selectedRegion === "all" || tech.city === selectedRegion;
    return nameMatch && regionMatch;
  });

  const getAlertBadge = (level: 'good' | 'warning' | 'critical') => {
    if (level === 'critical') {
      return {
        label: "حرج",
        className: "bg-red-500/15 text-red-300 border border-red-400/30",
      };
    }

    if (level === 'warning') {
      return {
        label: "مشغول",
        className: "bg-amber-500/15 text-amber-300 border border-amber-400/30",
      };
    }

    return {
      label: "نشط",
      className: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30",
    };
  };

  const getTotalForItem = (boxes: number, units: number) => {
    return (boxes || 0) + (units || 0);
  };

  const calculateFixedTotal = (inv: TechnicianInventoryData['fixedInventory']) => {
    if (!inv) return 0;
    return activeItemTypes.reduce((total, itemType) => {
      const boxes = getInventoryValue(inv, inv.entries, itemType.id, 'boxes');
      const units = getInventoryValue(inv, inv.entries, itemType.id, 'units');
      return total + getTotalForItem(boxes, units);
    }, 0);
  };

  const calculateMovingTotal = (inv: TechnicianInventoryData['movingInventory']) => {
    if (!inv) return 0;
    return activeItemTypes.reduce((total, itemType) => {
      const boxes = getInventoryValue(inv, inv.entries, itemType.id, 'boxes');
      const units = getInventoryValue(inv, inv.entries, itemType.id, 'units');
      return total + getTotalForItem(boxes, units);
    }, 0);
  };

  const criticalTechs = technicians.filter(t => t.alertLevel === 'critical').length;
  const warningTechs = technicians.filter(t => t.alertLevel === 'warning').length;
  const goodTechs = technicians.filter(t => t.alertLevel === 'good').length;

  const regionOptions = useMemo(() => {
    return Array.from(new Set(allTechnicians.map((technician) => technician.city).filter(Boolean))).sort((first, second) =>
      first.localeCompare(second, "ar"),
    );
  }, [allTechnicians]);

  const totalFixedInventory = technicians.reduce((sum, technician) => sum + calculateFixedTotal(technician.fixedInventory), 0);
  const totalMovingInventory = technicians.reduce((sum, technician) => sum + calculateMovingTotal(technician.movingInventory), 0);
  const totalTechniciansInventory = totalFixedInventory + totalMovingInventory;

  const maxFixedInventory = Math.max(
    ...technicians.map((technician) => calculateFixedTotal(technician.fixedInventory)),
    1,
  );
  const maxMovingInventory = Math.max(
    ...technicians.map((technician) => calculateMovingTotal(technician.movingInventory)),
    1,
  );

  const createInventoryWorksheet = (
    workbook: ExcelJS.Workbook, 
    sheetName: string, 
    inventoryType: 'fixed' | 'moving',
    metric: 'boxes' | 'units'
  ) => {
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.views = [{ rightToLeft: true }];

    const currentDate = new Date();
    const arabicDate = currentDate.toLocaleDateString('ar-SA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
    const englishDate = currentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
    const time = currentDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    const numCols = 3 + activeItemTypes.length;
    worksheet.mergeCells(1, 1, 1, numCols);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = 'Technician Inventory Management System';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells(2, 1, 2, numCols);
    const dateCell = worksheet.getCell(2, 1);
    dateCell.value = `تاريخ التقرير: ${arabicDate} | Report Date: ${englishDate} | ${time}`;
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dateCell.font = { bold: true, size: 10 };
    worksheet.getRow(2).height = 20;

    worksheet.addRow([]);

    const metricLabel = metric === 'boxes' ? 'Box' : 'Unit';
    const dynamicHeaders = activeItemTypes.map(t => `${t.nameEn} ${metricLabel}`);
    const headerRow = worksheet.addRow([
      '#',
      'Technician Name',
      'City',
      ...dynamicHeaders
    ]);
    
    headerRow.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    const totals: Record<string, number> = {};
    activeItemTypes.forEach(t => { totals[t.id] = 0; });

    technicians.forEach((tech, index) => {
      const inv = inventoryType === 'fixed' ? tech.fixedInventory : tech.movingInventory;
      const entries = inv?.entries;
      
      const itemValues = activeItemTypes.map(t => getInventoryValue(inv, entries, t.id, metric));
      const data = [
        index + 1,
        tech.technicianName,
        tech.city,
        ...itemValues
      ];

      activeItemTypes.forEach((t, i) => {
        totals[t.id] += Number(itemValues[i]);
      });

      const row = worksheet.addRow(data);
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.height = 20;
      
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
        if (colNumber === 1) cell.font = { bold: true };
      });
    });

    const totalValues = activeItemTypes.map(t => totals[t.id]);
    const totalRow = worksheet.addRow([
      '',
      'Total',
      '',
      ...totalValues
    ]);
    totalRow.font = { bold: true, size: 11 };
    totalRow.alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.height = 25;
    totalRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF92D050' }
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    const columnWidths = [{ width: 5 }, { width: 25 }, { width: 15 }];
    activeItemTypes.forEach(() => columnWidths.push({ width: 15 }));
    worksheet.columns = columnWidths;
  };

  const createTotalWorksheet = (workbook: ExcelJS.Workbook, sheetName: string) => {
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.views = [{ rightToLeft: true }];

    const currentDate = new Date();
    const arabicDate = currentDate.toLocaleDateString('ar-SA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
    const englishDate = currentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
    const time = currentDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    const numCols = 3 + activeItemTypes.length;
    worksheet.mergeCells(1, 1, 1, numCols);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = 'Technician Inventory Management System';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells(2, 1, 2, numCols);
    const dateCell = worksheet.getCell(2, 1);
    dateCell.value = `تاريخ التقرير: ${arabicDate} | Report Date: ${englishDate} | ${time}`;
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dateCell.font = { bold: true, size: 10 };
    worksheet.getRow(2).height = 20;

    worksheet.addRow([]);

    const dynamicHeaders = activeItemTypes.map(t => t.nameEn);
    const headerRow = worksheet.addRow([
      '#',
      'Technician Name',
      'City',
      ...dynamicHeaders
    ]);
    
    headerRow.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    const totals: Record<string, number> = {};
    activeItemTypes.forEach(t => { totals[t.id] = 0; });

    technicians.forEach((tech, index) => {
      const fixedEntries = tech.fixedInventory?.entries;
      const movingEntries = tech.movingInventory?.entries;
      const itemValues = activeItemTypes.map(t => {
        const fixedBoxes = getInventoryValue(tech.fixedInventory, fixedEntries, t.id, 'boxes');
        const fixedUnits = getInventoryValue(tech.fixedInventory, fixedEntries, t.id, 'units');
        const movingBoxes = getInventoryValue(tech.movingInventory, movingEntries, t.id, 'boxes');
        const movingUnits = getInventoryValue(tech.movingInventory, movingEntries, t.id, 'units');
        return getTotalForItem(fixedBoxes + movingBoxes, fixedUnits + movingUnits);
      });

      const data = [
        index + 1,
        tech.technicianName,
        tech.city,
        ...itemValues
      ];

      activeItemTypes.forEach((t, i) => {
        totals[t.id] += Number(itemValues[i]);
      });

      const row = worksheet.addRow(data);
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.height = 20;
      
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
        if (colNumber === 1) cell.font = { bold: true };
      });
    });

    const totalValues = activeItemTypes.map(t => totals[t.id]);
    const totalRow = worksheet.addRow([
      '',
      'Total',
      '',
      ...totalValues
    ]);
    totalRow.font = { bold: true, size: 11 };
    totalRow.alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.height = 25;
    totalRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF92D050' }
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    worksheet.addRow([]);
    worksheet.addRow([]);

    const statsHeaderRow = worksheet.addRow(['Overall Statistics']);
    const statsCols = Math.min(6, numCols);
    worksheet.mergeCells(statsHeaderRow.number, 1, statsHeaderRow.number, statsCols);
    const statsHeaderCell = worksheet.getCell(statsHeaderRow.number, 1);
    statsHeaderCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    statsHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
    statsHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF92D050' }
    };
    statsHeaderRow.height = 25;

    const statsData: (string | number)[][] = [
      ['Technicians Count', technicians.length, '', ''],
    ];
    
    for (let i = 0; i < activeItemTypes.length; i += 2) {
      const t1 = activeItemTypes[i];
      const t2 = activeItemTypes[i + 1];
      statsData.push([
        t1?.nameEn || '',
        t1 ? totals[t1.id] : '',
        t2?.nameEn || '',
        t2 ? totals[t2.id] : ''
      ]);
    }

    statsData.forEach(rowData => {
      const row = worksheet.addRow(rowData);
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        if (colNumber === 1 || colNumber === 3) {
          cell.font = { bold: true };
        }
      });
    });

    const columnWidths = [{ width: 5 }, { width: 25 }, { width: 15 }];
    activeItemTypes.forEach(() => columnWidths.push({ width: 15 }));
    worksheet.columns = columnWidths;
  };

  const exportToExcel = async () => {
    if (technicians.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    
    createTotalWorksheet(workbook, 'مخزون شامل - Total');
    createInventoryWorksheet(workbook, 'ثابت كراتين - Fixed Boxes', 'fixed', 'boxes');
    createInventoryWorksheet(workbook, 'ثابت مفردات - Fixed Units', 'fixed', 'units');
    createInventoryWorksheet(workbook, 'متحرك كراتين - Moving Boxes', 'moving', 'boxes');
    createInventoryWorksheet(workbook, 'متحرك مفردات - Moving Units', 'moving', 'units');

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `تقرير_المخزون_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) {
    return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="mx-auto size-12 rounded-full border-2 border-cyan-400/50 border-t-transparent animate-spin" />
            <p className="text-slate-200 text-sm">جاري تحميل بيانات المندوبين...</p>
          </div>
        </div>
    );
  }

  const todayAr = new Date().toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-100">لوحة مخزون المندوبين</h1>
            <p className="text-sm text-slate-400">عرض شامل لحالة العهدة الثابتة والمتحركة</p>
          </div>
          <div className="flex items-center gap-2 text-cyan-300 text-sm">
            <CalendarDays className="h-4 w-4" />
            <span>{todayAr}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-cyan-400/15 bg-slate-900/40 p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400" />
            <p className="text-xs text-slate-400 mb-2">إجمالي عهد المندوبين</p>
            <p className="text-3xl font-bold text-slate-100">{totalTechniciansInventory.toLocaleString("ar-SA")}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-slate-900/40 p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400" />
            <p className="text-xs text-slate-400 mb-2">القطع النشطة</p>
            <p className="text-3xl font-bold text-emerald-300">{totalFixedInventory.toLocaleString("ar-SA")}</p>
          </div>
          <div className="rounded-2xl border border-orange-400/15 bg-slate-900/40 p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-orange-400" />
            <p className="text-xs text-slate-400 mb-2">القطع المعلقة</p>
            <p className="text-3xl font-bold text-orange-300">{totalMovingInventory.toLocaleString("ar-SA")}</p>
          </div>
          <div className="rounded-2xl border border-sky-400/15 bg-slate-900/40 p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-sky-400" />
            <p className="text-xs text-slate-400 mb-2">مندوبين قيد العمل</p>
            <p className="text-3xl font-bold text-sky-300">{technicians.length.toLocaleString("ar-SA")}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-400/10 bg-slate-900/30 p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-cyan-300/70" />
            <input
              type="text"
              placeholder="بحث عن اسم المندوب أو الرقم الوظيفي..."
              value={searchName}
              onChange={(event) => setSearchName(event.target.value)}
              data-testid="input-search-name"
              className="w-full bg-[#102222] border border-cyan-400/20 rounded-xl pr-9 pl-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-400/40"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedRegion}
              onChange={(event) => setSelectedRegion(event.target.value)}
              className="bg-[#102222] border border-cyan-400/20 rounded-xl px-3 py-2.5 text-sm text-slate-200 min-w-[150px] outline-none focus:ring-2 focus:ring-cyan-400/40"
            >
              <option value="all">كل المناطق</option>
              {regionOptions.map((regionName) => (
                <option key={regionName} value={regionName}>{regionName}</option>
              ))}
            </select>

            <button
              type="button"
              className="p-2.5 rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300"
              aria-label="تصفية"
            >
              <Filter className="h-4 w-4" />
            </button>

            <button
              onClick={exportToExcel}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-cyan-400/10 text-cyan-300 border border-cyan-400/30 hover:bg-cyan-400 hover:text-[#102222] transition-colors text-sm font-semibold"
              type="button"
              data-testid="button-export-all"
            >
              <FileDown className="h-4 w-4" />
              تصدير
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-300">
          <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-400/25" data-testid="text-critical-count">حرج: {criticalTechs}</span>
          <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-400/25" data-testid="text-warning-count">تحذير: {warningTechs}</span>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-400/25" data-testid="text-good-count">نشط: {goodTechs}</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-5 pb-2">
          {technicians.map((technician) => {
            const fixedTotal = calculateFixedTotal(technician.fixedInventory);
            const movingTotal = calculateMovingTotal(technician.movingInventory);
            const fixedPercent = Math.min(100, Math.round((fixedTotal / maxFixedInventory) * 100));
            const movingPercent = Math.min(100, Math.round((movingTotal / maxMovingInventory) * 100));
            const badge = getAlertBadge(technician.alertLevel);

            return (
              <div key={technician.technicianId} className="rounded-2xl border border-cyan-400/10 bg-slate-900/40 p-5 hover:border-cyan-400/35 transition-colors">
                <div className="flex items-start justify-between mb-5">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>

                  <div className="flex items-center gap-3">
                    <div className="text-right min-w-0">
                      <h3 className="text-lg font-bold text-slate-100 truncate">{technician.technicianName}</h3>
                      <p className="text-xs text-cyan-300 truncate">مندوب اتصالات - {technician.city}</p>
                      <p className="text-[11px] text-slate-500">ID: #{technician.technicianId.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="size-14 rounded-2xl bg-slate-800 border border-cyan-300/25 flex items-center justify-center text-cyan-200 font-bold">
                      {(technician.technicianName || "ف").slice(0, 1)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <RingMetric label="مخزون ثابت" percent={fixedPercent} value={fixedTotal} color="cyan" />
                  <RingMetric label="مخزون متحرك" percent={movingPercent} value={movingTotal} color="orange" />
                </div>

                <button
                  type="button"
                  onClick={() => setLocation(`/technician-details/${technician.technicianId}`)}
                  className="w-full py-2.5 rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400 hover:text-[#102222] font-semibold text-sm transition-colors"
                >
                  عرض العهدة بالكامل
                </button>
              </div>
            );
          })}
        </div>

        {technicians.length === 0 && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-8 text-center text-slate-400">
            لا توجد نتائج مطابقة للفلترة الحالية.
          </div>
        )}
      </div>
    
  );
}

function RingMetric({ label, percent, value, color }: { label: string; percent: number; value: number; color: "cyan" | "orange" }) {
  const strokeClass = color === "cyan" ? "text-cyan-400" : "text-orange-400";

  return (
    <div className="rounded-xl border border-cyan-400/10 bg-[#102222]/70 p-4 flex flex-col items-center gap-2">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-slate-700"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className={strokeClass}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeDasharray={`${percent}, 100`}
            strokeLinecap="round"
            strokeWidth="3"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-100">
          {percent.toLocaleString("ar-SA")}٪
        </div>
      </div>

      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-200">{value.toLocaleString("ar-SA")}</div>
    </div>
  );
}

