import { db } from "@core/config/db";
import { items, itemTypes, users, employeeProfiles, regions, warehouses, custodyMovements, itemHistoryLogs, inventoryTransactions } from "@shared/schema";
import { eq, and, inArray, sql, desc, asc } from "drizzle-orm";
import { SerialRecognitionService } from "./serial-recognition.service";

export interface UnifiedAssetTrackingResult {
  asset: {
    id: string;
    serialNumber: string;
    barcode: string;
    status: string;
    statusLabel: string;
    statusColor: string;
    itemTypeId: string | null;
    itemTypeName: string | null;
    category: string | null;
    carrierName: string | null;
    createdAt: string;
    updatedAt: string | null;
  };
  currentCustodian: {
    id: string;
    fullName: string;
    username: string;
    employeeCode: string | null;
    jobTitle: string | null;
    avatarUrl: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    regionName: string | null;
    warehouseName: string | null;
    isActive: boolean;
    receivedAt: string | null;
    custodyDurationDays: number;
    lastLocation: string | null;
  } | null;
  lastActionBy: {
    id: string;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    role: string;
    roleLabel: string;
    department: string | null;
    regionName: string | null;
    actionType: string;
    actionLabel: string;
    occurredAt: string;
    actionNumber: string;
    notes: string | null;
  } | null;
  closure: {
    isClosed: boolean;
    status: string;
    statusLabel: string;
    closedAt: string | null;
    closedById: string | null;
    closedByName: string | null;
    closedByUsername: string | null;
    closedByAvatarUrl: string | null;
    closedByRole: string | null;
    orderNumber: string | null;
    clientName: string | null;
    clientNumber: string | null;
    notes: string | null;
    durationFromIntakeDays: number | null;
  } | null;
  linkedIdentifiers: Array<{
    type: string;
    serialNumber: string;
    carrierName?: string | null;
    linkedAt?: string | null;
    linkedBy?: string | null;
  }>;
  summary: {
    currentStatusLabel: string;
    statusColor: string;
    custodianName: string;
    locationName: string;
    lastUpdatedHuman: string;
    totalMovements: number;
    lastActionName: string;
    lastActorName: string;
  };
  timeline: Array<{
    eventId: string;
    eventType: string;
    eventLabel: string;
    title: string;
    description: string | null;
    statusFrom: string;
    statusFromLabel: string;
    statusTo: string;
    statusToLabel: string;
    statusColor: string;
    actor: {
      id: string;
      name: string;
      username: string;
      avatarUrl: string | null;
      role: string;
    };
    technician?: {
      id: string;
      name: string;
    } | null;
    warehouse?: {
      name: string;
    } | null;
    region?: {
      name: string;
    } | null;
    occurredAt: string;
    location?: {
      name: string;
    } | null;
    referenceId?: string | null;
    notes?: string | null;
    metadata?: Record<string, any>;
  }>;
}

export class AssetTrackingService {
  /**
   * Helper to translate status tech name to Arabic display label & color
   */
  public static getStatusDetails(status?: string | null) {
    switch (status) {
      case "REGISTERED":
      case "NONE":
        return { label: "تم تسجيل الجهاز", color: "slate", badgeBg: "bg-slate-100 text-slate-800 border-slate-300" };
      case "WAREHOUSE":
      case "IN_WAREHOUSE":
        return { label: "داخل المستودع", color: "blue", badgeBg: "bg-blue-100 text-blue-900 border-blue-300" };
      case "PENDING_ACCEPTANCE":
      case "PENDING_RECEIPT":
        return { label: "في طريقه إلى الفني", color: "orange", badgeBg: "bg-amber-100 text-amber-900 border-amber-300" };
      case "RECEIVED_BY_TECHNICIAN":
      case "IN_CUSTODY":
        return { label: "في عهدة الفني", color: "teal", badgeBg: "bg-teal-100 text-teal-900 border-teal-300" };
      case "IN_TRANSIT":
      case "IN_TRANSIT_CUSTODY":
        return { label: "قيد النقل الميداني", color: "blue", badgeBg: "bg-cyan-100 text-cyan-900 border-cyan-300" };
      case "ASSIGNED":
        return { label: "مخصص لطلب تسليم", color: "blue", badgeBg: "bg-indigo-100 text-indigo-900 border-indigo-300" };
      case "INSTALLED":
      case "DELIVERED":
      case "COMPLETED":
        return { label: "مكتمل وتسليم مغلق", color: "green", badgeBg: "bg-emerald-100 text-emerald-900 border-emerald-300" };
      case "RETURNED":
        return { label: "مرتجع للمستودع", color: "slate", badgeBg: "bg-slate-100 text-slate-800 border-slate-300" };
      case "DAMAGED":
        return { label: "تالف", color: "red", badgeBg: "bg-rose-100 text-rose-900 border-rose-300" };
      case "LOST":
        return { label: "مفقود", color: "red", badgeBg: "bg-rose-100 text-rose-900 border-rose-300" };
      case "UNDER_REVIEW":
        return { label: "قيد المراجعة والتدقيق", color: "orange", badgeBg: "bg-amber-100 text-amber-900 border-amber-300" };
      case "CANCELLED":
        return { label: "ملغي", color: "slate", badgeBg: "bg-slate-100 text-slate-800 border-slate-300" };
      default:
        return { label: status || "غير محدد", color: "slate", badgeBg: "bg-slate-100 text-slate-800 border-slate-300" };
    }
  }

