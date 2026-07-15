import { useTranslation } from "@/lib/language";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileDown, Filter, Search } from "lucide-react";
import { motion } from "framer-motion";
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
  const { t, dir, formatNumber, formatDate } = useTranslation();
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
        label: t('inventory.item_4746'),
        className: "bg-[#E05252]/10 text-[#E05252] border border-[#E05252]/25",
      };
    }

    if (level === 'warning') {
      return {
        label: t('inventory.item_7999'),
        className: "bg-[#F4B740]/15 text-[#8a6410] border border-[#F4B740]/35",
      };
    }

    return {
      label: t('inventory.active'),
      className: "bg-[#18B2B0]/10 text-[#149D9B] border border-[#18B2B0]/25",
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
    dateCell.value = t('inventory.date_report', { var_0: arabicDate, var_1: englishDate, var_2: time });
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
    dateCell.value = t('inventory.date_report', { var_0: arabicDate, var_1: englishDate, var_2: time });
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
    
    createTotalWorksheet(workbook, t('inventory.item_15016'));
    createInventoryWorksheet(workbook, t('inventory.boxes_2'), 'fixed', 'boxes');
    createInventoryWorksheet(workbook, t('inventory.item_17035'), 'fixed', 'units');
    createInventoryWorksheet(workbook, t('inventory.boxes_3'), 'moving', 'boxes');
    createInventoryWorksheet(workbook, t('inventory.item_18807'), 'moving', 'units');

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, t('inventory.report_inventory_var_0_xlsx', { var_0: new Date().toISOString().split('T')[0] }));
  };

  if (isLoading) {
    return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="mx-auto size-12 rounded-full border-2 border-[#18B2B0]/40 border-t-[#18B2B0] animate-spin" />
            <p className="text-[#6B7280] text-sm">{t('inventory.loading_data_couriers')}</p>
          </div>
        </div>
    );
  }

  const todayLabel = formatDate(new Date());

  return (
      <div dir={dir} className="rassco-page space-y-6 p-1">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-[#2D3135] tracking-tight">{t('inventory.dashboard_couriers')}</h1>
            <p className="text-sm text-[#6B7280] mt-1">{t('inventory.view')}</p>
          </div>
          <div className="flex items-center gap-2 text-[#18B2B0] text-sm font-semibold">
            <CalendarDays className="h-4 w-4" />
            <span dir="ltr">{todayLabel}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="courier-stat-card"
          >
            <div className="min-w-0">
              <p className="text-xs text-[#6B7280] mb-2 font-semibold">{t('inventory.total_couriers_1')}</p>
              <p className="text-3xl font-extrabold text-[#2D3135] tabular-nums" dir="ltr">
                {formatNumber(totalTechniciansInventory)}
              </p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="courier-stat-card"
          >
            <div className="min-w-0">
              <p className="text-xs text-[#6B7280] mb-2 font-semibold">{t('inventory.units_active')}</p>
              <p className="text-3xl font-extrabold text-[#149D9B] tabular-nums" dir="ltr">
                {formatNumber(totalFixedInventory)}
              </p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="courier-stat-card"
          >
            <div className="min-w-0">
              <p className="text-xs text-[#6B7280] mb-2 font-semibold">{t('inventory.units')}</p>
              <p className="text-3xl font-extrabold text-[#8a6410] tabular-nums" dir="ltr">
                {formatNumber(totalMovingInventory)}
              </p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="courier-stat-card"
          >
            <div className="min-w-0">
              <p className="text-xs text-[#6B7280] mb-2 font-semibold">{t('inventory.pending')}</p>
              <p className="text-3xl font-extrabold text-[#2D3135] tabular-nums" dir="ltr">
                {formatNumber(technicians.length)}
              </p>
            </div>
          </motion.div>
        </div>

        <div className="courier-toolbar flex-col lg:flex-row lg:items-center">
          <div className="relative flex-1 w-full">
            <Search className="h-4 w-4 absolute end-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="text"
              placeholder={t('inventory.search_name_technician_number')}
              value={searchName}
              onChange={(event) => setSearchName(event.target.value)}
              data-testid="input-search-name"
              className="courier-input pe-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <select
              value={selectedRegion}
              onChange={(event) => setSelectedRegion(event.target.value)}
              className="courier-input max-w-[180px]"
            >
              <option value="all">{t('inventory.item_14397')}</option>
              {regionOptions.map((regionName) => (
                <option key={regionName} value={regionName}>{regionName}</option>
              ))}
            </select>

            <button
              type="button"
              className="courier-btn-secondary !px-3"
              aria-label={t('inventory.filter')}
            >
              <Filter className="h-4 w-4" />
            </button>

            <button
              onClick={exportToExcel}
              className="courier-btn-primary"
              type="button"
              data-testid="button-export-all"
            >
              <FileDown className="h-4 w-4" />
              {t('inventory.export')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-[#E05252]/10 text-[#E05252] border border-[#E05252]/25 font-semibold shadow-sm" data-testid="text-critical-count">
            {t('inventory.item_4804')} {formatNumber(criticalTechs)}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-[#F4B740]/15 text-[#8a6410] border border-[#F4B740]/35 font-semibold shadow-sm" data-testid="text-warning-count">
            {t('inventory.warning_1')} {formatNumber(warningTechs)}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-[#18B2B0]/10 text-[#149D9B] border border-[#18B2B0]/25 font-semibold shadow-sm" data-testid="text-good-count">
            {t('inventory.active_1')} {formatNumber(goodTechs)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-2">
          {technicians.map((technician, index) => {
            const fixedTotal = calculateFixedTotal(technician.fixedInventory);
            const movingTotal = calculateMovingTotal(technician.movingInventory);
            const fixedPercent = Math.min(100, Math.round((fixedTotal / maxFixedInventory) * 100));
            const movingPercent = Math.min(100, Math.round((movingTotal / maxMovingInventory) * 100));
            const badge = getAlertBadge(technician.alertLevel);
            const cityLabel = technician.city?.trim()
              ? technician.city
              : t("inventory.city_unspecified");

            return (
              <motion.div
                key={technician.technicianId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 8) * 0.03 }}
                className="courier-panel p-5 flex flex-col"
              >
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-14 rounded-2xl bg-[#18B2B0]/10 border border-[#18B2B0]/25 flex items-center justify-center text-[#18B2B0] font-extrabold text-lg shrink-0 shadow-[0_8px_16px_rgba(24,178,176,0.12)]">
                      {(technician.technicianName || t('inventory.item_1601')).slice(0, 1)}
                    </div>
                    <div className="text-start min-w-0">
                      <h3 className="text-lg font-extrabold text-[#2D3135] truncate">{technician.technicianName}</h3>
                      <p className="text-xs text-[#18B2B0] truncate font-semibold">
                        {t('inventory.item_19161')}{cityLabel}
                      </p>
                      <p className="text-[11px] text-[#9AA1AB] font-mono" dir="ltr">
                        ID: #{technician.technicianId.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5 flex-1">
                  <RingMetric
                    label={t('inventory.item_14327')}
                    percent={fixedPercent}
                    value={fixedTotal}
                    color="teal"
                    formatNumber={formatNumber}
                  />
                  <RingMetric
                    label={t('inventory.item_15971')}
                    percent={movingPercent}
                    value={movingTotal}
                    color="warning"
                    formatNumber={formatNumber}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setLocation(`/technician-details/${technician.technicianId}`)}
                  className="courier-btn-secondary w-full !border-[#18B2B0]/30 !text-[#18B2B0] hover:!bg-[#18B2B0] hover:!text-white"
                >
                  {t('inventory.view_1')}
                </button>
              </motion.div>
            );
          })}
        </div>

        {technicians.length === 0 && (
          <div className="courier-panel courier-panel-static p-8 text-center text-[#6B7280]">
            {t('inventory.no_results')}
          </div>
        )}
      </div>
    
  );
}

function RingMetric({
  label,
  percent,
  value,
  color,
  formatNumber,
}: {
  label: string;
  percent: number;
  value: number;
  color: "teal" | "warning";
  formatNumber: (n: number) => string;
}) {
  const safePercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : 0;
  const strokeColor = color === "teal" ? "#18B2B0" : "#F4B740";

  return (
    <div className="rounded-2xl border border-[rgba(24,178,176,0.14)] bg-gradient-to-b from-white to-[#F8FAFB] p-4 flex flex-col items-center gap-2 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36" aria-hidden>
          <path
            className="text-[#E6E8EC]"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={strokeColor}
            strokeDasharray={`${safePercent}, 100`}
            strokeLinecap="round"
            strokeWidth="3"
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-[#2D3135] tabular-nums"
          dir="ltr"
        >
          {safePercent}%
        </div>
      </div>

      <div className="text-[11px] font-semibold text-[#6B7280] text-center">{label}</div>
      <div className="text-sm font-extrabold text-[#2D3135] tabular-nums" dir="ltr">
        {formatNumber(Number(value || 0))}
      </div>
    </div>
  );
}

