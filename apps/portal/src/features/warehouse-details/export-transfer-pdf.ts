import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { WarehouseData, WarehouseItemTypeLite, WarehouseTransfer } from "./types";
import {
  extractTransferItems,
  getTransferStatusColor,
  getTransferStatusText,
} from "./transfer-helpers";

interface ExportWarehouseTransferPdfArgs {
  transfer: WarehouseTransfer;
  warehouse?: Pick<WarehouseData, "name" | "location"> | null;
  itemTypesData?: WarehouseItemTypeLite[];
}

export async function exportWarehouseTransferToPDF({
  transfer,
  warehouse,
  itemTypesData,
}: ExportWarehouseTransferPdfArgs): Promise<void> {
  const transferDate = new Date(transfer.createdAt);
  const statusText = getTransferStatusText(transfer.status);
  const statusColor = getTransferStatusColor(transfer.status);
  const items = extractTransferItems(transfer, itemTypesData);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const container = document.createElement("div");
  container.style.cssText =
    'position: absolute; left: -9999px; top: 0; width: 794px; background: white; font-family: "Noto Sans Arabic", Arial, sans-serif; direction: rtl;';

  container.innerHTML = `
      <div style="padding: 0;">
        <div style="background: linear-gradient(135deg, #18B2B0, #0f8a88); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">STOCKPRO</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">إيصال نقل المستودع</p>
        </div>

        <div style="padding: 30px;">
          <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px; border-right: 4px solid #18B2B0;">
            <h3 style="color: #18B2B0; margin: 0 0 15px 0; font-size: 18px;">تفاصيل النقل</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;">التاريخ:</td>
                <td style="padding: 8px 0; color: #333; font-weight: bold;">${transferDate.toLocaleDateString("ar-SA")} ${transferDate.toLocaleTimeString("ar-SA")}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">الحالة:</td>
                <td style="padding: 8px 0;"><span style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 12px; border-radius: 20px; font-weight: bold;">${statusText}</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">رقم العملية:</td>
                <td style="padding: 8px 0; color: #333; font-family: monospace; font-size: 12px;">${transfer.id}</td>
              </tr>
            </table>
          </div>

          <div style="display: flex; gap: 20px; margin-bottom: 20px;">
            <div style="flex: 1; background: #f8f9fa; border-radius: 12px; padding: 20px; border-right: 4px solid #18B2B0;">
              <h3 style="color: #18B2B0; margin: 0 0 15px 0; font-size: 18px;">معلومات المستودع</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; width: 80px;">الاسم:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold;">${warehouse?.name || "غير محدد"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">الموقع:</td>
                  <td style="padding: 8px 0; color: #333;">${warehouse?.location || "غير محدد"}</td>
                </tr>
              </table>
            </div>

            <div style="flex: 1; background: #f8f9fa; border-radius: 12px; padding: 20px; border-right: 4px solid #18B2B0;">
              <h3 style="color: #18B2B0; margin: 0 0 15px 0; font-size: 18px;">معلومات المندوب</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; width: 80px;">الاسم:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold;">${transfer.technicianName || "غير محدد"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">المعرف:</td>
                  <td style="padding: 8px 0; color: #333; font-family: monospace; font-size: 11px;">${transfer.technicianId?.substring(0, 12) || "غير محدد"}...</td>
                </tr>
              </table>
            </div>
          </div>

          <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px; border-right: 4px solid #18B2B0;">
            <h3 style="color: #18B2B0; margin: 0 0 15px 0; font-size: 18px;">الأصناف المنقولة</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #18B2B0; color: white;">
                  <th style="padding: 12px; text-align: right; border-radius: 0 8px 0 0;">الصنف</th>
                  <th style="padding: 12px; text-align: center;">الكمية</th>
                  <th style="padding: 12px; text-align: center; border-radius: 8px 0 0 0;">النوع</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item, index) => `
                  <tr style="background: ${index % 2 === 0 ? "white" : "#f0f0f0"};">
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.nameAr}</td>
                    <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee; font-weight: bold;">${item.quantity}</td>
                    <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">${item.type === "box" ? "كرتون" : "قطعة"}</td>
                  </tr>
                `,
                  )
                  .join("")}
                <tr style="background: #18B2B0; color: white; font-weight: bold;">
                  <td style="padding: 12px; border-radius: 0 0 8px 0;">الإجمالي</td>
                  <td style="padding: 12px; text-align: center;">${totalItems}</td>
                  <td style="padding: 12px; border-radius: 0 0 0 8px;"></td>
                </tr>
              </tbody>
            </table>
          </div>

          ${
            transfer.notes
              ? `
          <div style="background: #fff3cd; border-radius: 12px; padding: 20px; margin-bottom: 20px; border-right: 4px solid #ffc107;">
            <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">ملاحظات</h3>
            <p style="margin: 0; color: #856404;">${transfer.notes}</p>
          </div>
          `
              : ""
          }
        </div>

        <div style="background: #18B2B0; padding: 20px; text-align: center;">
          <p style="color: white; margin: 0; font-size: 12px;">STOCKPRO - نظام إدارة مخزون راس السعودية</p>
          <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 11px;">تم الإنشاء: ${new Date().toLocaleString("ar-SA")}</p>
        </div>
      </div>
    `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
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

    const dateStr = transferDate.toISOString().split("T")[0];
    const fileName = `transfer_${dateStr}_${transfer.id.substring(0, 8)}.pdf`;
    doc.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

