import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type ReceivedDeviceForPdf = {
  id: string;
  terminalId: string;
  serialNumber: string;
  battery: boolean;
  chargerCable: boolean;
  chargerHead: boolean;
  hasSim: boolean;
  simCardType: string | null;
  damagePart: string;
  adminNotes: string | null;
  status: "pending" | "approved" | "rejected";
  regionId: string | null;
  createdAt: string;
  updatedAt: string | null;
  approvedAt: string | null;
};

type JourneyStageForPdf = {
  id: string;
  title: string;
  description: string;
  createdAt: Date | null;
  status: "done" | "active" | "warn" | "pending";
};

type TimelineForPdf = {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  kind: "done" | "active" | "warn" | "neutral";
};

type DeliveryProofForPdf = {
  url: string;
  fileName: string;
  source: "log" | "adminNotes";
  createdAt: Date | null;
  uploadedBy?: string;
  isImage: boolean;
};

interface ExportReceivedDeviceDetailsPdfArgs {
  device: ReceivedDeviceForPdf;
  statusText: string;
  journeyStages: JourneyStageForPdf[];
  timeline: TimelineForPdf[];
  deliveryProof: DeliveryProofForPdf | null;
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

const stageStatusText: Record<JourneyStageForPdf["status"], string> = {
  done: "مكتملة",
  active: "جارية",
  warn: "متوقفة",
  pending: "بانتظار التنفيذ",
};

const timelineKindText: Record<TimelineForPdf["kind"], string> = {
  done: "منجز",
  active: "جاري",
  warn: "تحذير",
  neutral: "تحديث",
};

export async function exportReceivedDeviceDetailsToPDF({
  device,
  statusText,
  journeyStages,
  timeline,
  deliveryProof,
}: ExportReceivedDeviceDetailsPdfArgs): Promise<void> {
  const container = document.createElement("div");
  container.style.cssText =
    'position: absolute; left: -9999px; top: 0; width: 794px; background: #ffffff; color: #111827; font-family: "Noto Sans Arabic", Arial, sans-serif; direction: rtl;';

  container.innerHTML = `
    <div style="padding: 0;">
      <div style="background: linear-gradient(135deg, #18B2B0, #0f8a88); color: #ffffff; padding: 28px 30px;">
        <h1 style="margin: 0; font-size: 30px; font-weight: 700;">STOCKPRO</h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">تقرير رحلة الجهاز وتفاصيل العملية</p>
      </div>

      <div style="padding: 24px 30px 16px;">
        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
          <div style="flex: 1; background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px;">
            <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">بيانات الجهاز</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr><td style="padding: 5px 0; color: #64748b; width: 110px;">رقم الجهاز:</td><td style="padding: 5px 0; color: #0f172a; font-weight: 700;">${escapeHtml(device.terminalId)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">السيريال:</td><td style="padding: 5px 0; color: #0f172a; font-family: monospace;">${escapeHtml(device.serialNumber)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">المنطقة:</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(device.regionId || "-")}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">الحالة:</td><td style="padding: 5px 0; color: #0f172a; font-weight: 700;">${escapeHtml(statusText)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">تاريخ الإدخال:</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(formatDateTime(device.createdAt))}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">تاريخ الاعتماد:</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(formatDateTime(device.approvedAt))}</td></tr>
            </table>
          </div>

          <div style="flex: 1; background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px;">
            <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">ملف التسليم</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr><td style="padding: 5px 0; color: #64748b; width: 130px;">حالة الملف:</td><td style="padding: 5px 0; color: #0f172a;">${deliveryProof ? "مرفوع" : "غير متوفر"}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">اسم الملف:</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(deliveryProof?.fileName || "-")}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">المصدر:</td><td style="padding: 5px 0; color: #0f172a;">${deliveryProof ? (deliveryProof.source === "log" ? "سجل العمليات" : "ملاحظات المشرف") : "-"}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">وقت الرفع:</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(formatDateTime(deliveryProof?.createdAt || null))}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">الرافع:</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(deliveryProof?.uploadedBy || "-")}</td></tr>
            </table>
            ${
              deliveryProof
                ? `<p style="margin: 10px 0 0 0; font-size: 12px; color: #334155; line-height: 1.7;">رابط الملف: ${escapeHtml(deliveryProof.url)}</p>`
                : ""
            }
          </div>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">حالة الملحقات</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #18B2B0; color: #ffffff;">
                <th style="padding: 10px; text-align: right; border-radius: 0 8px 0 0;">الملحق</th>
                <th style="padding: 10px; text-align: center; border-radius: 8px 0 0 0;">الحالة</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: #ffffff;"><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">البطارية</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(device.battery)}</td></tr>
              <tr style="background: #f8fafc;"><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">كابل الشاحن</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(device.chargerCable)}</td></tr>
              <tr style="background: #ffffff;"><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">رأس الشاحن</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(device.chargerHead)}</td></tr>
              <tr style="background: #f8fafc;"><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">الشريحة</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(device.hasSim)}${device.simCardType ? ` (${escapeHtml(device.simCardType)})` : ""}</td></tr>
            </tbody>
          </table>
        </div>

        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #9a3412; font-size: 15px;">معلومات الأضرار</h3>
          <p style="margin: 0; color: #7c2d12; line-height: 1.7; font-size: 13px;">${escapeHtml(device.damagePart || "لا توجد أضرار مسجلة")}</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #0f766e; font-size: 17px;">ملاحظات المشرف</h3>
          <p style="margin: 0; color: #0f172a; line-height: 1.7; font-size: 13px;">${escapeHtml(device.adminNotes || "لا توجد ملاحظات")}</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">مراحل التتبع</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #18B2B0; color: #ffffff;">
                <th style="padding: 9px; text-align: right; border-radius: 0 8px 0 0;">المرحلة</th>
                <th style="padding: 9px; text-align: right;">الوصف</th>
                <th style="padding: 9px; text-align: center;">الحالة</th>
                <th style="padding: 9px; text-align: center; border-radius: 8px 0 0 0;">التوقيت</th>
              </tr>
            </thead>
            <tbody>
              ${journeyStages
                .map(
                  (stage, index) => `
                    <tr style="background: ${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #0f172a;">${escapeHtml(stage.title)}</td>
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; color: #334155;">${escapeHtml(stage.description || "-")}</td>
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #334155;">${stageStatusText[stage.status]}</td>
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #334155;">${escapeHtml(formatDateTime(stage.createdAt))}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">السجل التاريخي</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #18B2B0; color: #ffffff;">
                <th style="padding: 9px; text-align: right; border-radius: 0 8px 0 0;">الحدث</th>
                <th style="padding: 9px; text-align: right;">الوصف</th>
                <th style="padding: 9px; text-align: center;">النوع</th>
                <th style="padding: 9px; text-align: center; border-radius: 8px 0 0 0;">التوقيت</th>
              </tr>
            </thead>
            <tbody>
              ${timeline
                .map(
                  (item, index) => `
                    <tr style="background: ${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #0f172a;">${escapeHtml(item.title)}</td>
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; color: #334155;">${escapeHtml(item.description || "-")}</td>
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #334155;">${timelineKindText[item.kind]}</td>
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
        <p style="margin: 0; font-size: 12px;">STOCKPRO - تقرير احترافي لتفاصيل رحلة الجهاز</p>
        <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.9;">تاريخ إنشاء الملف: ${escapeHtml(formatDateTime(new Date()))}</p>
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
    doc.save(`received_device_journey_${safeTerminalId}_${datePart}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
