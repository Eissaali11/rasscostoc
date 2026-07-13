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

const p0 = { ar: "تقرير رحلة الجهاز وتفاصيل العملية", en: "Device journey and operation details report" } as const;
const p1 = { ar: "بيانات الجهاز", en: "Device details" } as const;
const p2 = { ar: "رقم الجهاز:", en: "Device number:" } as const;
const p3 = { ar: "السيريال:", en: "Serial:" } as const;
const p4 = { ar: "المنطقة:", en: "Region:" } as const;
const p5 = { ar: "الحالة:", en: "Status:" } as const;
const p6 = { ar: "تاريخ الإدخال:", en: "Submitted at:" } as const;
const p7 = { ar: "تاريخ الاعتماد:", en: "Approved at:" } as const;
const p8 = { ar: "ملف التسليم", en: "Delivery file" } as const;
const p9 = { ar: "حالة الملف:", en: "File status:" } as const;
const p10 = { ar: "مرفوع", en: "Uploaded" } as const;
const p11 = { ar: "غير متوفر", en: "Not available" } as const;
const p12 = { ar: "اسم الملف:", en: "File name:" } as const;
const p13 = { ar: "المصدر:", en: "Source:" } as const;
const p14 = { ar: "سجل العمليات", en: "Operations log" } as const;
const p15 = { ar: "ملاحظات المشرف", en: "Supervisor notes" } as const;
const p16 = { ar: "وقت الرفع:", en: "Uploaded at:" } as const;
const p17 = { ar: "الرافع:", en: "Uploaded by:" } as const;
const p18 = { ar: "رابط الملف:", en: "File link:" } as const;
const p19 = { ar: "حالة الملحقات", en: "Accessories status" } as const;
const p20 = { ar: "الملحق", en: "Accessory" } as const;
const p21 = { ar: "الحالة", en: "Status" } as const;
const p22 = { ar: "البطارية", en: "Battery" } as const;
const p23 = { ar: "كابل الشاحن", en: "Charger cable" } as const;
const p24 = { ar: "رأس الشاحن", en: "Charger head" } as const;
const p25 = { ar: "الشريحة", en: "SIM card" } as const;
const p26 = { ar: "متوفر", en: "Available" } as const;
const p27 = { ar: "معلومات الأضرار", en: "Damage information" } as const;
const p28 = { ar: "لا توجد أضرار مسجلة", en: "No damage recorded" } as const;
const p29 = { ar: "لا توجد ملاحظات", en: "No notes" } as const;
const p30 = { ar: "مراحل التتبع", en: "Tracking stages" } as const;
const p31 = { ar: "المرحلة", en: "Stage" } as const;
const p32 = { ar: "الوصف", en: "Description" } as const;
const p33 = { ar: "التوقيت", en: "Timestamp" } as const;
const p34 = { ar: "السجل التاريخي", en: "History log" } as const;
const p35 = { ar: "الحدث", en: "Event" } as const;
const p36 = { ar: "النوع", en: "Type" } as const;
const p37 = { ar: "STOCKPRO - تقرير احترافي لتفاصيل رحلة الجهاز", en: "STOCKPRO - Professional device journey report" } as const;
const p38 = { ar: "تاريخ إنشاء الملف:", en: "File generated:" } as const;
const p39 = { ar: "مكتملة", en: "Completed" } as const;
const p40 = { ar: "جارية", en: "In progress" } as const;
const p41 = { ar: "متوقفة", en: "Stopped" } as const;
const p42 = { ar: "بانتظار التنفيذ", en: "Pending" } as const;
const p43 = { ar: "منجز", en: "Done" } as const;
const p44 = { ar: "جاري", en: "Active" } as const;
const p45 = { ar: "تحذير", en: "Warning" } as const;
const p46 = { ar: "تحديث", en: "Update" } as const;

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

const boolText = (value: boolean): string => (value ? pdfT(p26) : pdfT(p11));

const stageStatusText = (status: JourneyStageForPdf["status"]): string => {
  switch (status) {
    case "done":
      return pdfT(p39);
    case "active":
      return pdfT(p40);
    case "warn":
      return pdfT(p41);
    case "pending":
      return pdfT(p42);
  }
};

const timelineKindText = (kind: TimelineForPdf["kind"]): string => {
  switch (kind) {
    case "done":
      return pdfT(p43);
    case "active":
      return pdfT(p44);
    case "warn":
      return pdfT(p45);
    case "neutral":
      return pdfT(p46);
  }
};