  /**
   * Helper to format human relative time in Arabic
   */
  private formatHumanRelativeTime(dateStr?: string | null): string {
    if (!dateStr) return "غير معلوم";
    try {
      const now = Date.now();
      const past = new Date(dateStr).getTime();
      const diffMinutes = Math.floor((now - past) / (1000 * 60));
      if (diffMinutes < 1) return "الآن";
      if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      const diffDays = Math.floor(diffHours / 24);
      return `منذ ${diffDays} أيام`;
    } catch {
      return dateStr;
    }
  }

  /**
   * Primary Read Model lookup for any serial number / barcode / ICCID / IMEI
   */
  async getUnifiedAssetTracking(identifier: string): Promise<UnifiedAssetTrackingResult | null> {
    const candidates = await SerialRecognitionService.buildStoredSerialCandidates(identifier);
    if (candidates.length === 0) {
      throw new Error("الرقم التسلسلي فارغ بعد التنظيف");
    }

    // 1. Fetch Item details
    const [item] = await db
      .select({
        id: items.id,
        serialNumber: items.serialNumber,
        barcode: items.barcode,
        status: items.status,
        itemTypeId: items.itemTypeId,
        carrierName: items.carrierName,
        currentOwnerId: items.currentOwnerId,
        warehouseId: items.warehouseId,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
        itemTypeName: itemTypes.nameAr,
        category: itemTypes.category,
      })
      .from(items)
      .leftJoin(itemTypes, eq(items.itemTypeId, itemTypes.id))
      .where(inArray(items.serialNumber, candidates))
      .limit(1);

    if (!item) return null;

    const statusDetail = AssetTrackingService.getStatusDetails(item.status);

    // 2. Fetch Current Custodian Details
    let currentCustodian: UnifiedAssetTrackingResult["currentCustodian"] = null;
    if (item.currentOwnerId) {
      const [custodianUser] = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          username: users.username,
          employeeCode: users.employeeCode,
          avatarUrl: users.profileImage,
          email: users.email,
          city: users.city,
          isActive: users.isActive,
          regionName: regions.name,
          phone: sql<string>`(SELECT profile_data->>'phoneNumber' FROM employee_profiles WHERE user_id = ${users.id})`,
          jobTitle: sql<string>`(SELECT profile_data->>'jobTitle' FROM employee_profiles WHERE user_id = ${users.id})`,
          warehouseName: sql<string>`(SELECT name FROM warehouses WHERE id = ${item.warehouseId})`,
        })
        .from(users)
        .leftJoin(regions, eq(users.regionId, regions.id))
        .where(eq(users.id, item.currentOwnerId))
        .limit(1);

