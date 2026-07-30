/**
 * AuditLogFormatter
 * Formats courier audit log records into rich, secure Arabic DTOs.
 */

export interface AuditLogDto {
  id: number;
  tableName: string;
  recordId: number;
  action: string;
  actionType: string;
  actionDescription: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  source: string;
  sourceLabel: string;
  status: string;
  statusLabel: string;
  metadata: any | null;
  changedAt: string; // ISO UTC string
  ipAddress: string | null;
  deviceId: string | null;
  actor: {
    id: string | null;
    name: string;
    role: string;
    avatarUrl: string | null;
    employeeCode: string | null;
    isHistoricalFallback: boolean;
    isAutomatedSystem: boolean;
  };
}

export class AuditLogFormatter {
  public static mapSourceLabel(source: string | null | undefined): string {
    switch (String(source || "").toUpperCase()) {
      case "FIELD_APP":
        return "تطبيق الفني";
      case "AUTOMATED_SYSTEM":
        return "النظام الآلي";
      case "API":
        return "واجهة API";
      case "IMPORT":
        return "استيراد ملفات";
      case "DASHBOARD":
      default:
        return "لوحة التحكم";
    }
  }

  public static mapStatusLabel(status: string | null | undefined): string {
    switch (String(status || "").toUpperCase()) {
      case "FAILED":
        return "فاشلة";
      case "PENDING":
        return "معلقة";
      case "SUCCESS":
      default:
        return "ناجحة";
    }
  }

  public static buildActionDescription(
    actorName: string,
    action: string,
    fieldName?: string | null,
    oldValue?: string | null,
    newValue?: string | null,
    metadata?: any
  ): string {
    const cleanAction = String(action || "").toLowerCase();
    const cleanField = String(fieldName || "").toLowerCase();

    if (cleanAction === "create") {
      return `قام ${actorName} بإنشاء وإضافة طلب التركيب في النظام.`;
    }

    if (cleanAction === "delete") {
      return `قام ${actorName} بحذف طلب التركيب.`;
    }

    if (cleanAction === "assign" || cleanField.includes("technician") || cleanField.includes("sales_technician")) {
      return `قام ${actorName} بربط وتعيين الفني المسؤول: ${newValue || "—"}.`;
    }

    if (cleanAction.includes("confirm_receiving")) {
      return `قام ${actorName} بتأكيد استلام أجهزة ومستلزمات الطلب الميداني.`;
    }

    if (cleanAction === "start_task") {
      return `قام ${actorName} ببدء مهمة التوجه والتركيب الميداني.`;
    }

    if (cleanField === "installation_status" || cleanField === "status" || cleanAction === "status_change") {
      const fromVal = oldValue || "جديد (بانتظار التحقق)";
      const toVal = newValue || "—";
      return `قام ${actorName} بتغيير حالة الطلب من "${fromVal}" إلى "${toVal}".`;
    }

    if (metadata?.changedFieldsCount && metadata.changedFieldsCount > 1) {
      return `قام ${actorName} بتحديث ${metadata.changedFieldsCount} حقول في بيانات الطلب.`;
    }

    if (fieldName) {
      return `قام ${actorName} بتعديل حقل (${fieldName}) من "${oldValue || "—"}" إلى "${newValue || "—"}".`;
    }

    return `قام ${actorName} بتحديث بيانات الطلب المعاملة.`;
  }

  public static cleanPersonName(rawName: string | null | undefined): { name: string; role?: string } {
    if (!rawName) return { name: "مستخدم النظام" };
    let s = rawName.trim();
    if (s.includes(" - ")) {
      const parts = s.split(" - ");
      const rolePart = parts[0].trim();
      const namePart = parts.slice(1).join(" - ").trim();
      if (namePart) {
        let arabicRole = rolePart;
        if (rolePart.toLowerCase().includes("operations supervisor")) arabicRole = "مشرف العمليات";
        else if (rolePart.toLowerCase().includes("technician")) arabicRole = "فني ميداني ومبيعات";
        return { name: namePart, role: arabicRole };
      }
    }
    return { name: s };
  }

  public static format(row: any, options: { allowSensitive?: boolean } = {}): AuditLogDto {
    const isAutomated = row.source === "AUTOMATED_SYSTEM" || row.changedBy === "SYSTEM";

    const rawActorName =
      row.actorNameSnapshot ||
      row.userFullName ||
      (isAutomated ? "النظام الآلي" : "مستخدم النظام");

    const parsedActor = AuditLogFormatter.cleanPersonName(rawActorName);
    const actorName = parsedActor.name;

    const actorRole =
      parsedActor.role ||
      row.actorRoleSnapshot ||
      row.empProfileData?.jobTitle ||
      row.userRole ||
      (isAutomated ? "خدمة آليّة" : "مشرف العمليات");

    const actorAvatar = row.actorAvatarUrl || row.userProfileImage || null;
    const employeeCode = row.employeeCode || row.empProfileData?.employeeNumber || null;
    const isHistoricalFallback = !row.actorNameSnapshot && !!row.changedBy;

    const description =
      row.actionDescription ||
      AuditLogFormatter.buildActionDescription(
        actorName,
        row.action,
        row.fieldName,
        row.oldValue,
        row.newValue,
        row.metadata
      );

    return {
      id: Number(row.id),
      tableName: String(row.tableName || "requests"),
      recordId: Number(row.recordId),
      action: String(row.action || "update"),
      actionType: String(row.actionType || "UPDATE").toUpperCase(),
      actionDescription: description,
      fieldName: row.fieldName ? String(row.fieldName) : null,
      oldValue: row.oldValue !== null && row.oldValue !== undefined ? String(row.oldValue) : null,
      newValue: row.newValue !== null && row.newValue !== undefined ? String(row.newValue) : null,
      source: String(row.source || "DASHBOARD").toUpperCase(),
      sourceLabel: AuditLogFormatter.mapSourceLabel(row.source),
      status: String(row.status || "SUCCESS").toUpperCase(),
      statusLabel: AuditLogFormatter.mapStatusLabel(row.status),
      metadata: row.metadata || null,
      changedAt: row.changedAt ? new Date(row.changedAt).toISOString() : new Date().toISOString(),
      ipAddress: options.allowSensitive ? row.ipAddress || null : null,
      deviceId: options.allowSensitive ? row.deviceId || null : null,
      actor: {
        id: row.changedBy ? String(row.changedBy) : null,
        name: actorName,
        role: actorRole,
        avatarUrl: actorAvatar,
        employeeCode: employeeCode ? String(employeeCode) : null,
        isHistoricalFallback,
        isAutomatedSystem: isAutomated,
      },
    };
  }
}