export async function exportReceivedDeviceDetailsToPDF({
  device,
  statusText,
  journeyStages,
  timeline,
  deliveryProof,
}: ExportReceivedDeviceDetailsPdfArgs): Promise<void> {
  const dir = resolvePdfLang() === "en" ? "ltr" : "rtl";

  const container = document.createElement("div");
  container.style.cssText =
    `position: absolute; left: -9999px; top: 0; width: 794px; background: #ffffff; color: #111827; font-family: "Noto Kufi Arabic", Arial, sans-serif; direction: ${dir};`;

  container.innerHTML = `
    <div style="padding: 0;">
      <div style="background: linear-gradient(135deg, #18B2B0, #0f8a88); color: #ffffff; padding: 28px 30px;">
        <h1 style="margin: 0; font-size: 30px; font-weight: 700;">STOCKPRO</h1>
        <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">${pdfT(p0)}</p>
      </div>

      <div style="padding: 24px 30px 16px;">
        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
          <div style="flex: 1; background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px;">
            <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">${pdfT(p1)}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr><td style="padding: 5px 0; color: #64748b; width: 110px;">${pdfT(p2)}</td><td style="padding: 5px 0; color: #0f172a; font-weight: 700;">${escapeHtml(device.terminalId)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p3)}</td><td style="padding: 5px 0; color: #0f172a; font-family: monospace;">${escapeHtml(device.serialNumber)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p4)}</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(device.regionId || "-")}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p5)}</td><td style="padding: 5px 0; color: #0f172a; font-weight: 700;">${escapeHtml(statusText)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p6)}</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(formatDateTime(device.createdAt))}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p7)}</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(formatDateTime(device.approvedAt))}</td></tr>
            </table>
          </div>

          <div style="flex: 1; background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px;">
            <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">${pdfT(p8)}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr><td style="padding: 5px 0; color: #64748b; width: 130px;">${pdfT(p9)}</td><td style="padding: 5px 0; color: #0f172a;">${deliveryProof ? pdfT(p10) : pdfT(p11)}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p12)}</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(deliveryProof?.fileName || "-")}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p13)}</td><td style="padding: 5px 0; color: #0f172a;">${deliveryProof ? (deliveryProof.source === "log" ? pdfT(p14) : pdfT(p15)) : "-"}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p16)}</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(formatDateTime(deliveryProof?.createdAt || null))}</td></tr>
              <tr><td style="padding: 5px 0; color: #64748b;">${pdfT(p17)}</td><td style="padding: 5px 0; color: #0f172a;">${escapeHtml(deliveryProof?.uploadedBy || "-")}</td></tr>
            </table>
            ${
              deliveryProof
                ? `<p style="margin: 10px 0 0 0; font-size: 12px; color: #334155; line-height: 1.7;">${pdfT(p18)} ${escapeHtml(deliveryProof.url)}</p>`
                : ""
            }
          </div>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">${pdfT(p19)}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #18B2B0; color: #ffffff;">
                <th style="padding: 10px; text-align: right; border-radius: 0 8px 0 0;">${pdfT(p20)}</th>
                <th style="padding: 10px; text-align: center; border-radius: 8px 0 0 0;">${pdfT(p21)}</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: #ffffff;"><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${pdfT(p22)}</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(device.battery)}</td></tr>
              <tr style="background: #f8fafc;"><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${pdfT(p23)}</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(device.chargerCable)}</td></tr>
              <tr style="background: #ffffff;"><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${pdfT(p24)}</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(device.chargerHead)}</td></tr>
              <tr style="background: #f8fafc;"><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${pdfT(p25)}</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${boolText(device.hasSim)}${device.simCardType ? ` (${escapeHtml(device.simCardType)})` : ""}</td></tr>
            </tbody>
          </table>
        </div>

        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #9a3412; font-size: 15px;">${pdfT(p27)}</h3>
          <p style="margin: 0; color: #7c2d12; line-height: 1.7; font-size: 13px;">${escapeHtml(device.damagePart || pdfT(p28))}</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #0f766e; font-size: 17px;">${pdfT(p15)}</h3>
          <p style="margin: 0; color: #0f172a; line-height: 1.7; font-size: 13px;">${escapeHtml(device.adminNotes || pdfT(p29))}</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">${pdfT(p30)}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #18B2B0; color: #ffffff;">
                <th style="padding: 9px; text-align: right; border-radius: 0 8px 0 0;">${pdfT(p31)}</th>
                <th style="padding: 9px; text-align: right;">${pdfT(p32)}</th>
                <th style="padding: 9px; text-align: center;">${pdfT(p21)}</th>
                <th style="padding: 9px; text-align: center; border-radius: 8px 0 0 0;">${pdfT(p33)}</th>
              </tr>
            </thead>
            <tbody>
              ${journeyStages
                .map(
                  (stage, index) => `
                    <tr style="background: ${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #0f172a;">${escapeHtml(stage.title)}</td>
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; color: #334155;">${escapeHtml(stage.description || "-")}</td>
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #334155;">${stageStatusText(stage.status)}</td>
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #334155;">${escapeHtml(formatDateTime(stage.createdAt))}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; border-right: 4px solid #18B2B0; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #0f766e; font-size: 17px;">${pdfT(p34)}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #18B2B0; color: #ffffff;">
                <th style="padding: 9px; text-align: right; border-radius: 0 8px 0 0;">${pdfT(p35)}</th>
                <th style="padding: 9px; text-align: right;">${pdfT(p32)}</th>
                <th style="padding: 9px; text-align: center;">${pdfT(p36)}</th>
                <th style="padding: 9px; text-align: center; border-radius: 8px 0 0 0;">${pdfT(p33)}</th>
              </tr>
            </thead>
            <tbody>
              ${timeline
                .map(
                  (item, index) => `
                    <tr style="background: ${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #0f172a;">${escapeHtml(item.title)}</td>
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; color: #334155;">${escapeHtml(item.description || "-")}</td>
                      <td style="padding: 9px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #334155;">${timelineKindText(item.kind)}</td>
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
        <p style="margin: 0; font-size: 12px;">${pdfT(p37)}</p>
        <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.9;">${pdfT(p38)} ${escapeHtml(formatDateTime(new Date()))}</p>
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
