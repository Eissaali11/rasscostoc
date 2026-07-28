import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { SystemLog } from "@shared/schema";

export function exportSingleLogToPDF(log: SystemLog) {
  const dateStr = log.createdAt 
    ? format(new Date(log.createdAt), "yyyy/MM/dd - HH:mm:ss", { locale: ar })
    : new Date().toLocaleString("ar-SA");

  let parsedDetails: Record<string, any> = {};
  try {
    if (log.details) {
      parsedDetails = typeof log.details === "string" ? JSON.parse(log.details) : log.details;
    }
  } catch (e) {
    parsedDetails = { raw: log.details };
  }

  // Translation Mappers
  const actionLabels: Record<string, string> = {
    PLATFORM_LOCK_ENABLE: "🔒 تفعيل قفل المنصة المركزية",
    PLATFORM_LOCK_DISABLE: "🔓 إلغاء قفل المنصة المركزية",
    delete: "🗑️ عملية حذف نهائي للمنتج / الجهاز (DELETE)",
    DELETE: "🗑️ عملية حذف نهائي للمنتج / الجهاز (DELETE)",
    search: "🔍 استعلام وبحث أصول (SEARCH)",
    SEARCH: "🔍 استعلام وبحث أصول (SEARCH)",
    update: "✏️ تحديث وتعديل بيانات (UPDATE)",
    UPDATE: "✏️ تحديث وتعديل بيانات (UPDATE)",
    create: "➕ إنشاء وإضافة منتج/شريحة (CREATE)",
    CREATE: "➕ إنشاء وإضافة منتج/شريحة (CREATE)",
    approve: "✅ اعتماد وموافقة (APPROVE)",
    reject: "❌ رفض إجراء (REJECT)",
    transfer: "🚚 نقل عهدة ومناقلة (TRANSFER)",
    login: "🔐 تسجيل دخول (LOGIN)",
    logout: "🚪 تسجيل خروج (LOGOUT)",
  };

  const entityTypeLabels: Record<string, string> = {
    platform_lock: "قفل المنصة المركزية",
    platform_lock_state: "حالة قفل المنصة والوصول",
    item: "أصل / جهاز تسليم (POS)",
    serialized_item: "شريحة / جهاز مسلسـل (Serialized Item)",
    search_query: "استعلام وسجل بحث (Search Query)",
    user: "حساب مستخدم / فني ميداني",
    region: "منطقة جغرافية وموقع",
    warehouse: "مستودع رئيسي / فرعي",
    inventory: "حركة مخزون وعهدة",
    courier_request: "طلب توصيل وإسناد مندوب",
  };

  const userRoleLabels: Record<string, string> = {
    PLATFORM_OWNER: "مالك المنصة والمدير العام (Platform Owner)",
    admin: "مدير النظام (Admin)",
    ADMIN: "مدير النظام (Admin)",
    supervisor: "مشرف أقاليم ومستودعات (Supervisor)",
    SUPERVISOR: "مشرف أقاليم ومستودعات (Supervisor)",
    technician: "فني ميداني (Field Technician)",
    TECHNICIAN: "فني ميداني (Field Technician)",
    warehouse_manager: "أمـين مستودع",
    WAREHOUSE_MANAGER: "أمـين مستودع",
  };

  const userNameLabels: Record<string, string> = {
    "owner-portal": "بوابة المالك والتحكم (Owner Portal)",
    "system": "نظام الرقابة الآلي والتدقيق",
    "admin": "المدير العام للنظام",
  };

  const systemModuleLocation: Record<string, string> = {
    platform_lock: "إدارة النظام والتحكم ➔ قسم أمان المنصة ➔ القفل المركزي",
    item: "مخزون المستودعات ➔ الأصول والأجهزة المسلسلة ➔ تفاصيل المنتج",
    serialized_item: "مخزون الفنيين والمستودعات ➔ الشرائح والأجهزة المسلسلة",
    search_query: "بوابة التحقق والاستعلام ➔ سجل الاستعلام الفوري",
    user: "إدارة الكادر والموظفين ➔ ملفات الفنيين والمسؤولين",
    warehouse: "إدارة المستودعات المركزية ➔ تفاصيل الجرد والمخزون",
    inventory: "حركات المخزون ➔ المناقلات والعهد الميدانية",
  };

  const formatDesc = (desc?: string) => {
    if (!desc) return "إجراء تنفيذي موثق بالنظام";
    if (desc.includes("PLATFORM_LOCK_DISABLE")) {
      return "تم إلغاء قفل المنصة المركزية بقرار إداري واستعادة كافة الصلاحيات واللوحات التشغيلية";
    }
    if (desc.includes("PLATFORM_LOCK_ENABLE")) {
      return "تم تفعيل قفل المنصة المركزية بقرار إداري وتقييد العمليات الحساسة لحين المراجعة";
    }
    return desc;
  };

  const fieldKeyArabicMap: Record<string, string> = {
    serialNumber: "الرقم التسلسلي (Serial / IMEI)",
    serial: "الرقم التسلسلي (Serial)",
    productName: "اسم المنتج / الجهاز",
    itemName: "اسم العنصر",
    warehouseName: "اسم المستودع",
    technicianName: "اسم الفني المسؤول",
    status: "حالة العنصر الحالية",
    previousStatus: "الحالة السابقة قبل التعديل",
    newStatus: "الحالة الجديدة بعد التعديل",
    reason: "سبب الإجراء / التعديل",
    deletedBy: "منفذ عملية الحذف",
    ip: "عنوان الشبكة (IP Address)",
    userAgent: "متصفح وجهاز المنفذ",
    searchQuery: "نص الاستعلام / الرقم المبحوث",
    resultFound: "نتيجة البحث والاستعلام",
    simNumber: "رقم الشريحة (SIM)",
    deviceModel: "موديل الجهاز",
  };

  const actionLabel = actionLabels[log.action] || log.action;
  const entityTypeLabel = entityTypeLabels[log.entityType] || log.entityType;
  const userRoleLabel = userRoleLabels[log.userRole] || log.userRole;
  const userNameLabel = userNameLabels[log.userName] || log.userName;
  const locationPath = systemModuleLocation[log.entityType] || "بوابة الإدارة المركزية ➔ سجلات التدقيق والمراقبة";

  // Build Arabic key-value rows from details
  const extractedRows: { label: string; value: string }[] = [];
  Object.keys(parsedDetails).forEach((key) => {
    const value = parsedDetails[key];
    const label = fieldKeyArabicMap[key] || key;
    if (typeof value === "object" && value !== null) {
      extractedRows.push({ label, value: JSON.stringify(value) });
    } else if (value !== undefined && value !== null) {
      extractedRows.push({ label, value: String(value) });
    }
  });

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <title>تقرير عملية نظام مفصل - ${log.id || 'AUDIT'}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        body {
          font-family: 'Cairo', sans-serif;
          background-color: #f1f5f9;
          color: #0f172a;
          margin: 0;
          padding: 30px;
          direction: rtl;
        }
        .container {
          max-width: 850px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 24px;
          box-shadow: 0 15px 35px rgba(0,0,0,0.08);
          border: 1px solid #cbd5e1;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #0f766e 0%, #0f172a 100%);
          color: #ffffff;
          padding: 36px 32px;
          text-align: center;
          position: relative;
        }
        .header-logo {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -0.5px;
          margin-bottom: 6px;
          color: #ffffff;
        }
        .header p {
          margin: 0;
          font-size: 14px;
          opacity: 0.92;
          font-weight: 600;
        }
        .doc-badge {
          display: inline-block;
          background: rgba(255,255,255,0.22);
          border: 1px solid rgba(255,255,255,0.3);
          padding: 5px 20px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 800;
          margin-top: 14px;
          color: #5eead4;
        }
        .body-content {
          padding: 32px;
        }
        .section-title {
          font-size: 15px;
          font-weight: 900;
          color: #0f766e;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 2px solid #ccfbf1;
          padding-bottom: 8px;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }
        .card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px;
        }
        .field {
          margin-bottom: 10px;
        }
        .field:last-child {
          margin-bottom: 0;
        }
        .field-label {
          font-size: 11px;
          color: #64748b;
          display: block;
          font-weight: 700;
          margin-bottom: 2px;
        }
        .field-value {
          font-size: 13px;
          font-weight: 900;
          color: #0f172a;
          word-break: break-word;
        }
        .badge-status {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 12px;
        }
        .bg-error { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
        .bg-success { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
        
        .location-banner {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 14px;
          padding: 14px 18px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .location-path {
          font-size: 13px;
          font-weight: 800;
          color: #166534;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        .data-table th {
          background: #f1f5f9;
          color: #0f172a;
          font-weight: 900;
          font-size: 12px;
          text-align: right;
          padding: 12px 16px;
          border-bottom: 1px solid #cbd5e1;
        }
        .data-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
          font-weight: 700;
          color: #334155;
        }
        .data-table tr:nth-child(even) {
          background: #f8fafc;
        }

        .details-box {
          background: #0f172a;
          color: #38bdf8;
          font-family: monospace;
          direction: ltr;
          padding: 18px;
          border-radius: 14px;
          font-size: 12px;
          white-space: pre-wrap;
          word-break: break-all;
          overflow-x: auto;
          border: 1px solid #1e293b;
        }
        .footer {
          margin-top: 36px;
          border-top: 2px dashed #cbd5e1;
          padding-top: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #64748b;
        }
        .stamp {
          border: 2px solid #0f766e;
          color: #0f766e;
          padding: 10px 24px;
          border-radius: 12px;
          font-weight: 900;
          transform: rotate(-2deg);
          display: inline-block;
          text-align: center;
          background: #f0fdfa;
        }
        @media print {
          body { background: white; padding: 0; }
          .container { box-shadow: none; border: none; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align: center; margin-bottom: 20px;">
        <button onclick="window.print()" style="background: #0f766e; color: white; border: none; padding: 14px 36px; border-radius: 12px; font-weight: 800; cursor: pointer; font-family: inherit; font-size: 16px; shadow: 0 4px 12px rgba(15,118,110,0.3);">
          🖨️ طباعة أو حفظ التقرير تفصيلياً بصيغة PDF
        </button>
      </div>

      <div class="container">
        <!-- Official Header Banner -->
        <div class="header">
          <div class="header-logo">مؤسسة رافد للخدمات اللوجستية (RASSCO ERP)</div>
          <p>تقرير تدقيق ومراقبة عملية بالنظام التفصيلي — Official System Audit Trail Report</p>
          <div class="doc-badge">رقم القيد الرقابي: ${log.id || 'AUDIT-LOG-REG'}</div>
        </div>

        <div class="body-content">

          {/* Module Location Banner */}
          <div class="location-banner">
            <div>
              <span style="font-size: 11px; font-weight: 700; color: #15803d; block;">📍 موقع ومسار الإجراء داخل النظام:</span>
              <div class="location-path">${locationPath}</div>
            </div>
            <span style="font-size: 11px; font-weight: 800; background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 8px;">
              موثق رقمياً
            </span>
          </div>

          <!-- 3-Column Summary Cards -->
          <div class="grid-3">
            <!-- Responsible Official Card -->
            <div class="card">
              <div class="field">
                <span class="field-label">👤 المسؤول عن الإجراء:</span>
                <span class="field-value">${userNameLabel}</span>
              </div>
              <div class="field">
                <span class="field-label">الدور الوظيفي والصلاحية:</span>
                <span class="field-value">${userRoleLabel}</span>
              </div>
              <div class="field">
                <span class="field-label">معرف حساب المستخدم:</span>
                <span class="field-value">${log.userId || "النظام الآلي"}</span>
              </div>
            </div>

            <!-- Operation Summary Card -->
            <div class="card">
              <div class="field">
                <span class="field-label">📌 نوع العملية والتأثير:</span>
                <span class="field-value">${actionLabel}</span>
              </div>
              <div class="field">
                <span class="field-label">تاريخ ووقت التنفيذ:</span>
                <span class="field-value">${dateStr}</span>
              </div>
              <div class="field">
                <span class="field-label">حالة الاعتماد والتنفيذ:</span>
                <span class="badge-status ${log.success ? 'bg-success' : 'bg-error'}">
                  ${log.success ? '✓ مكتمل بنجاح' : '✕ مرفوض / خطأ'}
                </span>
              </div>
            </div>

            <!-- Target Entity Info Card -->
            <div class="card">
              <div class="field">
                <span class="field-label">🎯 العنصر/المنتج المتأثر:</span>
                <span class="field-value">${log.entityName || "إعدادات أمان المنصة"}</span>
              </div>
              <div class="field">
                <span class="field-label">تصنيف الكيان المتأثر:</span>
                <span class="field-value">${entityTypeLabel}</span>
              </div>
              <div class="field">
                <span class="field-label">معرف السجل (Entity ID):</span>
                <span class="field-value" style="font-family: monospace;">${log.entityId || "N/A"}</span>
              </div>
            </div>
          </div>

          <!-- Description Block -->
          <div class="card" style="margin-bottom: 24px; background: #ffffff; border-right: 4px solid #0f766e;">
            <div class="section-title">📝 الوصف والبيان التفصيلي للإجراء الميداني والإداري</div>
            <p style="font-size: 14px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.7;">
              ${formatDesc(log.description)}
            </p>
          </div>

          <!-- Extracted Key Audit Details Table (if any) -->
          ${extractedRows.length > 0 ? `
            <div class="section-title">🔍 التفاصيل الميدانية المستخرجة من العملية</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 40%;">بيان الحقل / المعيار</th>
                  <th style="width: 60%;">القيمة الموثقة بالنظام</th>
                </tr>
              </thead>
              <tbody>
                ${extractedRows.map(row => `
                  <tr>
                    <td style="font-weight: 800; color: #0f766e;">${row.label}</td>
                    <td style="font-family: font-mono; word-break: break-word;">${row.value}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <!-- System Technical Metadata Box -->
          <div style="margin-bottom: 24px;">
            <div class="section-title">💻 البيانات التقنية وبصمة النظام الكاملة (Full Technical Metadata)</div>
            <div class="details-box">${JSON.stringify(parsedDetails, null, 2)}</div>
          </div>

          <!-- Footer Official Stamp -->
          <div class="footer">
            <div>
              <p style="margin: 0; font-weight: 800; color: #0f172a;">تم استخراج وتوثيق هذا التقرير آلياً من مركز الرقابة المركزي لنظام RASSCO ERP.</p>
              <p style="margin: 4px 0 0 0; font-weight: 600;">التاريخ الرقمي وبصمة الاعتماد: ${new Date().toISOString()}</p>
            </div>
            <div class="stamp">
              اعتماد رقابة النظام الرسمي<br/>
              RASSCO AUDITED & SIGNED
            </div>
          </div>

        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 450);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
