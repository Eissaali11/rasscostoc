import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { EmployeeProfileExtraData, EmployeeStoredFile } from "@/lib/employee-profile-extra";
import rasscoLogoIcon from "@/assets/rassco-logo-icon.png";
import rasscoLogoMark from "@/assets/rassco-logo-mark.png";

const IDENTITY_FONT =
  '"Noto Kufi Arabic", "Montserrat", ui-sans-serif, system-ui, sans-serif';

async function assetToDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`تعذر تحميل أصل الهوية: ${src}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذر قراءة شعار RASSCO"));
    reader.readAsDataURL(blob);
  });
}

async function ensureIdentityFontsReady(): Promise<void> {
  if (!document.fonts?.load) return;
  await Promise.allSettled([
    document.fonts.load('400 14px "Noto Kufi Arabic"'),
    document.fonts.load('600 14px "Noto Kufi Arabic"'),
    document.fonts.load('700 16px "Noto Kufi Arabic"'),
    document.fonts.load('800 18px "Noto Kufi Arabic"'),
    document.fonts.load('900 24px "Noto Kufi Arabic"'),
    document.fonts.ready,
  ]);
}

export type EmployeeProfileExportUser = {
  id: string;
  fullName: string;
  username?: string;
  email?: string | null;
  city?: string | null;
  role?: string;
  profileImage?: string | null;
  isActive?: boolean;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  employeeCode?: string | null;
  technicianCode?: string | null;
};

export type EmployeeProfileExportDoc = {
  id: string;
  label: string;
  file: EmployeeStoredFile;
};

export type EmployeeProfileExportPayload = {
  user: EmployeeProfileExportUser;
  profile: EmployeeProfileExtraData | null;
  roleLabel: string;
  regionName: string;
  employeeNumber: string;
  documents: EmployeeProfileExportDoc[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cell(value?: string | null): string {
  const v = (value ?? "").toString().trim();
  return v || "—";
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "employee";
}

function isImageAttachment(file?: { type?: string; name?: string } | null): boolean {
  if (!file) return false;
  if (file.type?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name || "");
}

function buildRows(payload: EmployeeProfileExportPayload): Array<{ section: string; field: string; value: string }> {
  const p = payload.profile || {};
  const u = payload.user;
  return [
    { section: "الهوية", field: "الاسم الكامل", value: cell(u.fullName) },
    { section: "الهوية", field: "اسم المستخدم", value: cell(u.username) },
    { section: "الهوية", field: "البريد الإلكتروني", value: cell(u.email) },
    { section: "الهوية", field: "الحالة", value: u.isActive ? "نشط" : "غير نشط" },
    { section: "الهوية", field: "المسمى الوظيفي", value: cell(payload.roleLabel) },
    { section: "الهوية", field: "الرقم الوظيفي", value: cell(payload.employeeNumber) },
    { section: "الهوية", field: "المنطقة", value: cell(payload.regionName) },

    { section: "المعلومات الشخصية", field: "رقم الهوية", value: cell(p.nationalId) },
    { section: "المعلومات الشخصية", field: "رقم الجوال", value: cell(p.phoneNumber || u.username) },
    { section: "المعلومات الشخصية", field: "تاريخ الميلاد", value: cell(p.birthDate) },
    { section: "المعلومات الشخصية", field: "انتهاء الهوية", value: cell(p.nationalIdExpiryDate) },
    { section: "المعلومات الشخصية", field: "اسم الكفيل", value: cell(p.sponsorName) },
    { section: "المعلومات الشخصية", field: "انتهاء الرخصة", value: cell(p.licenseExpiryDate) },
    { section: "المعلومات الشخصية", field: "رقم الجواز", value: cell(p.passportNumber) },
    { section: "المعلومات الشخصية", field: "انتهاء الجواز", value: cell(p.passportExpiryDate) },
    { section: "المعلومات الشخصية", field: "الجنسية", value: cell(p.nationality) },
    { section: "المعلومات الشخصية", field: "رقم أبشر", value: cell(p.absherNumber) },
    { section: "المعلومات الشخصية", field: "المؤهل", value: cell(p.qualification) },

    { section: "المعلومات الوظيفية", field: "المشروع الحالي", value: cell(p.projectName) },
    { section: "المعلومات الوظيفية", field: "المدينة", value: cell(p.city || u.city) },

    { section: "عهدة السيارة", field: "رقم اللوحة", value: cell(p.carPlateNumber) },
    { section: "عهدة السيارة", field: "نوع السيارة", value: cell(p.carType) },
    { section: "عهدة السيارة", field: "الموديل", value: cell(p.carModel) },
    { section: "عهدة السيارة", field: "سنة الصنع", value: cell(p.carYear) },

    { section: "عهدة الجوال", field: "نوع الجوال", value: cell(p.phoneType) },
    { section: "عهدة الجوال", field: "السيريال / IMEI", value: cell(p.phoneSerial) },
    { section: "عهدة الجوال", field: "رقم العمل", value: cell(p.businessPhoneNumber) },
    { section: "عهدة الجوال", field: "نوع الشريحة", value: cell(p.simType) },

    ...payload.documents.map((doc) => ({
      section: "الوثائق",
      field: doc.label,
      value: cell(doc.file.name),
    })),
  ];
}

export async function exportEmployeeProfileToExcel(payload: EmployeeProfileExportPayload): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RASSCO";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("ملف الموظف", {
    views: [{ rightToLeft: true }],
  });

  sheet.columns = [
    { header: "القسم", key: "section", width: 22 },
    { header: "الحقل", key: "field", width: 28 },
    { header: "القيمة", key: "value", width: 42 },
  ];

  const title = sheet.addRow([`استمارة ملف موظف — ${payload.user.fullName}`]);
  sheet.mergeCells(1, 1, 1, 3);
  title.font = { bold: true, size: 14, color: { argb: "FF2D3135" } };
  title.alignment = { horizontal: "right", vertical: "middle" };
  title.height = 28;

  const meta = sheet.addRow([
    `الرقم الوظيفي: ${payload.employeeNumber}`,
    `التاريخ: ${new Date().toLocaleDateString("ar-SA")}`,
    `الحالة: ${payload.user.isActive ? "نشط" : "غير نشط"}`,
  ]);
  meta.font = { size: 10, color: { argb: "FF6B7280" } };

  sheet.addRow([]);

  const header = sheet.addRow(["القسم", "الحقل", "القيمة"]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF18B2B0" } };
    c.alignment = { horizontal: "right", vertical: "middle" };
  });

  for (const row of buildRows(payload)) {
    const excelRow = sheet.addRow([row.section, row.field, row.value]);
    excelRow.eachCell((c) => {
      c.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
      c.border = {
        top: { style: "thin", color: { argb: "FFE6E8EC" } },
        left: { style: "thin", color: { argb: "FFE6E8EC" } },
        bottom: { style: "thin", color: { argb: "FFE6E8EC" } },
        right: { style: "thin", color: { argb: "FFE6E8EC" } },
      };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `RASSCO-employee-${safeFileName(payload.user.fullName || payload.user.id)}.xlsx`);
}

function fieldCell(label: string, value: string): string {
  return `
    <div style="border:1px solid #E6E8EC;border-radius:12px;padding:10px 12px;background:#fff;min-height:64px;font-family:${IDENTITY_FONT};">
      <div style="font-size:10px;color:#6B7280;font-weight:700;margin-bottom:4px;font-family:${IDENTITY_FONT};">${escapeHtml(label)}</div>
      <div style="font-size:13px;color:#2D3135;font-weight:800;line-height:1.55;word-break:break-word;font-family:${IDENTITY_FONT};">${escapeHtml(value)}</div>
    </div>
  `;
}

export async function exportEmployeeProfileToPdf(payload: EmployeeProfileExportPayload): Promise<void> {
  const p = payload.profile || {};
  const u = payload.user;
  const imageDocs = payload.documents.filter((d) => isImageAttachment(d.file) && d.file.dataUrl);

  const [logoIconDataUrl, logoMarkDataUrl] = await Promise.all([
    assetToDataUrl(rasscoLogoIcon),
    assetToDataUrl(rasscoLogoMark),
  ]);
  await ensureIdentityFontsReady();

  const personal = [
    ["الاسم الكامل", cell(u.fullName)],
    ["رقم الهوية", cell(p.nationalId)],
    ["رقم الجوال", cell(p.phoneNumber || u.username)],
    ["تاريخ الميلاد", cell(p.birthDate)],
    ["انتهاء الهوية", cell(p.nationalIdExpiryDate)],
    ["اسم الكفيل", cell(p.sponsorName)],
    ["رقم الجواز", cell(p.passportNumber)],
    ["انتهاء الجواز", cell(p.passportExpiryDate)],
    ["الجنسية", cell(p.nationality)],
    ["رقم أبشر", cell(p.absherNumber)],
    ["المؤهل", cell(p.qualification)],
    ["انتهاء الرخصة", cell(p.licenseExpiryDate)],
  ];

  const job = [
    ["المسمى الوظيفي", cell(payload.roleLabel)],
    ["الرقم الوظيفي", cell(payload.employeeNumber)],
    ["المشروع الحالي", cell(p.projectName)],
    ["المدينة", cell(p.city || u.city)],
    ["المنطقة", cell(payload.regionName)],
    ["البريد", cell(u.email)],
  ];

  const car = [
    ["رقم اللوحة", cell(p.carPlateNumber)],
    ["نوع السيارة", cell(p.carType)],
    ["الموديل", cell(p.carModel)],
    ["سنة الصنع", cell(p.carYear)],
  ];

  const phone = [
    ["نوع الجوال", cell(p.phoneType)],
    ["السيريال / IMEI", cell(p.phoneSerial)],
    ["رقم العمل", cell(p.businessPhoneNumber)],
    ["نوع الشريحة", cell(p.simType)],
  ];

  const docsHtml =
    imageDocs.length > 0
      ? imageDocs
          .map(
            (doc) => `
        <div style="border:1px solid rgba(24,178,176,0.28);border-radius:14px;overflow:hidden;background:#fff;break-inside:avoid;font-family:${IDENTITY_FONT};">
          <div style="padding:8px 10px;background:rgba(24,178,176,0.08);font-size:11px;font-weight:800;color:#0f6e70;font-family:${IDENTITY_FONT};">
            ${escapeHtml(doc.label)}
          </div>
          <div style="display:flex;align-items:center;justify-content:center;height:220px;padding:10px;background:#F3F4F6;">
            <img src="${doc.file.dataUrl}" alt="${escapeHtml(doc.label)}" style="display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;" />
          </div>
          <div style="padding:8px 10px;font-size:10px;color:#6B7280;font-family:${IDENTITY_FONT};">${escapeHtml(doc.file.name || "")}</div>
        </div>
      `,
          )
          .join("")
      : `<div style="grid-column:1/-1;padding:18px;border:1px dashed rgba(24,178,176,0.35);border-radius:14px;color:#6B7280;text-align:center;font-size:12px;font-family:${IDENTITY_FONT};">لا توجد صور مرفوعة للوثائق</div>`;

  const container = document.createElement("div");
  container.setAttribute("dir", "rtl");
  container.className = "rassco-identity-surface";
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:820px;background:#F8FAFB;color:#2D3135;font-family:${IDENTITY_FONT};`;
  container.innerHTML = `
    <div style="background:#fff;border:1px solid #E6E8EC;border-radius:22px;overflow:hidden;font-family:${IDENTITY_FONT};">
      <div style="background:linear-gradient(135deg,#18B2B0 0%,#0f8f8d 55%,#F4B740 140%);padding:18px 22px 20px;color:#fff;font-family:${IDENTITY_FONT};">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:center;">
          <div style="min-width:0;font-family:${IDENTITY_FONT};">
            <div style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;margin-bottom:12px;">
              <img src="${logoIconDataUrl}" alt="RASSCO" style="height:48px;width:48px;object-fit:contain;display:block;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.22));" />
              <span style="font-size:16px;font-weight:900;letter-spacing:0.08em;color:#ffffff;font-family:${IDENTITY_FONT};text-shadow:0 2px 8px rgba(0,0,0,0.25);line-height:1;">RASSCO</span>
            </div>
            <div style="font-size:11px;letter-spacing:0.06em;opacity:0.95;font-weight:700;font-family:${IDENTITY_FONT};">RASSCO · EMPLOYEE FORM</div>
            <div style="font-size:24px;font-weight:900;margin-top:4px;font-family:${IDENTITY_FONT};">استمارة الملف الشخصي للموظف</div>
            <div style="font-size:13px;margin-top:6px;opacity:0.97;font-weight:700;font-family:${IDENTITY_FONT};">${escapeHtml(u.fullName)} — ${escapeHtml(payload.employeeNumber)}</div>
          </div>
          <div style="width:92px;height:92px;border-radius:18px;overflow:hidden;border:3px solid rgba(255,255,255,0.55);background:rgba(255,255,255,0.18);flex-shrink:0;">
            ${
              u.profileImage
                ? `<img src="${u.profileImage}" alt="profile" style="width:100%;height:100%;object-fit:cover;" />`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;font-family:${IDENTITY_FONT};">${escapeHtml((u.fullName || "?").slice(0, 1))}</div>`
            }
          </div>
        </div>
      </div>

      <div style="padding:20px 22px 10px;font-family:${IDENTITY_FONT};">
        <div style="font-size:13px;font-weight:900;color:#18B2B0;margin:0 0 10px;font-family:${IDENTITY_FONT};">المعلومات الشخصية</div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:18px;">
          ${personal.map(([l, v]) => fieldCell(l, v)).join("")}
        </div>

        <div style="font-size:13px;font-weight:900;color:#18B2B0;margin:0 0 10px;font-family:${IDENTITY_FONT};">المعلومات الوظيفية</div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:18px;">
          ${job.map(([l, v]) => fieldCell(l, v)).join("")}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">
          <div>
            <div style="font-size:13px;font-weight:900;color:#18B2B0;margin:0 0 10px;font-family:${IDENTITY_FONT};">عهدة السيارة</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              ${car.map(([l, v]) => fieldCell(l, v)).join("")}
            </div>
          </div>
          <div>
            <div style="font-size:13px;font-weight:900;color:#18B2B0;margin:0 0 10px;font-family:${IDENTITY_FONT};">عهدة الجوال</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              ${phone.map(([l, v]) => fieldCell(l, v)).join("")}
            </div>
          </div>
        </div>

        <div style="font-size:13px;font-weight:900;color:#18B2B0;margin:0 0 10px;font-family:${IDENTITY_FONT};">وثائق العمل والصور</div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:8px;">
          ${docsHtml}
        </div>
      </div>

      <div style="padding:14px 22px 18px;border-top:1px solid #E6E8EC;background:#F8FAFB;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:10px;color:#6B7280;font-family:${IDENTITY_FONT};">
        <span style="display:inline-flex;align-items:center;gap:10px;">
          <span style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;">
            <img src="${logoMarkDataUrl}" alt="" style="height:22px;width:22px;object-fit:contain;" />
            <span style="font-size:9px;font-weight:800;letter-spacing:0.06em;color:#18B2B0;">RASSCO</span>
          </span>
          <span>Stock · استمارة موظف رسمية</span>
        </span>
        <span>تاريخ التصدير: ${new Date().toLocaleString("ar-SA")}</span>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    // Give the browser a paint frame so Noto Kufi applies before capture.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await ensureIdentityFontsReady();

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#F8FAFB",
      logging: false,
      onclone: (clonedDoc) => {
        const clonedRoot = clonedDoc.body.querySelector(".rassco-identity-surface") as HTMLElement | null;
        if (clonedRoot) {
          clonedRoot.style.fontFamily = IDENTITY_FONT;
          clonedRoot.querySelectorAll<HTMLElement>("*").forEach((el) => {
            el.style.fontFamily = IDENTITY_FONT;
          });
        }
      },
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 6;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    doc.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 8) {
      position = margin - (imgHeight - heightLeft);
      doc.addPage();
      doc.addImage(imgData, "JPEG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    doc.save(`RASSCO-employee-${safeFileName(u.fullName || u.id)}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
