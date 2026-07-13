import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

const p0 = { ar: "تقرير تفاصيل جهاز مرتجع", en: "Returned device details report" } as const;
const p1 = { ar: "بيانات العملية", en: "Operation details" } as const;
const p2 = { ar: "الحالة:", en: "Status:" } as const;
const p3 = { ar: "رقم الجهاز:", en: "Device number:" } as const;
const p4 = { ar: "الرقم التسلسلي:", en: "Serial number:" } as const;
const p5 = { ar: "تاريخ الإنشاء:", en: "Created at:" } as const;
const p6 = { ar: "آخر تحديث:", en: "Last updated:" } as const;
const p7 = { ar: "بيانات المندوب", en: "Technician details" } as const;
const p8 = { ar: "اسم المندوب:", en: "Technician name:" } as const;
const p9 = { ar: "المدينة:", en: "City:" } as const;
const p10 = { ar: "نوع الشريحة:", en: "SIM type:" } as const;
const p11 = { ar: "لا يوجد", en: "None" } as const;
const p12 = { ar: "حالة الملحقات", en: "Accessories status" } as const;
const p13 = { ar: "الملحق", en: "Accessory" } as const;
const p14 = { ar: "الحالة", en: "Status" } as const;
const p15 = { ar: "القيمة المسجلة", en: "Recorded value" } as const;
const p16 = { ar: "البطارية", en: "Battery" } as const;
const p17 = { ar: "كيبل الشاحن", en: "Charger cable" } as const;
const p18 = { ar: "رأس الشاحن", en: "Charger head" } as const;
const p19 = { ar: "الشريحة", en: "SIM card" } as const;
const p20 = { ar: "متوفر", en: "Available" } as const;
const p21 = { ar: "غير متوفر", en: "Not available" } as const;
const p22 = { ar: "ملاحظات الأضرار", en: "Damage notes" } as const;
const p23 = { ar: "لا توجد أضرار موثقة", en: "No documented damage" } as const;
const p24 = { ar: "ملاحظات المندوب", en: "Technician notes" } as const;
const p25 = { ar: "لا توجد ملاحظات إضافية", en: "No additional notes" } as const;
const p26 = { ar: "سجل التتبع", en: "Tracking log" } as const;
const p27 = { ar: "المرحلة", en: "Stage" } as const;
const p28 = { ar: "الوصف", en: "Description" } as const;
const p29 = { ar: "التوقيت", en: "Timestamp" } as const;
const p30 = { ar: "STOCKPRO - تقرير تفصيلي لعملية المرتجع", en: "STOCKPRO - Detailed returned operation report" } as const;
const p31 = { ar: "تاريخ إنشاء الملف:", en: "File generated:" } as const;

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

  return date.toLocaleString(pdfLocale(), {
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

const boolText = (value: boolean): string => (value ? pdfT(p20) : pdfT(p21));

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
  const dir = resolvePdfLang() === "en" ? "ltr" : "rtl";

  const container = document.createElement("div");
  container.style.cssText =
    `position: absolute; left: -9999px; top: 0; width: 794px; background: #ffffff; color: #111827; font-family: "Noto Kufi Arabic", Arial, sans-serif; direction: ${dir};`;

  container.innerHTML = `
    <div style="padding: 0;">
      <div style="background: linear-gradient(135deg, #18B2B0, #0f8a88); padding: 28px 30px; color: #ffffff;">
        <h1 style="margin: 0; font-size: 30px; font-weight: 700;">STOCKPRO</h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">${pdfT(p0)}</p>
      </div>

      <div style="padding: 24px 30px 16px;">
        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
          <div style="flex: 1; background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px;">
            <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">${pdfT(p1)}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr><td style="padding: 5px 0; color: #64748b; width: 105px;">${pdfT(p2)}</td><td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${escapeHtml(statusText)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p3)}</td><td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${escapeHtml(device.terminalId)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p4)}</td><td style="padding: 5px 0; color: #0f172a; font-family: monospace;">${escapeHtml(device.serialNumber)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p5)}</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(createdAt)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p6)}</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(updatedAt)}</td></tr>
            </table>
          </div>

          <div style="flex: 1; background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px;">
            <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">${pdfT(p7)}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr><td style="padding: 5px 0; color: #64748b; width: 105px;">${pdfT(p8)}</td><td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${escapeHtml(device.technicianName)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p9)}</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(device.city)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p10)}</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(device.simCardType || pdfT(p11))}</td></tr>
            </table>
          </div>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">${pdfT(p12)}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #18B2B0; color: #ffffff;">
                <th style="padding: 10px; text-align: right; border-radius: 0 8px 0 0;">${pdfT(p13)}</th>
                <th style="padding: 10px; text-align: center;">${pdfT(p14)}</th>
                <th style="padding: 10px; text-align: center; border-radius: 8px 0 0 0;">${pdfT(p15)}</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: #ffffff;">
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${pdfT(p16)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(hasBattery)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb;">${escapeHtml(device.battery || "-")}</td>
              </tr>
              <tr style="background: #f8fafc;">
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${pdfT(p17)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(hasCable)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb;">${escapeHtml(device.chargerCable || "-")}</td>
              </tr>
              <tr style="background: #ffffff;">
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${pdfT(p18)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(hasHead)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb;">${escapeHtml(device.chargerHead || "-")}</td>
              </tr>
              <tr style="background: #f8fafc;">
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${pdfT(p19)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(hasSim)}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb;">${escapeHtml(device.hasSim || "-")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #9a3412; font-size: 15px;">${pdfT(p22)}</h3>
          <p style="margin: 0; color: #7c2d12; line-height: 1.7; font-size: 13px;">${escapeHtml(device.damagePart || pdfT(p23))}</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">${pdfT(p24)}</h3>
          <p style="margin: 0; color: #0f172a; line-height: 1.7; font-size: 13px;">${escapeHtml(device.notes || pdfT(p25))}</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px;">
          <h3 style="margin: 0 0 12px 0; color: #0f766e; font-size: 17px;">${pdfT(p26)}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #18B2B0; color: #ffffff;">
                <th style="padding: 9px; text-align: right; border-radius: 0 8px 0 0;">${pdfT(p27)}</th>
                <th style="padding: 9px; text-align: right;">${pdfT(p28)}</th>
                <th style="padding: 9px; text-align: center; border-radius: 8px 0 0 0;">${pdfT(p29)}</th>
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
        <p style="margin: 0; font-size: 12px;">${pdfT(p30)}</p>
        <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.9;">${pdfT(p31)} ${escapeHtml(generatedAt)}</p>
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
