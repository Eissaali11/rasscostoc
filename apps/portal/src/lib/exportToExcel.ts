import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { InventoryItemWithStatus, SystemLog, WithdrawnDevice } from '@shared/schema';
import { legacyFieldMapping, getInventoryValueForItemType, type ItemType, type InventoryEntry } from '@/hooks/use-item-types';

interface ExportData {
  inventory: InventoryItemWithStatus[];
  companyName?: string;
  reportTitle?: string;
}

interface WarehouseInventory {
  id: string;
  warehouseId: string;
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
  entries?: InventoryEntry[];
}

interface WarehouseData {
  id: string;
  name: string;
  location: string;
  description: string | null;
  isActive: boolean;
  regionId: string | null;
  inventory: WarehouseInventory | null;
}

interface WarehouseExportData {
  warehouses: WarehouseData[];
  itemTypes?: ItemType[];
  companyName?: string;
  reportTitle?: string;
}

interface SystemLogsExportData {
  logs: SystemLog[];
  companyName?: string;
  reportTitle?: string;
}

const getTypeNameArabic = (type: string): string => {
  switch (type) {
    case 'devices':
      return 'أجهزة';
    case 'sim':
      return 'شرائح';
    case 'papers':
      return 'أوراق';
    default:
      return type;
  }
};

const getStatusNameArabic = (status: string): string => {
  switch (status) {
    case 'available':
      return 'متوفر';
    case 'low':
      return 'منخفض';
    case 'out':
      return 'نافد';
    default:
      return status;
  }
};

export const exportInventoryToExcel = async ({ 
  inventory, 
  companyName = 'نظام إدارة المخزون', 
  reportTitle = 'تقرير المخزون الشامل' 
}: ExportData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('تقرير المخزون');

  worksheet.views = [{ rightToLeft: true }];

  const currentDate = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = companyName;
  titleCell.font = { size: 18, bold: true, color: { argb: 'FF18B2B0' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('A2:J2');
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = reportTitle;
  subtitleCell.font = { size: 14, bold: true };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('A3:J3');
  const dateCell = worksheet.getCell('A3');
  dateCell.value = `تاريخ التقرير: ${currentDate}`;
  dateCell.font = { size: 11 };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const headerRow = worksheet.addRow(['#', 'اسم الصنف', 'النوع', 'الكمية', 'الوحدة', 'الحد الأدنى', 'اسم المندوب', 'المدينة', 'الحالة', 'المنطقة']);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF18B2B0' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  inventory.forEach((item, index) => {
    worksheet.addRow([
      index + 1,
      item.name,
      getTypeNameArabic(item.type),
      item.quantity,
      item.unit,
      item.minThreshold,
      item.technicianName || '-',
      item.city || '-',
      getStatusNameArabic(item.status),
      item.regionName || 'غير محدد'
    ]);
  });

  worksheet.columns = [
    { width: 6 },
    { width: 30 },
    { width: 15 },
    { width: 12 },
    { width: 15 },
    { width: 15 },
    { width: 20 },
    { width: 20 },
    { width: 15 },
    { width: 25 },
  ];

  worksheet.addRow([]);
  worksheet.addRow(['📊 الإحصائيات']).font = { bold: true, size: 12 };
  worksheet.addRow(['إجمالي الأصناف:', inventory.length]);
  worksheet.addRow(['الأصناف المتوفرة:', inventory.filter(i => i.status === 'available').length]);
  worksheet.addRow(['الأصناف المنخفضة:', inventory.filter(i => i.status === 'low').length]);
  worksheet.addRow(['الأصناف النافدة:', inventory.filter(i => i.status === 'out').length]);
  worksheet.addRow(['إجمالي الكميات:', inventory.reduce((sum, item) => sum + item.quantity, 0)]);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `تقرير_المخزون_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, fileName);
};

/**
 * Dynamic warehouse export — uses itemTypes + entries (matches warehouse details page).
 * This is the primary path; the legacy hardcoded export below is kept as a fallback only.
 */
const exportWarehousesToExcelDynamic = async ({
  warehouses,
  itemTypes,
  companyName,
  reportTitle,
}: {
  warehouses: WarehouseData[];
  itemTypes: ItemType[];
  companyName: string;
  reportTitle: string;
}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('تقرير المستودعات');
  worksheet.views = [{ rightToLeft: true }];

  const currentDate = new Date();
  const arabicDate = currentDate.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const time = currentDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  // Active + visible item types, sorted (same logic as warehouse details page)
  const visibleItemTypes = itemTypes
    .filter((t) => t.isActive && (t as any).isVisible !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // 4 fixed cols (#, name, location, status) + 2 cols per item type (boxes/units) + 1 total
  const totalCols = 4 + visibleItemTypes.length * 2 + 1;
  const lastColLetter = (n: number): string => {
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const lastCol = lastColLetter(totalCols);

  // Title
  worksheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = companyName;
  titleCell.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18B2B0' } };
  worksheet.getRow(1).height = 35;

  worksheet.mergeCells(`A2:${lastCol}2`);
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = reportTitle;
  subtitleCell.font = { size: 16, bold: true, color: { argb: 'FF18B2B0' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7F6' } };
  worksheet.getRow(2).height = 28;

  worksheet.mergeCells(`A3:${lastCol}3`);
  const dateCell = worksheet.getCell('A3');
  dateCell.value = `تاريخ التقرير: ${arabicDate} - الساعة: ${time}`;
  dateCell.font = { size: 12, bold: true };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
  worksheet.getRow(3).height = 25;

  worksheet.addRow([]);

  // Header row
  const headers: string[] = ['#', 'اسم المستودع', 'الموقع', 'الحالة'];
  for (const it of visibleItemTypes) {
    headers.push(`${it.nameAr} (صناديق)`);
    headers.push(`${it.nameAr} (قطع)`);
  }
  headers.push('إجمالي الأصناف');

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5568' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
  });

  // Totals per item type
  const totalsBoxes: Record<string, number> = {};
  const totalsUnits: Record<string, number> = {};
  for (const it of visibleItemTypes) {
    totalsBoxes[it.id] = 0;
    totalsUnits[it.id] = 0;
  }
  let totalActive = 0;
  let totalInactive = 0;
  let grandTotalItems = 0;

  // Data rows
  warehouses.forEach((warehouse, index) => {
    const inv = warehouse.inventory;
    if (warehouse.isActive) totalActive++;
    else totalInactive++;

    const row: (string | number)[] = [
      index + 1,
      warehouse.name,
      warehouse.location,
      warehouse.isActive ? 'نشط' : 'غير نشط',
    ];

    let warehouseTotal = 0;
    for (const it of visibleItemTypes) {
      const boxes = getInventoryValueForItemType(it.id, inv?.entries, inv as any, 'boxes');
      const units = getInventoryValueForItemType(it.id, inv?.entries, inv as any, 'units');
      row.push(boxes, units);
      totalsBoxes[it.id] += boxes;
      totalsUnits[it.id] += units;
      warehouseTotal += boxes + units;
    }
    row.push(warehouseTotal);
    grandTotalItems += warehouseTotal;

    const dataRow = worksheet.addRow(row);
    dataRow.alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });
  });

  // Grand totals row
  const totalRowData: (string | number)[] = ['', 'الإجمالي', '', ''];
  for (const it of visibleItemTypes) {
    totalRowData.push(totalsBoxes[it.id], totalsUnits[it.id]);
  }
  totalRowData.push(grandTotalItems);
  const totalRow = worksheet.addRow(totalRowData);
  totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  totalRow.alignment = { horizontal: 'center', vertical: 'middle' };
  totalRow.height = 25;
  totalRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A085' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
  });

  // Column widths
  worksheet.columns = [
    { width: 6 },
    { width: 25 },
    { width: 25 },
    { width: 12 },
    ...visibleItemTypes.flatMap(() => [{ width: 14 }, { width: 14 }]),
    { width: 16 },
  ];

  // Stats section
  worksheet.addRow([]);
  const statsHeaderRow = worksheet.addRow(['الإحصائيات العامة']);
  worksheet.mergeCells(statsHeaderRow.number, 1, statsHeaderRow.number, totalCols);
  statsHeaderRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  statsHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
  statsHeaderRow.height = 28;
  statsHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A085' } };
  });

  const addStat = (label: string, value: string | number) => {
    const r = worksheet.addRow([label, value]);
    r.alignment = { horizontal: 'center', vertical: 'middle' };
    r.getCell(1).font = { bold: true };
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7F6' } };
  };

  addStat('إجمالي المستودعات', warehouses.length);
  addStat('المستودعات النشطة', totalActive);
  addStat('المستودعات غير النشطة', totalInactive);
  addStat('إجمالي عدد الأصناف', grandTotalItems);
  for (const it of visibleItemTypes) {
    addStat(`${it.nameAr} (إجمالي)`, totalsBoxes[it.id] + totalsUnits[it.id]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fileName = `تقرير_المستودعات_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, fileName);
};

