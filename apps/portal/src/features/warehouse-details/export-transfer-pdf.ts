import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { WarehouseData, WarehouseItemTypeLite, WarehouseTransfer } from "./types";
import {
  extractTransferItems,
  getTransferStatusColor,
  getTransferStatusText,
} from "./transfer-helpers";

type PdfLang = 'ar' | 'en';

function resolvePdfLang(): PdfLang {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('language') === 'en') return 'en';
  return 'ar';
}

function pdfT(map: Record<PdfLang, string>, vars?: Record<string, string | number>): string {
  const lang = resolvePdfLang();
  let text = map[lang] || map.ar;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), String(v))
        .replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
    }
  }
  return text;
}

function pdfLocale(): string {
  return resolvePdfLang() === 'en' ? 'en-US' : 'ar-SA';
}

// Escape user-controlled values before interpolating into the innerHTML
// template, preventing DOM-based XSS (matches the sibling PDF-export helpers).
const escapeHtml = (value?: string | null): string => {
  const text = value || "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const p0 = { ar: "إيصال نقل المستودع", en: "Warehouse transfer receipt" } as const;
const p1 = { ar: "تفاصيل النقل", en: "Transfer details" } as const;
const p2 = { ar: "التاريخ:", en: "Date:" } as const;
const p3 = { ar: "الحالة:", en: "Status:" } as const;
const p4 = { ar: "رقم العملية:", en: "Operation ID:" } as const;
const p5 = { ar: "معلومات المستودع", en: "Warehouse info" } as const;
const p6 = { ar: "الاسم:", en: "Name:" } as const;
const p7 = { ar: "الموقع:", en: "Location:" } as const;
const p8 = { ar: "معلومات المندوب", en: "Technician info" } as const;
const p9 = { ar: "المعرف:", en: "ID:" } as const;
const p10 = { ar: "الأصناف المنقولة", en: "Transferred items" } as const;
const p11 = { ar: "الصنف", en: "Item" } as const;
const p12 = { ar: "الكمية", en: "Quantity" } as const;
const p13 = { ar: "النوع", en: "Type" } as const;
const p14 = { ar: "الإجمالي", en: "Total" } as const;
const p15 = { ar: "ملاحظات", en: "Notes" } as const;
const p16 = { ar: "STOCKPRO - نظام إدارة مخزون رأس السعودية", en: "STOCKPRO - Inventory management system" } as const;
const p17 = { ar: "تم الإنشاء:", en: "Generated:" } as const;
const pNa = { ar: "غير محدد", en: "N/A" } as const;
const pBox = { ar: "كرتون", en: "Box" } as const;
const pUnit = { ar: "وحدة", en: "Unit" } as const;

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
  const statusText = getTransferStatusText(transfer.status, resolvePdfLang());
  const statusColor = getTransferStatusColor(transfer.status);
  const items = extractTransferItems(transfer, itemTypesData);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const locale = pdfLocale();
  const dir = resolvePdfLang() === "en" ? "ltr" : "rtl";

  const container = document.createElement("div");
  container.style.cssText =
    `position: absolute; left: -9999px; top: 0; width: 794px; background: white; font-family: "Noto Kufi Arabic", Arial, sans-serif; direction: ${dir};`;

  container.innerHTML = `
      <div style="padding: 0;">
        <div style="background: linear-gradient(135deg, #18B2B0, #0f8a88); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">STOCKPRO</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${pdfT(p0)}</p>
        </div>

        <div style="padding: 30px;">
          <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px; border-right: 4px solid #18B2B0;">
            <h3 style="color: #18B2B0; margin: 0 0 15px 0; font-size: 18px;">${pdfT(p1)}</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;">${pdfT(p2)}</td>
                <td style="padding: 8px 0; color: #333; font-weight: bold;">${transferDate.toLocaleDateString(locale)} ${transferDate.toLocaleTimeString(locale)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">${pdfT(p3)}</td>
                <td style="padding: 8px 0;"><span style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 12px; border-radius: 20px; font-weight: bold;">${statusText}</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">${pdfT(p4)}</td>
                <td style="padding: 8px 0; color: #333; font-family: monospace; font-size: 12px;">${transfer.id}</td>
              </tr>
            </table>
          </div>

          <div style="display: flex; gap: 20px; margin-bottom: 20px;">
            <div style="flex: 1; background: #f8f9fa; border-radius: 12px; padding: 20px; border-right: 4px solid #18B2B0;">
              <h3 style="color: #18B2B0; margin: 0 0 15px 0; font-size: 18px;">${pdfT(p5)}</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; width: 80px;">${pdfT(p6)}</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold;">${escapeHtml(warehouse?.name) || pdfT(pNa)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">${pdfT(p7)}</td>
                  <td style="padding: 8px 0; color: #333;">${escapeHtml(warehouse?.location) || pdfT(pNa)}</td>
                </tr>
              </table>
            </div>

            <div style="flex: 1; background: #f8f9fa; border-radius: 12px; padding: 20px; border-right: 4px solid #18B2B0;">
              <h3 style="color: #18B2B0; margin: 0 0 15px 0; font-size: 18px;">${pdfT(p8)}</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; width: 80px;">${pdfT(p6)}</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold;">${escapeHtml(transfer.technicianName) || pdfT(pNa)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">${pdfT(p9)}</td>
                  <td style="padding: 8px 0; color: #333; font-family: monospace; font-size: 11px;">${transfer.technicianId?.substring(0, 12) || pdfT(pNa)}...</td>
                </tr>
              </table>
            </div>
          </div>

          <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px; border-right: 4px solid #18B2B0;">
            <h3 style="color: #18B2B0; margin: 0 0 15px 0; font-size: 18px;">${pdfT(p10)}</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #18B2B0; color: white;">
                  <th style="padding: 12px; text-align: right; border-radius: 0 8px 0 0;">${pdfT(p11)}</th>
                  <th style="padding: 12px; text-align: center;">${pdfT(p12)}</th>
                  <th style="padding: 12px; text-align: center; border-radius: 8px 0 0 0;">${pdfT(p13)}</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (item, index) => `
                  <tr style="background: ${index % 2 === 0 ? "white" : "#f0f0f0"};">
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">${escapeHtml(item.nameAr)}</td>
                    <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee; font-weight: bold;">${item.quantity}</td>
                    <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">${item.type === "box" ? pdfT(pBox) : pdfT(pUnit)}</td>
                  </tr>
                `,
                  )
                  .join("")}
                <tr style="background: #18B2B0; color: white; font-weight: bold;">
                  <td style="padding: 12px; border-radius: 0 0 8px 0;">${pdfT(p14)}</td>
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
            <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">${pdfT(p15)}</h3>
            <p style="margin: 0; color: #856404;">${escapeHtml(transfer.notes)}</p>
          </div>
          `
              : ""
          }
        </div>

        <div style="background: #18B2B0; padding: 20px; text-align: center;">
          <p style="color: white; margin: 0; font-size: 12px;">${pdfT(p16)}</p>
          <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 11px;">${pdfT(p17) + " " + new Date().toLocaleString(locale)}</p>
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
