import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface WithdrawnDevicePdfRow {
  id: string;
  city: string;
  technicianName: string;
  terminalId: string;
  serialNumber: string;
  battery: string;
  chargerCable: string;
  chargerHead: string;
  hasSim: string;
  simCardType: string | null;
  damagePart: string | null;
  notes: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
}

export interface WithdrawnTimelineItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  active: boolean;
}

interface ExportWithdrawnDeviceDetailsPdfArgs {
  device: WithdrawnDevicePdfRow;
  statusText: string;
  timeline: WithdrawnTimelineItem[];
  hasBattery: boolean;
  hasCable: boolean;
  hasHead: boolean;
  hasSim: boolean;
}

const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const escapeHtml = (value?: string | null): string => {
  const text = value || "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const boolText = (value: boolean): string => (value ? "متوفر" : "غير متوفر");

export async function exportWithdrawnDeviceDetailsToPDF({
  device,
  statusText,
  timeline,
  hasBattery,
  hasCable,
  hasHead,
  hasSim,
}: ExportWithdrawnDeviceDetailsPdfArgs): Promise<void> {
  const createdAt = formatDateTime(device.createdAt);
  const updatedAt = formatDateTime(device.updatedAt || device.createdAt);
  const generatedAt = formatDateTime(new Date());

  const container = document.createElement("div");
  container.style.cssText =
    'position: absolute; left: -9999px; top: 0; width: 794px; background: #ffffff; color: #111827; font-family: "Noto Sans Arabic", Arial, sans-serif; direction: rtl;';

  container.innerHTML = `
    <div style="padding: 0;">
      <div style="background: linear-gradient(135deg, #18B2B0, #0f8a88); padding: 28px 30px; color: #ffffff;">
        <h1 style="margin: 0; font-size: 30px; font-weight: 700;">STOCKPRO</h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">تقرير تفاصيل جهاز مرتجع</p>
      </div>

      <div style="padding: 24px 30px 16px;">
        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
          <div style="flex: 1; background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px;">
            <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">بيانات العملية</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr><td style="padding: 5px 0; color: #64748b; width: 105px;">الحالة:</td><td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${escapeHtml(statusText)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">رقم الجهاز:</td><td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${escapeHtml(device.terminalId)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">الرقم التسلسلي:</td><td style="padding: 5px 0; color: #0f172a; font-family: monospace;">${escapeHtml(device.serialNumber)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">تاريخ الإنشاء:</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(createdAt)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">آخر تحديث:</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(updatedAt)}</td></tr>
            </table>
          </div>

          <div style="flex: 1; background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px;">
            <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">بيانات المندوب</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr><td style="padding: 5px 0; color: #64748b; width: 105px;">اسم المندوب:</td><td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${escapeHtml(device.technicianName)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">المدينة:</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(device.city)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">نوع الشريحة:</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(device.simCardType || "لا يوجد")}</td></tr>
            </table>
          </div>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">حالة الملحقات</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #18B2B0; color: #ffffff;">
                <th style="padding: 10px; text-align: right; border-radius: 0 8px 0 0;">الملحق</th>
                <th style="padding: 10px; text-align: center;">الحالة</th>
                <th style="padding: 10px; text-align: center; border-radius: 8px 0 0 0;">القيمة المسجلة</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: #ffffff;">
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">البطارية</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(hasBattery)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb;">${escapeHtml(device.battery || "-")}</td>
              </tr>
              <tr style="background: #f8fafc;">
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">كيبل الشاحن</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(hasCable)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb;">${escapeHtml(device.chargerCable || "-")}</td>
              </tr>
              <tr style="background: #ffffff;">
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">رأس الشاحن</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(hasHead)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb;">${escapeHtml(device.chargerHead || "-")}</td>
              </tr>
              <tr style="background: #f8fafc;">
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">الشريحة</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(hasSim)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb;">${escapeHtml(device.hasSim || "-")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #9a3412; font-size: 15px;">ملاحظات الأضرار</h3>
          <p style="margin: 0; color: #7c2d12; line-height: 1.7; font-size: 13px;">${escapeHtml(device.damagePart || "لا توجد أضرار موثقة")}</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">ملاحظات المندوب</h3>
          <p style="margin: 0; color: #0f172a; line-height: 1.7; font-size: 13px;">${escapeHtml(device.notes || "لا توجد ملاحظات إضافية")}</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px;">
          <h3 style="margin: 0 0 12px 0; color: #0f766e; font-size: 17px;">سجل التتبع</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #18B2B0; color: #ffffff;">
                <th style="padding: 9px; text-align: right; border-radius: 0 8px 0 0;">المرحلة</th>
                <th style="padding: 9px; text-align: right;">الوصف</th>
                <th style="padding: 9px; text-align: center; border-radius: 8px 0 0 0;">التوقيت</th>
              </tr>
            </thead>
            <tbody>
              ${timeline
                .map(
                  (item, index) => `
                    <tr style="background: ${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: ${item.active ? "#b45309" : "#0f172a"};">${escapeHtml(item.title)}</td>
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; color: #334155;">${escapeHtml(item.description || "-")}</td>
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #334155;">${escapeHtml(formatDateTime(item.createdAt))}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div style="background: #18B2B0; color: #ffffff; padding: 14px 22px; text-align: center;">
        <p style="margin: 0; font-size: 12px;">STOCKPRO - تقرير تفصيلي لعملية المرتجع</p>
        <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.9;">تاريخ إنشاء الملف: ${escapeHtml(generatedAt)}</p>
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

    const safeTerminalId = (device.terminalId || "unknown").replace(/[^a-zA-Z0-9-_]/g, "_");
    const datePart = new Date().toISOString().split("T")[0];
    doc.save(`withdrawn_device_report_${safeTerminalId}_${datePart}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