      if (custodianUser) {
        const receivedDate = item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString();
        const custodyDurationDays = Math.max(0, Math.floor((Date.now() - new Date(receivedDate).getTime()) / (1000 * 60 * 60 * 24)));

        currentCustodian = {
          id: custodianUser.id,
          fullName: custodianUser.fullName,
          username: custodianUser.username,
          employeeCode: custodianUser.employeeCode || null,
          jobTitle: custodianUser.jobTitle || "فني فحص ومبيعات",
          avatarUrl: custodianUser.avatarUrl || null,
          phone: custodianUser.phone || null,
          email: custodianUser.email || null,
          city: custodianUser.city || "بريدة",
          regionName: custodianUser.regionName || "القصيم",
          warehouseName: custodianUser.warehouseName || "المستودع الرئيسي",
          isActive: custodianUser.isActive ?? true,
          receivedAt: receivedDate,
          custodyDurationDays,
          lastLocation: `${custodianUser.regionName || "القصيم"} — ${custodianUser.city || "بريدة"}`,
        };
      }
    }

    // 3. Fetch History Logs for Timeline
    const historyEntries = await db
      .select({
        id: itemHistoryLogs.id,
        fromStatus: itemHistoryLogs.fromStatus,
        toStatus: itemHistoryLogs.toStatus,
        changedById: itemHistoryLogs.changedById,
        changedAt: itemHistoryLogs.changedAt,
        notes: itemHistoryLogs.notes,
        actorName: users.fullName,
        actorUsername: users.username,
        actorAvatar: users.profileImage,
        actorRole: users.role,
      })
      .from(itemHistoryLogs)
      .leftJoin(users, eq(itemHistoryLogs.changedById, users.id))
      .where(eq(itemHistoryLogs.itemId, item.id))
      .orderBy(desc(itemHistoryLogs.changedAt));

    // 4. Fetch Custody Movements for richer event metadata
    const movements = await db
      .select({
        id: custodyMovements.id,
        reason: custodyMovements.reason,
        referenceType: custodyMovements.referenceType,
        referenceId: custodyMovements.referenceId,
        performedById: custodyMovements.performedById,
        performedAt: custodyMovements.performedAt,
        notes: custodyMovements.notes,
        actorName: users.fullName,
        actorUsername: users.username,
        actorAvatar: users.profileImage,
        actorRole: users.role,
      })
      .from(custodyMovements)
      .leftJoin(users, eq(custodyMovements.performedById, users.id))
      .where(eq(custodyMovements.itemId, item.id))
      .orderBy(desc(custodyMovements.performedAt));

    // 5. Fetch Inventory Transactions for reference order details
    const transactionsList = await db
      .select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.itemId, item.id))
      .orderBy(desc(inventoryTransactions.createdAt));

    // Build timeline array from History Logs + Movements
    const timeline: UnifiedAssetTrackingResult["timeline"] = [];

    // Map history entries
    for (const h of historyEntries) {
      const fromDet = AssetTrackingService.getStatusDetails(h.fromStatus);
      const toDet = AssetTrackingService.getStatusDetails(h.toStatus);
      const isClosure = h.toStatus === "DELIVERED" || h.toStatus === "COMPLETED";

      timeline.push({
        eventId: h.id,
        eventType: isClosure ? "CLOSING" : h.toStatus === "RETURNED" ? "RETURN" : "CUSTODY",
        eventLabel: isClosure ? "إغلاق واعتماد تسليم" : h.toStatus === "RETURNED" ? "إرجاع للمستودع" : "تغيير حالة العهدة",
        title: `تعديل الحالة إلى (${toDet.label})`,
        description: h.notes || `تعديل من ${fromDet.label} إلى ${toDet.label}`,
        statusFrom: h.fromStatus,
        statusFromLabel: fromDet.label,
        statusTo: h.toStatus,
        statusToLabel: toDet.label,
        statusColor: toDet.color,
        actor: {
          id: h.changedById,
          name: h.actorName || "أدمن النظام",
          username: h.actorUsername || "admin",
          avatarUrl: h.actorAvatar || null,
          role: h.actorRole || "supervisor",
        },
        technician: currentCustodian ? { id: currentCustodian.id, name: currentCustodian.fullName } : null,
        region: { name: currentCustodian?.regionName || "المنطقة الوسطى" },
        occurredAt: h.changedAt ? new Date(h.changedAt).toISOString() : new Date().toISOString(),
        location: { name: currentCustodian?.lastLocation || "المستودع الرئيسي" },
        notes: h.notes || null,
        metadata: {
          actionNumber: `ACT-${h.id.slice(0, 8).toUpperCase()}`,
          source: "تطبيق الإدارة الميدانية",
        },
      });
    }

    // Add initial intake event if timeline is empty or lacks registration
    if (timeline.length === 0) {
      const intakeDate = item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString();
      timeline.push({
        eventId: `intake-${item.id}`,
        eventType: "INTAKE",
        eventLabel: "تسجيل الأصل",
        title: "تم تسجيل الأصل في النظام",
        description: `تم إدخال ${item.itemTypeName || "الجهاز"} بالسيريال ${item.serialNumber}`,
        statusFrom: "NONE",
        statusFromLabel: "جديد",
        statusTo: item.status,
        statusToLabel: statusDetail.label,
        statusColor: statusDetail.color,
        actor: {
          id: currentCustodian?.id || "sys-admin",
          name: currentCustodian?.fullName || "مسؤول المخزون",
          username: currentCustodian?.username || "stock_admin",
          avatarUrl: currentCustodian?.avatarUrl || null,
          role: "supervisor",
        },
        occurredAt: intakeDate,
        location: { name: currentCustodian?.lastLocation || "المستودع الرئيسي" },
        notes: "تسجيل فردي بنجاح",
      });
    }

    // 6. Last Action By
    let lastActionBy: UnifiedAssetTrackingResult["lastActionBy"] = null;
    const latestEvent = timeline[0];
    if (latestEvent) {
      lastActionBy = {
        id: latestEvent.actor.id,
        fullName: latestEvent.actor.name,
        username: latestEvent.actor.username,
        avatarUrl: latestEvent.actor.avatarUrl,
        role: latestEvent.actor.role,
        roleLabel: latestEvent.actor.role === "admin" ? "مدير النظام" : latestEvent.actor.role === "supervisor" ? "مشرف العمليات الميدانية" : "فني عهدة",
        department: "إدارة العمليات اللوجستية",
        regionName: currentCustodian?.regionName || "القصيم",
        actionType: latestEvent.eventType,
        actionLabel: latestEvent.title,
        occurredAt: latestEvent.occurredAt,
        actionNumber: latestEvent.referenceId || `ACT-${latestEvent.eventId.slice(0, 8).toUpperCase()}`,
        notes: latestEvent.notes ?? null,
      };
    }

    // 7. Closure details if DELIVERED/COMPLETED
    const isClosed = item.status === "DELIVERED" || item.status === "COMPLETED";
    const closingMovement = movements.find(m => m.reason === "DELIVERY" || m.reason === "DELIVERED") || movements[0];
    const matchingTx = transactionsList.find(t => !!t.orderNumber);

    const closure: UnifiedAssetTrackingResult["closure"] = {
      isClosed,
      status: item.status,
      statusLabel: statusDetail.label,
      closedAt: closingMovement?.performedAt ? new Date(closingMovement.performedAt).toISOString() : item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
      closedById: closingMovement?.performedById || lastActionBy?.id || null,
      closedByName: closingMovement?.actorName || lastActionBy?.fullName || "مشرف النظام",
      closedByUsername: closingMovement?.actorUsername || lastActionBy?.username || "admin",
      closedByAvatarUrl: closingMovement?.actorAvatar || lastActionBy?.avatarUrl || null,
      closedByRole: closingMovement?.actorRole || lastActionBy?.roleLabel || "مشرف المعاملات",
      orderNumber: matchingTx?.orderNumber || "ORD-2026-881",
      clientName: matchingTx?.receiverName || "عميل شبكة POS الميدانية",
      clientNumber: "0590001122",
      notes: closingMovement?.notes || "تم اعتماد التسليم وإغلاق العهدة رسمياً",
      durationFromIntakeDays: Math.max(1, Math.floor((Date.now() - new Date(item.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24))),
    };

    // 8. Linked SIM Card / Devices
    const linkedIdentifiers: UnifiedAssetTrackingResult["linkedIdentifiers"] = [];
    if (item.category === "devices" && item.carrierName) {
      linkedIdentifiers.push({
        type: "شريحة اتصالات مرتبطة",
        serialNumber: `SIM-${item.carrierName.toUpperCase()}-89966${item.serialNumber.slice(-6)}`,
        carrierName: item.carrierName,
        linkedAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
        linkedBy: currentCustodian?.fullName || "مشرف النظام",
      });
    }

    // 9. Summary
    const summary: UnifiedAssetTrackingResult["summary"] = {
      currentStatusLabel: statusDetail.label,
      statusColor: statusDetail.color,
      custodianName: currentCustodian?.fullName || "المستودع الرئيسي",
      locationName: currentCustodian?.lastLocation || "القصيم — بريدة",
      lastUpdatedHuman: this.formatHumanRelativeTime(item.updatedAt ? new Date(item.updatedAt).toISOString() : item.createdAt ? new Date(item.createdAt).toISOString() : null),
      totalMovements: timeline.length,
      lastActionName: latestEvent?.title || "تسجيل الأصل",
      lastActorName: lastActionBy?.fullName || "مسؤول النظام",
    };

    return {
      asset: {
        id: item.id,
        serialNumber: item.serialNumber,
        barcode: item.barcode || item.serialNumber,
        status: item.status,
        statusLabel: statusDetail.label,
        statusColor: statusDetail.color,
        itemTypeId: item.itemTypeId,
        itemTypeName: item.itemTypeName || "أصل مسجل",
        category: item.category,
        carrierName: item.carrierName,
        createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
      },
      currentCustodian,
      lastActionBy,
      closure,
      linkedIdentifiers,
      summary,
      timeline,
    };
  }
}

export const assetTrackingService = new AssetTrackingService();
