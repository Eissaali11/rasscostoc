import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Warehouse,
  User,
  FileText,
  Download,
  Send,
  Calendar,
  Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface WarehouseTransferRaw {
  id: string;
  warehouseId: string;
  technicianId: string;
  technicianName: string;
  warehouseName: string;
  itemType: string;
  packagingType: string;
  quantity: number;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected';
  rejectionReason?: string;
  performedBy: string;
  performedByName?: string;
  respondedAt?: string;
  createdAt: string;
}

interface TransferDetail {
  id: string;
  warehouseId: string;
  warehouseName: string;
  technicianId: string;
  technicianName: string;
  performedBy: string;
  performedByName: string;
  createdAt: string;
  respondedAt?: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected';
  rejectionReason?: string;
  items: Array<{
    id: string;
    itemType: string;
    itemNameAr: string;
    packagingType: string;
    quantity: number;
  }>;
}

export default function TransferDetailsPage() {
  const [, params] = useRoute("/transfer-details/:id");
  const transferId = params?.id || "";

  const { data: allTransfers, isLoading } = useQuery<WarehouseTransferRaw[]>({
    queryKey: ["/api/warehouse-transfers"],
    enabled: !!transferId,
  });

  const getItemNameAr = (itemType: string) => {
    const itemNames: Record<string, string> = {
      n950: "N950",
      i9000s: "I9000s",
      i9100: "I9100",
      rollPaper: "ورق الطباعة",
      stickers: "ملصقات",
      newBatteries: "بطاريات جديدة",
      mobilySim: "شرائح موبايلي",
      stcSim: "شرائح STC",
      zainSim: "شرائح زين",
      lebara: "شرائح ليبارا",
      lebaraSim: "شرائح ليبارا",
    };
    return itemNames[itemType] || itemType;
  };

  const transferDetail: TransferDetail | null = allTransfers
    ? (() => {
        const mainTransfer = allTransfers.find(t => t.id === transferId);
        if (!mainTransfer) return null;

        const mainDate = new Date(mainTransfer.createdAt);
        const mainDayKey = `${mainDate.getFullYear()}-${mainDate.getMonth()}-${mainDate.getDate()}`;

        const relatedTransfers = allTransfers.filter(
          t => {
            const tDate = new Date(t.createdAt);
            const tDayKey = `${tDate.getFullYear()}-${tDate.getMonth()}-${tDate.getDate()}`;
            return (
              t.technicianId === mainTransfer.technicianId &&
              t.warehouseId === mainTransfer.warehouseId &&
              tDayKey === mainDayKey &&
              t.performedBy === mainTransfer.performedBy &&
              t.status === mainTransfer.status &&
              (t.notes || '') === (mainTransfer.notes || '')
            );
          }
        );

        return {
          id: mainTransfer.id,
          warehouseId: mainTransfer.warehouseId,
          warehouseName: mainTransfer.warehouseName,
          technicianId: mainTransfer.technicianId,
          technicianName: mainTransfer.technicianName,
          performedBy: mainTransfer.performedBy,
          performedByName: mainTransfer.performedByName || mainTransfer.performedBy,
          createdAt: mainTransfer.createdAt,
          respondedAt: mainTransfer.respondedAt,
          notes: mainTransfer.notes,
          status: mainTransfer.status,
          rejectionReason: mainTransfer.rejectionReason,
          items: relatedTransfers.map(t => ({
            id: t.id,
            itemType: t.itemType,
            itemNameAr: getItemNameAr(t.itemType),
            packagingType: t.packagingType,
            quantity: t.quantity,
          })),
        };
      })()
    : null;

  const exportToExcel = async () => {
    if (!transferDetail) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('تفاصيل عملية النقل');
    worksheet.views = [{ rightToLeft: true }];

    const currentDate = new Date();
    const arabicDate = currentDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
    const time = currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'تقرير عملية النقل';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells('A2:E2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `تاريخ التقرير: ${arabicDate} | ${time}`;
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dateCell.font = { bold: true, size: 10 };
    worksheet.getRow(2).height = 20;

    worksheet.addRow([]);

    const operationDate = new Date(transferDetail.createdAt);
    const arabicOperationDate = operationDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
    const operationTime = operationDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });

    const infoSection = [
      ['المستودع:', transferDetail.warehouseName, 'المندوب:', transferDetail.technicianName],
      ['المنفذ:', transferDetail.performedByName, 'الحالة:', transferDetail.status === 'accepted' ? 'مقبول' : transferDetail.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار'],
      ['تاريخ العملية:', `${arabicOperationDate} - ${operationTime}`, '', ''],
    ];

    infoSection.forEach(rowData => {
      const row = worksheet.addRow(rowData);
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.height = 25;
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        if (colNumber === 1 || colNumber === 3) {
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE7F3FF' }
          };
        }
      });
    });

    worksheet.addRow([]);
    worksheet.addRow([]);

    const headerRow = worksheet.addRow(['#', 'اسم الصنف', 'نوع التغليف', 'الكمية']);
    headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
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

    let totalQuantity = 0;
    transferDetail.items.forEach((item, index) => {
      const row = worksheet.addRow([
        index + 1,
        item.itemNameAr,
        item.packagingType === 'box' ? 'كرتونة' : 'قطعة',
        item.quantity
      ]);
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.height = 20;
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
      });
      totalQuantity += item.quantity;
    });

    const totalRow = worksheet.addRow(['', '', 'الإجمالي', totalQuantity]);
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

    if (transferDetail.notes) {
      worksheet.addRow([]);
      worksheet.addRow([]);
      const notesRow = worksheet.addRow(['ملاحظات:', transferDetail.notes]);
      worksheet.mergeCells(notesRow.number, 2, notesRow.number, 4);
      notesRow.alignment = { horizontal: 'right', vertical: 'middle' };
      notesRow.getCell(1).font = { bold: true };
      notesRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7F3FF' }
      };
    }

    worksheet.columns = [
      { width: 8 },
      { width: 25 },
      { width: 20 },
      { width: 15 },
      { width: 15 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `عملية_نقل_${transferDetail.technicianName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-[#18B2B0]"></div>
          <p className="text-gray-500 mt-4 text-lg">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  if (!transferDetail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto shadow-xl">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">العملية غير موجودة</h2>
            <p className="text-gray-600 mb-6">لم يتم العثور على تفاصيل هذه العملية</p>
            <Link href="/warehouses">
              <Button className="bg-gradient-to-r from-[#18B2B0] to-teal-500">
                <ArrowRight className="h-4 w-4 ml-2" />
                العودة للمستودعات
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'accepted':
        return {
          badge: 'bg-gradient-to-r from-green-500 to-emerald-600',
          icon: CheckCircle,
          text: 'مقبول',
          bgColor: 'from-green-50 to-emerald-50'
        };
      case 'rejected':
        return {
          badge: 'bg-gradient-to-r from-red-500 to-rose-600',
          icon: XCircle,
          text: 'مرفوض',
          bgColor: 'from-red-50 to-rose-50'
        };
      default:
        return {
          badge: 'bg-gradient-to-r from-yellow-500 to-amber-600',
          icon: Clock,
          text: 'قيد الانتظار',
          bgColor: 'from-yellow-50 to-amber-50'
        };
    }
  };

  const statusInfo = getStatusInfo(transferDetail.status);
  const StatusIcon = statusInfo.icon;
  const totalQuantity = transferDetail.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-50" dir="rtl">
      <div className={`relative overflow-hidden bg-gradient-to-r ${statusInfo.bgColor} shadow-xl border-b-4 border-[#18B2B0]`}>
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-white/30 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        <div className="relative px-6 py-8">
          <Link href={`/warehouses/${transferDetail.warehouseId}`}>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block mb-4"
            >
              <Button 
                variant="secondary" 
                className="bg-white/70 backdrop-blur-sm border-gray-200 shadow-md hover:bg-white"
                data-testid="button-back"
              >
                <ArrowRight className="h-4 w-4 ml-2" />
                العودة للمستودع
              </Button>
            </motion.div>
          </Link>
          
          <div className="text-center">
            <Badge className={`${statusInfo.badge} text-white text-xl px-6 py-3 mb-4`}>
              <StatusIcon className="h-6 w-6 mr-2" />
              {statusInfo.text}
            </Badge>
            
            <h1 className="text-4xl font-black text-gray-800 mb-3">
              تفاصيل عملية النقل
            </h1>
            
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg text-gray-600 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                التاريخ: {new Date(transferDetail.createdAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric'
                })}
              </p>
              <p className="text-lg text-gray-600 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                الوقت: {new Date(transferDetail.createdAt).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true
                })}
              </p>
              <p className="text-sm text-gray-500">
                ({formatDistanceToNow(new Date(transferDetail.createdAt), { addSuffix: true, locale: ar })})
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex justify-end">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={exportToExcel}
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg"
              data-testid="button-export-excel"
            >
              <Download className="h-5 w-5 ml-2" />
              تصدير إلى Excel
            </Button>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-2 border-[#18B2B0]/20 shadow-lg bg-white/90">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-gradient-to-r from-[#18B2B0] to-teal-500 text-white">
                  <Warehouse className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-semibold">المستودع</p>
                  <h3 className="text-xl font-bold text-gray-800">{transferDetail.warehouseName}</h3>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-[#18B2B0]/20 shadow-lg bg-white/90">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-semibold">المندوب</p>
                  <h3 className="text-xl font-bold text-gray-800">{transferDetail.technicianName}</h3>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-[#18B2B0]/20 shadow-lg bg-white/90">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                  <Send className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-semibold">منفذ العملية</p>
                  <h3 className="text-xl font-bold text-gray-800">{transferDetail.performedByName}</h3>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-[#18B2B0]/20 shadow-lg bg-white/90">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-semibold">إجمالي الكمية</p>
                  <h3 className="text-3xl font-black text-[#18B2B0]">{totalQuantity}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2 border-[#18B2B0]/20 shadow-xl bg-white/90">
          <div className="bg-gradient-to-r from-[#18B2B0]/5 to-teal-50/50 px-6 py-4 border-b-2 border-[#18B2B0]/10">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-[#18B2B0] to-teal-500 text-white">
                <Package className="h-6 w-6" />
              </div>
              تفاصيل الأصناف المنقولة
            </h2>
          </div>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-[#18B2B0]/5 to-teal-50/50">
                    <TableHead className="text-right font-bold text-[#18B2B0]">#</TableHead>
                    <TableHead className="text-right font-bold text-[#18B2B0]">اسم الصنف</TableHead>
                    <TableHead className="text-right font-bold text-[#18B2B0]">نوع التغليف</TableHead>
                    <TableHead className="text-right font-bold text-[#18B2B0]">الكمية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferDetail.items.map((item, index) => (
                    <TableRow key={item.id} className="hover:bg-[#18B2B0]/5 transition-colors">
                      <TableCell className="font-semibold text-gray-700">{index + 1}</TableCell>
                      <TableCell className="font-medium text-gray-800">{item.itemNameAr}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-[#18B2B0]">
                          {item.packagingType === 'box' ? 'كرتونة' : 'قطعة'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-[#18B2B0]" />
                          <span className="font-bold text-[#18B2B0] text-lg">{item.quantity}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 bg-gradient-to-r from-[#18B2B0]/10 to-teal-50/50 rounded-xl p-4 border-2 border-[#18B2B0]/20">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-700">الإجمالي الكلي:</span>
                <span className="text-3xl font-black text-[#18B2B0]">{totalQuantity} قطعة</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {transferDetail.notes && (
          <Card className="border-2 border-blue-200 shadow-lg bg-gradient-to-r from-blue-50 to-cyan-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                  <Info className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-600 mb-1">ملاحظات</p>
                  <p className="text-gray-700 leading-relaxed">{transferDetail.notes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {transferDetail.status === 'rejected' && transferDetail.rejectionReason && (
          <Card className="border-2 border-red-200 shadow-lg bg-gradient-to-r from-red-50 to-rose-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-red-100 text-red-600">
                  <XCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-600 mb-1">سبب الرفض</p>
                  <p className="text-gray-700 leading-relaxed">{transferDetail.rejectionReason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

