import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  FileText,
  Loader2,
  Package,
  Search,
  User2,
  Warehouse,
  XCircle,
} from "lucide-react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { useActiveItemTypes } from "@/hooks/use-item-types";

interface WarehouseTransfer {
  id: string;
  warehouseId: string;
  technicianId: string;
  itemType: string;
  packagingType: string;
  quantity: number;
  performedBy: string;
  notes?: string;
  status: "pending" | "accepted" | "rejected";
  rejectionReason?: string;
  respondedAt?: Date | string;
  createdAt: Date | string;
  warehouseName?: string;
  technicianName?: string;
  performedByName?: string;
}

type GroupedOperation = {
  groupId: string;
  warehouseId: string;
  warehouseName?: string;
  technicianName?: string;
  technicianId: string;
  createdAt: Date | string;
  respondedAt?: Date | string;
  notes?: string;
  status: "pending" | "accepted" | "rejected";
  rejectionReason?: string;
  performedBy: string;
  performedByName?: string;
  items: Array<{
    id: string;
    itemType: string;
    itemNameAr: string;
    packagingType: string;
    quantity: number;
  }>;
};

function formatArabicDate(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatArabicTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function OperationDetailsPage() {
  const [, params] = useRoute("/operation-details/:groupId");
  const groupId = params?.groupId ? decodeURIComponent(params.groupId) : "";
  const [searchTerm, setSearchTerm] = useState("");

  const { data: itemTypesData } = useActiveItemTypes();
  const { data: transfers, isLoading } = useQuery<WarehouseTransfer[]>({
    queryKey: ["/api/warehouse-transfers"],
  });

  const getItemNameAr = (itemType: string) => {
    if (itemTypesData) {
      const dynamicItem = itemTypesData.find(
        (item) => item.nameEn.toLowerCase() === itemType.toLowerCase() || item.id === itemType,
      );
      if (dynamicItem) {
        return dynamicItem.nameAr;
      }
    }

    const itemNames: Record<string, string> = {
      n950: "N950",
      i9000s: "I9000s",
      i9100: "I9100",
      rollPaper: "ورق",
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

  const operationGroup = useMemo(() => {
    const processedTransfers = transfers?.filter((transfer) => transfer.status !== "pending") || [];

    const groupedProcessedTransfers = processedTransfers.reduce<Record<string, GroupedOperation>>((acc, transfer) => {
      const date = new Date(transfer.createdAt);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const key = `${transfer.warehouseId}-${dayKey}-${transfer.performedBy}-${transfer.status}-${transfer.notes || "no-notes"}`;

      if (!acc[key]) {
        acc[key] = {
          groupId: key,
          warehouseId: transfer.warehouseId,
          warehouseName: transfer.warehouseName,
          technicianName: transfer.technicianName,
          technicianId: transfer.technicianId,
          createdAt: transfer.createdAt,
          respondedAt: transfer.respondedAt,
          notes: transfer.notes,
          status: transfer.status,
          rejectionReason: transfer.rejectionReason,
          performedBy: transfer.performedBy,
          performedByName: transfer.performedByName,
          items: [],
        };
      }

      acc[key].items.push({
        id: transfer.id,
        itemType: transfer.itemType,
        itemNameAr: getItemNameAr(transfer.itemType),
        packagingType: transfer.packagingType,
        quantity: transfer.quantity,
      });

      return acc;
    }, {});

    return groupedProcessedTransfers[groupId];
  }, [groupId, transfers, itemTypesData]);

  const exportToExcel = async () => {
    if (!operationGroup) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("تفاصيل العملية");
    worksheet.views = [{ rightToLeft: true }];

    const currentDate = new Date();
    const reportDate = currentDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const reportTime = currentDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    worksheet.mergeCells("A1:E1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "تقرير تفاصيل العملية";
    titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells("A2:E2");
    const dateCell = worksheet.getCell("A2");
    dateCell.value = `تاريخ التقرير: ${reportDate} | ${reportTime}`;
    dateCell.alignment = { horizontal: "center", vertical: "middle" };
    dateCell.font = { bold: true, size: 10 };
    worksheet.getRow(2).height = 20;

    worksheet.addRow([]);

    const createdDate = new Date(operationGroup.createdAt);
    const createdDateStr = createdDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const createdTimeStr = createdDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const infoSection = [
      ["المستودع:", operationGroup.warehouseName, "المندوب:", operationGroup.technicianName],
      ["الحالة:", operationGroup.status === "accepted" ? "مقبول" : operationGroup.status === "rejected" ? "مرفوض" : "قيد الانتظار", "", ""],
      ["تاريخ الطلب:", `${createdDateStr} - ${createdTimeStr}`, "", ""],
    ];

    if (operationGroup.respondedAt) {
      const respondedDate = new Date(operationGroup.respondedAt);
      const respondedDateStr = respondedDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const respondedTimeStr = respondedDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      infoSection.push(["تاريخ المعالجة:", `${respondedDateStr} - ${respondedTimeStr}`, "", ""]);
    }

    infoSection.forEach((rowData) => {
      const row = worksheet.addRow(rowData);
      row.alignment = { horizontal: "center", vertical: "middle" };
      row.height = 25;
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
        if (colNumber === 1 || colNumber === 3) {
          cell.font = { bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE7F3FF" },
          };
        }
      });
    });

    worksheet.addRow([]);
    worksheet.addRow([]);

    const headerRow = worksheet.addRow(["#", "اسم المنتج", "نوع التغليف", "الكمية"]);
    headerRow.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    });

    let totalQuantity = 0;
    operationGroup.items.forEach((item, index) => {
      const row = worksheet.addRow([
        index + 1,
        item.itemNameAr,
        item.packagingType === "box" ? "كرتونة" : "قطعة",
        item.quantity,
      ]);
      row.alignment = { horizontal: "center", vertical: "middle" };
      row.height = 20;
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
      });
      totalQuantity += item.quantity;
    });

    const totalRow = worksheet.addRow(["", "", "الإجمالي", totalQuantity]);
    totalRow.font = { bold: true, size: 11 };
    totalRow.alignment = { horizontal: "center", vertical: "middle" };
    totalRow.height = 25;
    totalRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF92D050" },
      };
      cell.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    });

    if (operationGroup.notes) {
      worksheet.addRow([]);
      worksheet.addRow([]);
      const notesRow = worksheet.addRow(["ملاحظات:", operationGroup.notes]);
      worksheet.mergeCells(notesRow.number, 2, notesRow.number, 4);
      notesRow.alignment = { horizontal: "right", vertical: "middle" };
      notesRow.getCell(1).font = { bold: true };
      notesRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE7F3FF" },
      };
    }

    if (operationGroup.status === "rejected" && operationGroup.rejectionReason) {
      worksheet.addRow([]);
      const rejectionRow = worksheet.addRow(["سبب الرفض:", operationGroup.rejectionReason]);
      worksheet.mergeCells(rejectionRow.number, 2, rejectionRow.number, 4);
      rejectionRow.alignment = { horizontal: "right", vertical: "middle" };
      rejectionRow.getCell(1).font = { bold: true };
      rejectionRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFECACA" },
      };
    }

    worksheet.columns = [{ width: 8 }, { width: 25 }, { width: 20 }, { width: 15 }, { width: 15 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `تفاصيل_العملية_${operationGroup.warehouseName}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToPDF = async () => {
    if (!operationGroup) return;

    const operationDate = new Date(operationGroup.createdAt);
    const safeId = operationGroup.groupId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12);
    const operationCodePdf = `#OP-${(operationGroup.items[0]?.id || safeId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;
    const statusText = operationGroup.status === "accepted" ? "مكتملة" : "مرفوضة";
    const statusColor = operationGroup.status === "accepted" ? "#22c55e" : "#f97316";
    const total = operationGroup.items.reduce((sum, item) => sum + item.quantity, 0);
    const progressValue = operationGroup.status === "accepted" ? 100 : 35;
    const completedQuantity = operationGroup.status === "accepted" ? total : 0;
    const escapeHtml = (value?: string) =>
      (value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const container = document.createElement("div");
    container.style.cssText =
      "position:absolute;left:-9999px;top:0;width:794px;background:#0A0D14;color:#e2e8f0;font-family:'Tahoma',Arial,sans-serif;direction:rtl;";

    container.innerHTML = `
      <div style="padding:0;min-height:1123px;background:#0A0D14;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;pointer-events:none;">
          <div style="position:absolute;top:-20%;left:-10%;width:50%;height:50%;background:rgba(0,242,255,0.08);filter:blur(120px);border-radius:9999px;"></div>
          <div style="position:absolute;top:30%;right:-15%;width:40%;height:40%;background:rgba(188,19,254,0.08);filter:blur(120px);border-radius:9999px;"></div>
          <div style="position:absolute;bottom:-20%;left:30%;width:60%;height:60%;background:rgba(255,140,0,0.08);filter:blur(140px);border-radius:9999px;"></div>
        </div>

        <div style="position:relative;z-index:1;padding:26px;">
          <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:22px;padding:20px 22px;backdrop-filter:blur(18px);">
            <div>
              <p style="margin:0;color:#94a3b8;font-size:13px;">العمليات / تفاصيل العملية</p>
              <h1 style="margin:6px 0 0 0;font-size:28px;color:#ffffff;font-weight:700;">${operationCodePdf}</h1>
              <p style="margin:6px 0 0 0;color:#94a3b8;font-size:12px;">${escapeHtml(operationGroup.warehouseName || "المستودع")} ➜ ${escapeHtml(operationGroup.technicianName || "المندوب")}</p>
            </div>
            <div style="text-align:left;">
              <span style="display:inline-block;background:${statusColor}20;color:${statusColor};padding:6px 12px;border-radius:999px;font-weight:700;border:1px solid ${statusColor}66;font-size:12px;">${statusText}</span>
              <p style="margin:10px 0 0 0;color:#94a3b8;font-size:11px;">${formatArabicDate(operationGroup.createdAt)} - ${formatArabicTime(operationGroup.createdAt)}</p>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:16px;">
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:14px 16px;">
              <p style="margin:0;color:#94a3b8;font-size:11px;">إجمالي الأصناف</p>
              <p style="margin:8px 0 0 0;font-size:28px;color:#ffffff;font-weight:700;">${operationGroup.items.length}</p>
            </div>
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:14px 16px;">
              <p style="margin:0;color:#94a3b8;font-size:11px;">الكمية الإجمالية</p>
              <p style="margin:8px 0 0 0;font-size:28px;color:#00F2FF;font-weight:700;">${total}</p>
            </div>
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:14px 16px;">
              <p style="margin:0;color:#94a3b8;font-size:11px;">نسبة الإنجاز</p>
              <p style="margin:8px 0 6px 0;font-size:28px;color:#ffffff;font-weight:700;">${progressValue}%</p>
              <div style="height:5px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden;">
                <div style="height:100%;width:${progressValue}%;background:linear-gradient(90deg,#00F2FF,#3b82f6);"></div>
              </div>
            </div>
          </div>

          <div style="margin-top:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:18px;overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;">
              <h3 style="margin:0;color:#ffffff;font-size:16px;">قائمة المنتجات</h3>
              <span style="color:#94a3b8;font-size:12px;">${operationGroup.items.length} عنصر</span>
            </div>
            <table style="width:100%;border-collapse:collapse;background:transparent;">
              <thead>
                <tr style="background:rgba(255,255,255,0.02);color:#94a3b8;">
                  <th style="padding:11px 12px;text-align:right;font-size:11px;border-bottom:1px solid rgba(255,255,255,0.08);">اسم المنتج</th>
                  <th style="padding:11px 12px;text-align:right;font-size:11px;border-bottom:1px solid rgba(255,255,255,0.08);">الباركود</th>
                  <th style="padding:11px 12px;text-align:center;font-size:11px;border-bottom:1px solid rgba(255,255,255,0.08);">المطلوب</th>
                  <th style="padding:11px 12px;text-align:center;font-size:11px;border-bottom:1px solid rgba(255,255,255,0.08);">المحقق</th>
                  <th style="padding:11px 12px;text-align:center;font-size:11px;border-bottom:1px solid rgba(255,255,255,0.08);">الحالة</th>
                </tr>
              </thead>
              <tbody>
                ${operationGroup.items
                  .map(
                    (item, index) => `
                  <tr style="background:${index % 2 === 0 ? "rgba(255,255,255,0.00)" : "rgba(255,255,255,0.02)"};">
                    <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);color:#f1f5f9;">${escapeHtml(item.itemNameAr)}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);color:#94a3b8;font-family:monospace;font-size:11px;">${escapeHtml(`${item.itemType.toUpperCase()}-${item.id.slice(0, 4).toUpperCase()}`)}</td>
                    <td style="padding:10px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);color:#cbd5e1;">${item.quantity}</td>
                    <td style="padding:10px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);color:#22d3ee;font-weight:700;">${operationGroup.status === "accepted" ? item.quantity : 0}</td>
                    <td style="padding:10px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
                      <span style="display:inline-block;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:700;background:${operationGroup.status === "accepted" ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)"};color:${operationGroup.status === "accepted" ? "#4ade80" : "#fb923c"};border:1px solid ${operationGroup.status === "accepted" ? "rgba(34,197,94,0.35)" : "rgba(249,115,22,0.35)"};">
                        ${operationGroup.status === "accepted" ? "مكتمل" : "ملغي النقل"}
                      </span>
                    </td>
                  </tr>
                `,
                  )
                  .join("")}
                <tr style="background:rgba(255,255,255,0.03);color:#e2e8f0;font-weight:700;">
                  <td style="padding:11px 12px;">الإجمالي</td>
                  <td style="padding:11px 12px;"></td>
                  <td style="padding:11px 12px;text-align:center;">${total}</td>
                  <td style="padding:11px 12px;text-align:center;color:#22d3ee;">${completedQuantity}</td>
                  <td style="padding:11px 12px;"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="margin-top:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:14px 16px;">
            <h4 style="margin:0 0 10px 0;color:#ffffff;font-size:14px;">سجل النشاطات</h4>
            <div style="border-right:1px solid rgba(255,255,255,0.12);padding-right:12px;">
              <p style="margin:0 0 6px 0;color:#cbd5e1;font-size:12px;"><b style="color:#22d3ee;">إنشاء العملية</b> — ${formatArabicDate(operationGroup.createdAt)} ${formatArabicTime(operationGroup.createdAt)}</p>
              <p style="margin:0 0 6px 0;color:#cbd5e1;font-size:12px;"><b style="color:${statusColor};">${statusText}</b> — ${operationGroup.respondedAt ? `${formatArabicDate(operationGroup.respondedAt)} ${formatArabicTime(operationGroup.respondedAt)}` : "بانتظار المعالجة"}</p>
              ${operationGroup.notes ? `<p style="margin:0;color:#94a3b8;font-size:12px;"><b>ملاحظات:</b> ${escapeHtml(operationGroup.notes)}</p>` : ""}
            </div>
          </div>

          ${operationGroup.rejectionReason ? `<div style="margin-top:12px;background:rgba(249,115,22,0.12);border-radius:12px;padding:14px 16px;border-right:4px solid #f97316;color:#fed7aa;"><b>سبب الرفض:</b> ${escapeHtml(operationGroup.rejectionReason)}</div>` : ""}
        </div>

        <div style="position:relative;z-index:1;background:rgba(15,23,42,0.9);padding:14px;text-align:center;border-top:1px solid rgba(255,255,255,0.08);">
          <p style="color:#cbd5e1;margin:0;font-size:11px;">STOCKPRO — تم إنشاء التقرير في ${new Date().toLocaleString("ar-SA")}</p>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= pageHeight) {
        doc.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight;
        let position = 0;

        doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = -pageHeight + (imgHeight - heightLeft - pageHeight);
          doc.addPage();
          doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      }

      const dateStr = operationDate.toISOString().split("T")[0];
      doc.save(`operation_${dateStr}_${safeId}.pdf`);
    } finally {
      document.body.removeChild(container);
    }
  };

  if (isLoading) {
    return (
        <div className="min-h-[60vh] flex items-center justify-center bg-[#0A0D14] -m-8">
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-cyan-300" />
            <p className="mt-3 text-slate-300">جاري تحميل تفاصيل العملية...</p>
          </div>
        </div>
    );
  }

  if (!operationGroup) {
    return (
        <div className="-m-8 min-h-[calc(100vh-5rem)] bg-[#0A0D14] text-slate-200 flex items-center justify-center">
          <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-2xl p-8 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">العملية غير موجودة</h2>
            <p className="text-slate-400 mb-6">لم يتم العثور على تفاصيل هذه العملية</p>
            <Link href="/operations">
              <Button className="rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/20">
                <ArrowLeft className="h-4 w-4 ml-2" />
                العودة للعمليات
              </Button>
            </Link>
          </div>
        </div>
    );
  }

  const totalQuantity = operationGroup.items.reduce((acc, item) => acc + item.quantity, 0);
  const progress = operationGroup.status === "accepted" ? 100 : operationGroup.status === "rejected" ? 35 : 65;
  const operationCode = `#OP-${(operationGroup.items[0]?.id || groupId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;

  const durationText = (() => {
    if (!operationGroup.respondedAt) return "بانتظار المعالجة";
    const start = new Date(operationGroup.createdAt).getTime();
    const end = new Date(operationGroup.respondedAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return "—";

    const minutes = Math.round((end - start) / 60000);
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    if (hours === 0) return `${restMinutes} دقيقة`;
    if (restMinutes === 0) return `${hours} ساعة`;
    return `${hours} ساعة و ${restMinutes} دقيقة`;
  })();

  const filteredItems = operationGroup.items.filter((item) => {
    if (!searchTerm.trim()) return true;
    const normalizedSearch = searchTerm.toLowerCase();
    return item.itemNameAr.toLowerCase().includes(normalizedSearch) || item.itemType.toLowerCase().includes(normalizedSearch);
  });

  const timelineItems: Array<{
    key: string;
    title: string;
    description: string;
    time: string;
    tone: "done" | "info" | "warn";
  }> = [
    {
      key: "created",
      title: "إنشاء العملية",
      description: `تم إنشاء العملية بواسطة ${operationGroup.performedByName || "المستخدم"}`,
      time: `${formatArabicDate(operationGroup.createdAt)} - ${formatArabicTime(operationGroup.createdAt)}`,
      tone: "done" as "done",
    },
    ...(operationGroup.notes
      ? [
          {
            key: "notes",
            title: "إضافة ملاحظات",
            description: operationGroup.notes,
            time: "بعد إنشاء العملية",
            tone: "info" as "info",
          },
        ]
      : []),
    {
      key: "result",
      title: operationGroup.status === "accepted" ? "اعتماد العملية" : "رفض العملية",
      description:
        operationGroup.status === "accepted"
          ? "تم اعتماد العملية بنجاح"
          : operationGroup.rejectionReason || "تم رفض العملية بدون ملاحظات إضافية",
      time: operationGroup.respondedAt
        ? `${formatArabicDate(operationGroup.respondedAt)} - ${formatArabicTime(operationGroup.respondedAt)}`
        : "بانتظار المعالجة",
      tone: (operationGroup.status === "accepted" ? "done" : "warn") as "done" | "warn",
    },
  ];

  return (
      <div className="-m-8 min-h-[calc(100vh-5rem)] bg-[#0A0D14] text-slate-200 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-cyan-400/5 blur-[120px] rounded-full" />
          <div className="absolute top-[30%] -right-[15%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full" />
          <div className="absolute -bottom-[20%] left-[30%] w-[60%] h-[60%] bg-orange-500/5 blur-[150px] rounded-full" />
        </div>

        <div className="relative z-10 p-6 md:p-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-slate-400">
              <Link href="/operations">
                <button
                  className="size-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
                  type="button"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </Link>
              <h2 className="text-xl font-light text-white tracking-wide">
                العمليات / <span className="font-bold text-cyan-300">تفاصيل العملية</span>
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={exportToPDF}
                className="rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10"
                data-testid="button-export-pdf"
              >
                <FileText className="h-4 w-4 ml-2 text-cyan-300" />
                Export PDF
              </Button>
              <Button
                onClick={exportToExcel}
                className="rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10"
                data-testid="button-export-excel"
              >
                <FileSpreadsheet className="h-4 w-4 ml-2 text-emerald-300" />
                Export Excel
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 shrink-0">
              <Package className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-3xl font-light text-white tracking-wide">
                  تفاصيل العملية: <span className="font-bold">{operationCode}</span>
                </h1>
                <Badge
                  className={
                    operationGroup.status === "accepted"
                      ? "bg-green-400/10 text-green-300 border border-green-400/30"
                      : "bg-orange-400/10 text-orange-300 border border-orange-400/30"
                  }
                >
                  {operationGroup.status === "accepted" ? "مكتملة" : "مرفوضة"}
                </Badge>
              </div>
              <p className="text-slate-500 text-sm font-light">
                نقل مخزون داخلي - {operationGroup.warehouseName || "المستودع"} إلى {operationGroup.technicianName || "المندوب"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 flex items-start gap-4">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-slate-300 shrink-0">
                <User2 className="h-6 w-6" />
              </div>
              <div className="w-full">
                <p className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-3">المسؤول عن العملية</p>
                <p className="text-sm font-bold text-white">{operationGroup.performedByName || "غير محدد"}</p>
                <p className="text-xs text-slate-400 mt-1">{operationGroup.technicianName || "مندوب"}</p>
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 flex items-start gap-4">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-slate-300 shrink-0">
                <Clock3 className="h-6 w-6" />
              </div>
              <div className="w-full space-y-2">
                <p className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">التوقيت والجدول الزمني</p>
                <div>
                  <p className="text-[10px] text-slate-500">التاريخ</p>
                  <p className="text-sm text-slate-200">{formatArabicDate(operationGroup.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">الوقت</p>
                  <p className="text-sm text-slate-200">{formatArabicTime(operationGroup.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">مدة العمل</p>
                  <p className="text-sm text-orange-300">{durationText}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 flex items-start gap-4">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-slate-300 shrink-0">
                <Warehouse className="h-6 w-6" />
              </div>
              <div className="w-full">
                <p className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-3">إحصائيات سريعة</p>
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-[10px] text-slate-500">عدد الأصناف</p>
                    <p className="text-xl font-bold text-white tabular-nums">{operationGroup.items.length}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-slate-500">إجمالي الكمية</p>
                    <p className="text-xl font-bold text-white tabular-nums">{totalQuantity}</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center text-[10px] mb-1">
                    <span className="text-slate-400">نسبة الإنجاز</span>
                    <span className="text-cyan-300 font-bold tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 bg-white/[0.02] backdrop-blur-2xl border border-cyan-400/20 rounded-[2rem] overflow-hidden">
              <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-medium text-white">قائمة المنتجات</h3>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="البحث في المنتجات..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 ps-3 pe-9 focus:ring-1 focus:ring-cyan-300 focus:border-cyan-300 text-xs transition-all placeholder:text-slate-600 outline-none text-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      <th className="px-4 py-3 text-xs font-bold text-slate-400">اسم المنتج</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400">الباركود</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 text-center">الكمية المطلوبة</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 text-center">الكمية المحققة</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-4 text-sm text-slate-100 font-medium">{item.itemNameAr}</td>
                        <td className="px-4 py-4 text-xs text-slate-400 font-mono tracking-wider">{`${item.itemType.toUpperCase()}-${item.id.slice(0, 4).toUpperCase()}`}</td>
                        <td className="px-4 py-4 text-center text-sm text-slate-300 tabular-nums">{item.quantity}</td>
                        <td className="px-4 py-4 text-center font-bold text-cyan-300 tabular-nums">
                          {operationGroup.status === "accepted" ? item.quantity : 0}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={
                              operationGroup.status === "accepted"
                                ? "inline-flex items-center px-2 py-1 rounded text-[10px] font-medium bg-green-400/10 text-green-400 border border-green-400/20"
                                : "inline-flex items-center px-2 py-1 rounded text-[10px] font-medium bg-orange-400/10 text-orange-300 border border-orange-400/20"
                            }
                          >
                            {operationGroup.status === "accepted" ? "مكتمل" : "ملغي النقل"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredItems.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-sm">لا توجد منتجات مطابقة للبحث</div>
                )}
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6">
              <h3 className="text-lg font-medium text-white mb-6">سجل النشاطات</h3>
              <div className="space-y-0">
                {timelineItems.map((event, index) => {
                  const isDone = event.tone === "done";
                  const isWarn = event.tone === "warn";
                  return (
                    <div key={event.key} className="relative ps-8 pb-8 last:pb-0">
                      {index !== timelineItems.length - 1 && <div className="absolute right-[11px] top-2 bottom-0 w-px bg-white/10" />}
                      <div
                        className={
                          isDone
                            ? "absolute right-0 top-0 size-6 rounded-full border-2 border-[#0A0D14] bg-cyan-300 flex items-center justify-center"
                            : isWarn
                              ? "absolute right-0 top-0 size-6 rounded-full border-2 border-[#0A0D14] bg-orange-300 flex items-center justify-center"
                              : "absolute right-0 top-0 size-6 rounded-full border-2 border-[#0A0D14] bg-slate-500 flex items-center justify-center"
                        }
                      >
                        {isWarn ? <XCircle className="h-3.5 w-3.5 text-[#0A0D14]" /> : <CheckCircle2 className="h-3.5 w-3.5 text-[#0A0D14]" />}
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className={isWarn ? "text-sm font-medium text-orange-300" : "text-sm font-medium text-white"}>{event.title}</p>
                        <p className="text-[11px] text-slate-400 mt-1 leading-5">{event.description}</p>
                        <p className="text-[10px] text-cyan-300 mt-2">{event.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