export const exportWarehousesToExcel = async ({
  warehouses,
  itemTypes,
  companyName = 'نظام إدارة المخزون - RAS Saudi',
  reportTitle = 'تقرير المستودعات الشامل'
}: WarehouseExportData) => {
  // Use dynamic export when itemTypes are provided (matches warehouse details page)
  if (itemTypes && itemTypes.length > 0) {
    return exportWarehousesToExcelDynamic({ warehouses, itemTypes, companyName, reportTitle });
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('تقرير المستودعات');

  worksheet.views = [{ rightToLeft: true }];

  const currentDate = new Date();
  const arabicDate = currentDate.toLocaleDateString('ar-SA', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const time = currentDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  worksheet.mergeCells('A1:W1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = companyName;
  titleCell.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF18B2B0' }
  };
  titleCell.border = {
    top: { style: 'medium', color: { argb: 'FF18B2B0' } },
    left: { style: 'medium', color: { argb: 'FF18B2B0' } },
    bottom: { style: 'medium', color: { argb: 'FF18B2B0' } },
    right: { style: 'medium', color: { argb: 'FF18B2B0' } }
  };
  worksheet.getRow(1).height = 35;

  worksheet.mergeCells('A2:W2');
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = reportTitle;
  subtitleCell.font = { size: 16, bold: true, color: { argb: 'FF18B2B0' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subtitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0F7F6' }
  };
  worksheet.getRow(2).height = 28;

  worksheet.mergeCells('A3:W3');
  const dateCell = worksheet.getCell('A3');
  dateCell.value = `تاريخ التقرير: ${arabicDate} - الساعة: ${time}`;
  dateCell.font = { size: 12, bold: true };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  dateCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F9FF' }
  };
  worksheet.getRow(3).height = 25;

  worksheet.addRow([]);

  const headerRow = worksheet.addRow([
    '#',
    'اسم المستودع',
    'الموقع',
    'الحالة',
    'N950 (صناديق)',
    'N950 (قطع)',
    'I9000s (صناديق)',
    'I9000s (قطع)',
    'I9100 (صناديق)',
    'I9100 (قطع)',
    'ورق حراري (صناديق)',
    'ورق حراري (قطع)',
    'ملصقات (صناديق)',
    'ملصقات (قطع)',
    'بطاريات (صناديق)',
    'بطاريات (قطع)',
    'موبايلي (صناديق)',
    'موبايلي (قطع)',
    'STC (صناديق)',
    'STC (قطع)',
    'زين (صناديق)',
    'زين (قطع)',
    'ليبارا (صناديق)',
    'ليبارا (قطع)',
    'إجمالي الأصناف'
  ]);
  
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4A5568' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  let totalActive = 0;
  let totalInactive = 0;
  let grandTotalItems = 0;

  let totals = {
    n950Boxes: 0, n950Units: 0,
    i9000sBoxes: 0, i9000sUnits: 0,
    i9100Boxes: 0, i9100Units: 0,
    rollPaperBoxes: 0, rollPaperUnits: 0,
    stickersBoxes: 0, stickersUnits: 0,
    newBatteriesBoxes: 0, newBatteriesUnits: 0,
    mobilySimBoxes: 0, mobilySimUnits: 0,
    stcSimBoxes: 0, stcSimUnits: 0,
    zainSimBoxes: 0, zainSimUnits: 0,
    lebaraBoxes: 0, lebaraUnits: 0
  };

  warehouses.forEach((warehouse, index) => {
    const inv = warehouse.inventory;
    
    if (warehouse.isActive) {
      totalActive++;
    } else {
      totalInactive++;
    }

    const totalItems = inv ? (
      inv.n950Boxes + inv.n950Units +
      inv.i9000sBoxes + inv.i9000sUnits +
      inv.i9100Boxes + inv.i9100Units +
      inv.rollPaperBoxes + inv.rollPaperUnits +
      inv.stickersBoxes + inv.stickersUnits +
      inv.newBatteriesBoxes + inv.newBatteriesUnits +
      inv.mobilySimBoxes + inv.mobilySimUnits +
      inv.stcSimBoxes + inv.stcSimUnits +
      inv.zainSimBoxes + inv.zainSimUnits +
      inv.lebaraBoxes + inv.lebaraUnits
    ) : 0;

    grandTotalItems += totalItems;

    if (inv) {
      totals.n950Boxes += inv.n950Boxes || 0;
      totals.n950Units += inv.n950Units || 0;
      totals.i9000sBoxes += inv.i9000sBoxes || 0;
      totals.i9000sUnits += inv.i9000sUnits || 0;
      totals.i9100Boxes += inv.i9100Boxes || 0;
      totals.i9100Units += inv.i9100Units || 0;
      totals.rollPaperBoxes += inv.rollPaperBoxes || 0;
      totals.rollPaperUnits += inv.rollPaperUnits || 0;
      totals.stickersBoxes += inv.stickersBoxes || 0;
      totals.stickersUnits += inv.stickersUnits || 0;
      totals.newBatteriesBoxes += inv.newBatteriesBoxes || 0;
      totals.newBatteriesUnits += inv.newBatteriesUnits || 0;
      totals.mobilySimBoxes += inv.mobilySimBoxes || 0;
      totals.mobilySimUnits += inv.mobilySimUnits || 0;
      totals.stcSimBoxes += inv.stcSimBoxes || 0;
      totals.stcSimUnits += inv.stcSimUnits || 0;
      totals.zainSimBoxes += inv.zainSimBoxes || 0;
      totals.zainSimUnits += inv.zainSimUnits || 0;
      totals.lebaraBoxes += inv.lebaraBoxes || 0;
      totals.lebaraUnits += inv.lebaraUnits || 0;
    }

    const dataRow = worksheet.addRow([
      index + 1,
      warehouse.name,
      warehouse.location,
      warehouse.isActive ? 'نشط' : 'غير نشط',
      inv?.n950Boxes || 0,
      inv?.n950Units || 0,
      inv?.i9000sBoxes || 0,
      inv?.i9000sUnits || 0,
      inv?.i9100Boxes || 0,
      inv?.i9100Units || 0,
      inv?.rollPaperBoxes || 0,
      inv?.rollPaperUnits || 0,
      inv?.stickersBoxes || 0,
      inv?.stickersUnits || 0,
      inv?.newBatteriesBoxes || 0,
      inv?.newBatteriesUnits || 0,
      inv?.mobilySimBoxes || 0,
      inv?.mobilySimUnits || 0,
      inv?.stcSimBoxes || 0,
      inv?.stcSimUnits || 0,
      inv?.zainSimBoxes || 0,
      inv?.zainSimUnits || 0,
      inv?.lebaraBoxes || 0,
      inv?.lebaraUnits || 0,
      totalItems
    ]);
    
    dataRow.alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });
  });

  const totalRow = worksheet.addRow([
    '',
    'الإجمالي',
    '',
    '',
    totals.n950Boxes,
    totals.n950Units,
    totals.i9000sBoxes,
    totals.i9000sUnits,
    totals.i9100Boxes,
    totals.i9100Units,
    totals.rollPaperBoxes,
    totals.rollPaperUnits,
    totals.stickersBoxes,
    totals.stickersUnits,
    totals.newBatteriesBoxes,
    totals.newBatteriesUnits,
    totals.mobilySimBoxes,
    totals.mobilySimUnits,
    totals.stcSimBoxes,
    totals.stcSimUnits,
    totals.zainSimBoxes,
    totals.zainSimUnits,
    totals.lebaraBoxes,
    totals.lebaraUnits,
    grandTotalItems
  ]);

  totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  totalRow.alignment = { horizontal: 'center', vertical: 'middle' };
  totalRow.height = 25;
  totalRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16A085' }
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  const totalBoxRow = worksheet.addRow([
    '',
    'إجمالي الصناديق',
    '',
    '',
    totals.n950Boxes,
    '',
    totals.i9000sBoxes,
    '',
    totals.i9100Boxes,
    '',
    totals.rollPaperBoxes,
    '',
    totals.stickersBoxes,
    '',
    totals.newBatteriesBoxes,
    '',
    totals.mobilySimBoxes,
    '',
    totals.stcSimBoxes,
    '',
    totals.zainSimBoxes,
    '',
    totals.lebaraBoxes,
    '',
    ''
  ]);

  totalBoxRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  totalBoxRow.alignment = { horizontal: 'center', vertical: 'middle' };
  totalBoxRow.height = 25;
  totalBoxRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16A085' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  worksheet.columns = [
    { width: 6 },
    { width: 25 },
    { width: 25 },
    { width: 12 },
    { width: 15 },
    { width: 12 },
    { width: 15 },
    { width: 12 },
    { width: 15 },
    { width: 12 },
    { width: 18 },
    { width: 15 },
    { width: 15 },
    { width: 12 },
    { width: 15 },
    { width: 12 },
    { width: 15 },
    { width: 12 },
    { width: 15 },
    { width: 12 },
    { width: 15 },
    { width: 12 },
    { width: 15 },
  ];

  worksheet.addRow([]);
  
  const statsHeaderRow = worksheet.addRow(['الإحصائيات العامة']);
  worksheet.mergeCells(statsHeaderRow.number, 1, statsHeaderRow.number, 23);
  statsHeaderRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  statsHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
  statsHeaderRow.height = 28;
  statsHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16A085' }
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'medium', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'medium', color: { argb: 'FF000000' } }
    };
  });

  const statsLabelRow = worksheet.addRow([
    'إجمالي المستودعات',
    warehouses.length,
    'N950 (صناديق)',
    totals.n950Boxes,
    'I9000s (صناديق)',
    totals.i9000sBoxes,
    'I9100 (صناديق)',
    totals.i9100Boxes
  ]);
  statsLabelRow.alignment = { horizontal: 'center', vertical: 'middle' };
  statsLabelRow.eachCell((cell, colNumber) => {
    if (colNumber % 2 === 1) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F7F6' }
      };
      cell.font = { bold: true };
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  const statsRow2 = worksheet.addRow([
    'ورق حراري (صناديق)',
    totals.rollPaperBoxes,
    'ملصقات (صناديق)',
    totals.stickersBoxes,
    'بطاريات (صناديق)',
    totals.newBatteriesBoxes,
    'موبايلي (صناديق)',
    totals.mobilySimBoxes
  ]);
  statsRow2.alignment = { horizontal: 'center', vertical: 'middle' };
  statsRow2.eachCell((cell, colNumber) => {
    if (colNumber % 2 === 1) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F7F6' }
      };
      cell.font = { bold: true };
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  const statsRow3 = worksheet.addRow([
    'STC (صناديق)',
    totals.stcSimBoxes,
    'زين (صناديق)',
    totals.zainSimBoxes,
    'ليبارا (صناديق)',
    totals.lebaraBoxes,
    'المستودعات النشطة',
    totalActive
  ]);
  const statsRow4 = worksheet.addRow([
    'المستودعات غير النشطة',
    totalInactive,
    '',
    '',
    '',
    '',
    '',
    ''
  ]);
  statsRow3.alignment = { horizontal: 'center', vertical: 'middle' };
  statsRow3.eachCell((cell, colNumber) => {
    if (colNumber % 2 === 1) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F7F6' }
      };
      cell.font = { bold: true };
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  const unitsSheet = workbook.addWorksheet('الوحدات - Units');
  unitsSheet.views = [{ rightToLeft: true }];

  unitsSheet.mergeCells('A1:L1');
  const unitsTitleCell = unitsSheet.getCell('A1');
  unitsTitleCell.value = companyName;
  unitsTitleCell.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  unitsTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  unitsTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF18B2B0' }
  };
  unitsTitleCell.border = {
    top: { style: 'medium', color: { argb: 'FF18B2B0' } },
    left: { style: 'medium', color: { argb: 'FF18B2B0' } },
    bottom: { style: 'medium', color: { argb: 'FF18B2B0' } },
    right: { style: 'medium', color: { argb: 'FF18B2B0' } }
  };
  unitsSheet.getRow(1).height = 35;

  unitsSheet.mergeCells('A2:L2');
  const unitsSubtitleCell = unitsSheet.getCell('A2');
  unitsSubtitleCell.value = 'تقرير الوحدات - Units Report';
  unitsSubtitleCell.font = { size: 16, bold: true, color: { argb: 'FF18B2B0' } };
  unitsSubtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  unitsSubtitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0F7F6' }
  };
  unitsSheet.getRow(2).height = 28;

  unitsSheet.mergeCells('A3:L3');
  const unitsDateCell = unitsSheet.getCell('A3');
  unitsDateCell.value = `تاريخ التقرير: ${arabicDate} - الساعة: ${time}`;
  unitsDateCell.font = { size: 12, bold: true };
  unitsDateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  unitsDateCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F9FF' }
  };
  unitsSheet.getRow(3).height = 25;

  unitsSheet.addRow([]);

  const unitsHeaderRow = unitsSheet.addRow([
    '#',
    'اسم المستودع',
    'الموقع',
    'N950',
    'I9000s',
    'I9100',
    'ورق حراري',
    'ملصقات',
    'بطاريات',
    'موبايلي',
    'STC',
    'زين',
    'ليبارا'
  ]);
  
  unitsHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  unitsHeaderRow.height = 30;
  unitsHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4A5568' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  warehouses.forEach((warehouse, index) => {
    const inv = warehouse.inventory;
    
    const unitsDataRow = unitsSheet.addRow([
      index + 1,
      warehouse.name,
      warehouse.location,
      inv?.n950Units || 0,
      inv?.i9000sUnits || 0,
      inv?.i9100Units || 0,
      inv?.rollPaperUnits || 0,
      inv?.stickersUnits || 0,
      inv?.newBatteriesUnits || 0,
      inv?.mobilySimUnits || 0,
      inv?.stcSimUnits || 0,
      inv?.zainSimUnits || 0,
      inv?.lebaraUnits || 0
    ]);
    
    unitsDataRow.alignment = { horizontal: 'center', vertical: 'middle' };
    unitsDataRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });
  });

  const unitsTotalRow = unitsSheet.addRow([
    '',
    'الإجمالي',
    '',
    totals.n950Units,
    totals.i9000sUnits,
    totals.i9100Units,
    totals.rollPaperUnits,
    totals.stickersUnits,
    totals.newBatteriesUnits,
    totals.mobilySimUnits,
    totals.stcSimUnits,
    totals.zainSimUnits,
    totals.lebaraUnits
  ]);

  unitsTotalRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  unitsTotalRow.alignment = { horizontal: 'center', vertical: 'middle' };
  unitsTotalRow.height = 25;
  unitsTotalRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16A085' }
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  unitsSheet.columns = [
    { width: 6 },
    { width: 25 },
    { width: 25 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 }
  ];

  unitsSheet.addRow([]);
  
  const unitsStatsHeaderRow = unitsSheet.addRow(['الإحصائيات العامة - Units Statistics']);
  unitsSheet.mergeCells(unitsStatsHeaderRow.number, 1, unitsStatsHeaderRow.number, 12);
  unitsStatsHeaderRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  unitsStatsHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
  unitsStatsHeaderRow.height = 28;
  unitsStatsHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16A085' }
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'medium', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'medium', color: { argb: 'FF000000' } }
    };
  });

  const unitsStatsRow1 = unitsSheet.addRow([
    'إجمالي الوحدات',
    totals.n950Units + totals.i9000sUnits + totals.i9100Units + 
    totals.rollPaperUnits + totals.stickersUnits + totals.newBatteriesUnits +
    totals.mobilySimUnits + totals.stcSimUnits + totals.zainSimUnits + totals.lebaraUnits,
    'N950 (وحدات)',
    totals.n950Units,
    'I9000s (وحدات)',
    totals.i9000sUnits,
    'I9100 (وحدات)',
    totals.i9100Units
  ]);
  unitsStatsRow1.alignment = { horizontal: 'center', vertical: 'middle' };
  unitsStatsRow1.eachCell((cell, colNumber) => {
    if (colNumber % 2 === 1) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F7F6' }
      };
      cell.font = { bold: true };
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  const unitsStatsRow2 = unitsSheet.addRow([
    'ورق حراري (وحدات)',
    totals.rollPaperUnits,
    'ملصقات (وحدات)',
    totals.stickersUnits,
    'بطاريات (وحدات)',
    totals.newBatteriesUnits,
    'موبايلي (وحدات)',
    totals.mobilySimUnits
  ]);
  unitsStatsRow2.alignment = { horizontal: 'center', vertical: 'middle' };
  unitsStatsRow2.eachCell((cell, colNumber) => {
    if (colNumber % 2 === 1) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F7F6' }
      };
      cell.font = { bold: true };
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  const unitsStatsRow3 = unitsSheet.addRow([
    'STC (وحدات)',
    totals.stcSimUnits,
    'زين (وحدات)',
    totals.zainSimUnits,
    'ليبارا (وحدات)',
    totals.lebaraUnits,
    '',
    ''
  ]);
  unitsStatsRow3.alignment = { horizontal: 'center', vertical: 'middle' };
  unitsStatsRow3.eachCell((cell, colNumber) => {
    if (colNumber % 2 === 1) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F7F6' }
      };
      cell.font = { bold: true };
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `تقرير_المستودعات_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, fileName);
};

interface TechnicianInventoryEntry {
  itemTypeId: string;
  boxes: number;
  units: number;
}

interface ItemTypeInfo {
  id: string;
  nameAr: string;
  nameEn: string;
}

interface TechnicianInventoryData {
  technicianName: string;
  city: string;
  itemTypes?: ItemTypeInfo[];
  fixedEntries?: TechnicianInventoryEntry[];
  movingEntries?: TechnicianInventoryEntry[];
  fixedInventory?: {
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
  };
  movingInventory?: {
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
  };
}

export const exportTechnicianToExcel = async (data: TechnicianInventoryData) => {
  const workbook = new ExcelJS.Workbook();
  
  const companyName = 'نظام إدارة المخزون - RAS Saudi';
  const currentDate = new Date();
  const arabicDate = currentDate.toLocaleDateString('ar-SA', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const time = currentDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  // Helper function to get value from entries or legacy
  const getInventoryValue = (
    entries: TechnicianInventoryEntry[] | undefined,
    legacyInventory: TechnicianInventoryData['fixedInventory'] | undefined,
    itemTypeId: string,
    valueType: 'boxes' | 'units',
    legacyKey?: string
  ): number => {
    // First check dynamic entries
    if (entries && Array.isArray(entries)) {
      const entry = entries.find(e => e.itemTypeId === itemTypeId);
      if (entry) {
        return valueType === 'boxes' ? entry.boxes : entry.units;
      }
    }
    // Fall back to legacy
    if (legacyInventory && legacyKey) {
      const key = legacyKey + (valueType === 'boxes' ? 'Boxes' : 'Units');
      return (legacyInventory as Record<string, number>)[key] || 0;
    }
    return 0;
  };

  // Determine if using dynamic item types
  const useDynamicTypes = data.itemTypes && data.itemTypes.length > 0;
  
  // Legacy mapping for backward compatibility
  const legacyFieldMap: Record<string, string> = {
    'n950': 'n950',
    'i9000s': 'i9000s',
    'i9100': 'i9100',
    'rollPaper': 'rollPaper',
    'stickers': 'stickers',
    'newBatteries': 'newBatteries',
    'mobilySim': 'mobilySim',
    'stcSim': 'stcSim',
    'zainSim': 'zainSim',
    'lebara': 'lebara'
  };

  // Create sheet helper function
  const createInventorySheet = (
    sheetName: string,
    sheetTitle: string,
    entries: TechnicianInventoryEntry[] | undefined,
    legacyInventory: TechnicianInventoryData['fixedInventory'] | undefined
  ) => {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.views = [{ rightToLeft: true }];

    // Dynamic column count based on item types
    const itemTypeCount = useDynamicTypes ? data.itemTypes!.length : 10;
    const totalColumns = itemTypeCount + 2; // +2 for 'الصنف' and 'الإجمالي'
    const lastCol = String.fromCharCode(65 + totalColumns - 1); // e.g., 'L' for 12 columns

    // Title row
    sheet.mergeCells(`A1:${lastCol}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = companyName;
    titleCell.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF18B2B0' }
    };
    sheet.getRow(1).height = 35;

    // Subtitle row
    sheet.mergeCells(`A2:${lastCol}2`);
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `${sheetTitle}: ${data.technicianName}`;
    subtitleCell.font = { size: 16, bold: true, color: { argb: 'FF18B2B0' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subtitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0F7F6' }
    };
    sheet.getRow(2).height = 28;

    // Info row
    sheet.mergeCells(`A3:${lastCol}3`);
    const infoCell = sheet.getCell('A3');
    infoCell.value = `المدينة: ${data.city} | التاريخ: ${arabicDate} - ${time}`;
    infoCell.font = { size: 12, bold: true };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    infoCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F9FF' }
    };
    sheet.getRow(3).height = 25;

    sheet.addRow([]);

    // Build header based on dynamic or legacy types
    let headerValues: string[];
    if (useDynamicTypes) {
      headerValues = ['الصنف', ...data.itemTypes!.map(it => it.nameAr), 'الإجمالي'];
    } else {
      headerValues = [
        'الصنف', 'N950', 'I9000s', 'I9100', 'ورق حراري', 'ملصقات',
        'بطاريات', 'موبايلي', 'STC', 'زين', 'ليبارا', 'الإجمالي'
      ];
    }

    const headerRow = sheet.addRow(headerValues);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4A5568' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    // Calculate boxes row
    let boxesValues: (string | number)[];
    let boxesTotal = 0;
    
    if (useDynamicTypes) {
      boxesValues = ['صناديق'];
      for (const itemType of data.itemTypes!) {
        const legacyKey = legacyFieldMap[itemType.nameEn] || undefined;
        const value = getInventoryValue(entries, legacyInventory, itemType.id, 'boxes', legacyKey);
        boxesValues.push(value);
        boxesTotal += value;
      }
      boxesValues.push(boxesTotal);
    } else {
      const inv = legacyInventory!;
      boxesTotal = (inv.n950Boxes || 0) + (inv.i9000sBoxes || 0) + (inv.i9100Boxes || 0) +
                   (inv.rollPaperBoxes || 0) + (inv.stickersBoxes || 0) + (inv.newBatteriesBoxes || 0) +
                   (inv.mobilySimBoxes || 0) + (inv.stcSimBoxes || 0) + (inv.zainSimBoxes || 0) + (inv.lebaraBoxes || 0);
      boxesValues = [
        'صناديق',
        inv.n950Boxes || 0, inv.i9000sBoxes || 0, inv.i9100Boxes || 0,
        inv.rollPaperBoxes || 0, inv.stickersBoxes || 0, inv.newBatteriesBoxes || 0,
        inv.mobilySimBoxes || 0, inv.stcSimBoxes || 0, inv.zainSimBoxes || 0, inv.lebaraBoxes || 0,
        boxesTotal
      ];
    }

    const boxesRow = sheet.addRow(boxesValues);
    boxesRow.alignment = { horizontal: 'center', vertical: 'middle' };
    boxesRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    // Calculate units row
    let unitsValues: (string | number)[];
    let unitsTotal = 0;
    
    if (useDynamicTypes) {
      unitsValues = ['قطع'];
      for (const itemType of data.itemTypes!) {
        const legacyKey = legacyFieldMap[itemType.nameEn] || undefined;
        const value = getInventoryValue(entries, legacyInventory, itemType.id, 'units', legacyKey);
        unitsValues.push(value);
        unitsTotal += value;
      }
      unitsValues.push(unitsTotal);
    } else {
      const inv = legacyInventory!;
      unitsTotal = (inv.n950Units || 0) + (inv.i9000sUnits || 0) + (inv.i9100Units || 0) +
                   (inv.rollPaperUnits || 0) + (inv.stickersUnits || 0) + (inv.newBatteriesUnits || 0) +
                   (inv.mobilySimUnits || 0) + (inv.stcSimUnits || 0) + (inv.zainSimUnits || 0) + (inv.lebaraUnits || 0);
      unitsValues = [
        'قطع',
        inv.n950Units || 0, inv.i9000sUnits || 0, inv.i9100Units || 0,
        inv.rollPaperUnits || 0, inv.stickersUnits || 0, inv.newBatteriesUnits || 0,
        inv.mobilySimUnits || 0, inv.stcSimUnits || 0, inv.zainSimUnits || 0, inv.lebaraUnits || 0,
        unitsTotal
      ];
    }

    const unitsRow = sheet.addRow(unitsValues);
    unitsRow.alignment = { horizontal: 'center', vertical: 'middle' };
    unitsRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    // Set column widths
    const columns = [{ width: 15 }];
    for (let i = 0; i < itemTypeCount; i++) {
      columns.push({ width: 12 });
    }
    columns.push({ width: 15 });
    sheet.columns = columns;
  };

  // Create Fixed Inventory Sheet
  createInventorySheet(
    'المخزون الثابت - Fixed',
    'تقرير مخزون المندوب',
    data.fixedEntries,
    data.fixedInventory
  );

  // Create Moving Inventory Sheet
  createInventorySheet(
    'المخزون المتحرك - Moving',
    'تقرير المخزون المتحرك',
    data.movingEntries,
    data.movingInventory
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `تقرير_مخزون_المندوب_${data.technicianName}_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, fileName);
};


interface SingleWarehouseExportData {
  warehouse: {
    name: string;
    location: string;
    description: string | null;
  };
  inventory: {
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
  } | null;
  itemTypes?: ItemType[];
  entries?: InventoryEntry[];
  transfers: Array<{
    technicianName: string;
    items: string;
    status: string;
    createdAt: string;
    notes?: string;
  }>;
}

export const exportSingleWarehouseToExcel = async (data: SingleWarehouseExportData) => {
  const workbook = new ExcelJS.Workbook();
  
  const companyName = 'نظام إدارة المخزون - RAS Saudi';
  const currentDate = new Date();
  const arabicDate = currentDate.toLocaleDateString('ar-SA', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const time = currentDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  const inventorySheet = workbook.addWorksheet('المخزون');
  inventorySheet.views = [{ rightToLeft: true }];

  inventorySheet.mergeCells('A1:E1');
  const titleCell = inventorySheet.getCell('A1');
  titleCell.value = companyName;
  titleCell.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF18B2B0' }
  };
  inventorySheet.getRow(1).height = 35;

  inventorySheet.mergeCells('A2:E2');
  const subtitleCell = inventorySheet.getCell('A2');
  subtitleCell.value = `تقرير مخزون المستودع: ${data.warehouse.name}`;
  subtitleCell.font = { size: 16, bold: true, color: { argb: 'FF18B2B0' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subtitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0F7F6' }
  };
  inventorySheet.getRow(2).height = 28;

  inventorySheet.mergeCells('A3:E3');
  const locationCell = inventorySheet.getCell('A3');
  locationCell.value = `الموقع: ${data.warehouse.location}`;
  locationCell.font = { size: 12, bold: true };
  locationCell.alignment = { horizontal: 'center', vertical: 'middle' };
  locationCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F9FF' }
  };
  inventorySheet.getRow(3).height = 25;

  inventorySheet.mergeCells('A4:E4');
  const dateCell = inventorySheet.getCell('A4');
  dateCell.value = `تاريخ التقرير: ${arabicDate} - ${time}`;
  dateCell.font = { size: 11 };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  inventorySheet.getRow(4).height = 22;

  inventorySheet.addRow([]);

  const headerRow = inventorySheet.addRow(['#', 'الصنف', 'الكراتين', 'الوحدات', 'الإجمالي']);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4A5568' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  const inv = data.inventory;
  
  // Helper function to get inventory value from entries or legacy fields
  const getInventoryValue = (itemTypeId: string, valueType: 'boxes' | 'units'): number => {
    // First check entry tables
    if (data.entries) {
      const entry = data.entries.find(e => e.itemTypeId === itemTypeId);
      if (entry) {
        return valueType === 'boxes' ? entry.boxes : entry.units;
      }
    }
    
    // Fall back to legacy columns
    if (inv) {
      const legacy = legacyFieldMapping[itemTypeId];
      if (legacy) {
        const fieldName = valueType === 'boxes' ? legacy.boxes : legacy.units;
        return (inv as any)[fieldName] || 0;
      }
    }
    
    return 0;
  };
  
  // Build items list dynamically from itemTypes if available
  let items: Array<{ name: string; boxes: number; units: number }> = [];
  
  if (data.itemTypes) {
    // Use new dynamic system with itemTypes
    const sortedItemTypes = [...data.itemTypes].sort((a, b) => a.sortOrder - b.sortOrder);
    items = sortedItemTypes.map(itemType => {
      return {
        name: itemType.nameAr,
        boxes: getInventoryValue(itemType.id, 'boxes'),
        units: getInventoryValue(itemType.id, 'units')
      };
    });
  } else {
    // Fallback to legacy hardcoded items
    items = [
      { name: 'N950', boxes: inv?.n950Boxes || 0, units: inv?.n950Units || 0 },
      { name: 'I9000S', boxes: inv?.i9000sBoxes || 0, units: inv?.i9000sUnits || 0 },
      { name: 'I9100', boxes: inv?.i9100Boxes || 0, units: inv?.i9100Units || 0 },
      { name: 'ورق الطباعة', boxes: inv?.rollPaperBoxes || 0, units: inv?.rollPaperUnits || 0 },
      { name: 'الملصقات', boxes: inv?.stickersBoxes || 0, units: inv?.stickersUnits || 0 },
      { name: 'البطاريات', boxes: inv?.newBatteriesBoxes || 0, units: inv?.newBatteriesUnits || 0 },
      { name: 'موبايلي SIM', boxes: inv?.mobilySimBoxes || 0, units: inv?.mobilySimUnits || 0 },
      { name: 'STC SIM', boxes: inv?.stcSimBoxes || 0, units: inv?.stcSimUnits || 0 },
      { name: 'زين SIM', boxes: inv?.zainSimBoxes || 0, units: inv?.zainSimUnits || 0 },
      { name: 'ليبارا SIM', boxes: inv?.lebaraBoxes || 0, units: inv?.lebaraUnits || 0 },
    ];
  }

  let totalBoxes = 0;
  let totalUnits = 0;

  items.forEach((item, index) => {
    const row = inventorySheet.addRow([
      index + 1,
      item.name,
      item.boxes,
      item.units,
      item.boxes + item.units
    ]);
    totalBoxes += item.boxes;
    totalUnits += item.units;

    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });
  });

  const totalRow = inventorySheet.addRow(['', 'الإجمالي', totalBoxes, totalUnits, totalBoxes + totalUnits]);
  totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  totalRow.height = 28;
  totalRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16A085' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  inventorySheet.columns = [
    { width: 8 },
    { width: 20 },
    { width: 15 },
    { width: 15 },
    { width: 15 }
  ];

  if (data.transfers.length > 0) {
    const transfersSheet = workbook.addWorksheet('سجل النقل');
    transfersSheet.views = [{ rightToLeft: true }];

    transfersSheet.mergeCells('A1:E1');
    const transferTitleCell = transfersSheet.getCell('A1');
    transferTitleCell.value = `سجل عمليات النقل - ${data.warehouse.name}`;
    transferTitleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    transferTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    transferTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF18B2B0' }
    };
    transfersSheet.getRow(1).height = 35;

    transfersSheet.mergeCells('A2:E2');
    const transferDateCell = transfersSheet.getCell('A2');
    transferDateCell.value = `تاريخ التقرير: ${arabicDate} - ${time}`;
    transferDateCell.font = { size: 11 };
    transferDateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    transfersSheet.getRow(2).height = 22;

    transfersSheet.addRow([]);

    const transferHeaderRow = transfersSheet.addRow(['المندوب', 'الأصناف المنقولة', 'الحالة', 'التاريخ', 'الملاحظات']);
    transferHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    transferHeaderRow.height = 28;
    transferHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4A5568' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    data.transfers.forEach((transfer) => {
      const row = transfersSheet.addRow([
        transfer.technicianName,
        transfer.items,
        transfer.status,
        new Date(transfer.createdAt).toLocaleDateString('ar-SA'),
        transfer.notes || '-'
      ]);

      row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });
    });

    transfersSheet.columns = [
      { width: 20 },
      { width: 45 },
      { width: 12 },
      { width: 15 },
      { width: 25 }
    ];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `تقرير_مخزون_${data.warehouse.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, fileName);
};

  export const exportSystemLogsToExcel = async ({
    logs,
    companyName = 'نظام إدارة المخزون',
    reportTitle = 'تقرير سجل عمليات النظام'
  }: SystemLogsExportData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('سجل النظام');

    worksheet.views = [{ rightToLeft: true }];

    const currentDate = new Date().toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    worksheet.mergeCells('A1:I1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = companyName;
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF18B2B0' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A2:I2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = reportTitle;
    subtitleCell.font = { size: 14, bold: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A3:I3');
    const dateCell = worksheet.getCell('A3');
    dateCell.value = `تاريخ التقرير: ${currentDate}`;
    dateCell.font = { size: 11 };
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const headerRow = worksheet.addRow([
      '#',
      'التاريخ',
      'المستخدم',
      'الدور',
      'العملية',
      'نوع الكيان',
      'اسم الكيان',
      'المستوى',
      'الوصف'
    ]);

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF18B2B0' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    logs.forEach((log, index) => {
      worksheet.addRow([
        index + 1,
        log.createdAt ? new Date(log.createdAt).toLocaleString('ar-SA') : '-',
        log.userName || '-',
        log.userRole || '-',
        log.action || '-',
        log.entityType || '-',
        log.entityName || '-',
        log.severity || '-',
        log.description || '-'
      ]);
    });

    worksheet.columns = [
      { width: 6 },
      { width: 22 },
      { width: 22 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 20 },
      { width: 12 },
      { width: 50 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `سجل_عمليات_النظام_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(blob, fileName);
  };

export const exportWithdrawnDevicesToExcel = async ({
  devices,
  companyName = 'نظام إدارة المخزون - RAS Saudi',
  reportTitle = 'تقرير الأجهزة المسحوبة والمرتجعة الشامل'
}: {
  devices: (WithdrawnDevice & { regionName?: string })[];
  companyName?: string;
  reportTitle?: string;
}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('الأجهزة المرتجعة');

  worksheet.views = [{ rightToLeft: true }];

  const currentDate = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  worksheet.mergeCells('A1:N1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = companyName;
  titleCell.font = { size: 18, bold: true, color: { argb: 'FF18B2B0' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('A2:N2');
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = reportTitle;
  subtitleCell.font = { size: 14, bold: true };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('A3:N3');
  const dateCell = worksheet.getCell('A3');
  dateCell.value = `تاريخ التقرير: ${currentDate}`;
  dateCell.font = { size: 11 };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.addRow([]); // Blank spacer

  // Header row
  const headerRow = worksheet.addRow([
    '#',
    'المدينة (City)',
    'اسم الفني (Tec Name)',
    'رقم الجهاز (Terminal ID)',
    'الرقم التسلسلي للجهاز (serial number)',
    'البطارية سليمة ام لا (Battery)',
    'كابل الشاحن (charger cable)',
    'رأس الشاحن (charger head)',
    'وجود شريحة الاتصال في الجهاز (SIM)',
    'نوع شريحة الاتصال (SIM card type)',
    'يرجى ذكر الضرر ان وجد (damage part)',
    'ملاحظات (Notes)',
    '',
    'إجمالي عدد الأجهزة (Total Terminal ID)'
  ]);

  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.height = 35;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF18B2B0' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };
  });

  // Populate data rows
  devices.forEach((device, index) => {
    const dataRow = worksheet.addRow([
      index + 1,
      device.city || '-',
      device.technicianName || '-',
      device.terminalId || '-',
      device.serialNumber || '-',
      device.battery || '-',
      device.chargerCable || '-',
      device.chargerHead || '-',
      device.hasSim || '-',
      device.simCardType || '-',
      device.damagePart || '-',
      device.notes || '-',
      '',
      index === 0 ? devices.length : ''
    ]);

    dataRow.alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  // Apply column widths
  worksheet.columns = [
    { width: 6 },   // #
    { width: 15 },  // City
    { width: 22 },  // Tec Name
    { width: 18 },  // Terminal ID
    { width: 24 },  // serial number
    { width: 22 },  // Battery
    { width: 18 },  // charger cable
    { width: 18 },  // charger head
    { width: 28 },  // SIM
    { width: 20 },  // SIM card type
    { width: 28 },  // damage part
    { width: 30 },  // Notes
    { width: 5 },   // Blank spacer
    { width: 28 }   // Total Terminal ID
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `تقرير_الأجهزة_المسحوبة_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, fileName);
};

