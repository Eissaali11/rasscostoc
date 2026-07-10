export type DeviceStatus = "pending" | "approved" | "rejected";

export type SerialLifecycleCategory =
  | "main-warehouse"
  | "regional-warehouse"
  | "technician-stock"
  | "delivered"
  | "rejected";

export type RawSerialTrackingRecord = {
  id: string;
  terminalId: string;
  serialNumber: string;
  status: DeviceStatus;
  warehouseName?: string | null;
  technicianId?: string | null;
  technicianName?: string | null;
  regionId?: string | null;
  createdAt: string;
};

export type SerialLifecycleRecord = RawSerialTrackingRecord & {
  lifecycleCategory: SerialLifecycleCategory;
  currentLocation: string;
  lifecycleLabel: string;
  badgeClass: string;
};

export const resolveLifecycleCategory = (row: RawSerialTrackingRecord): SerialLifecycleCategory => {
  if (row.status === "rejected") {
    return "rejected";
  }

  if (row.status === "approved") {
    return "delivered";
  }

  const warehouseName = String(row.warehouseName || "").toLowerCase();
  if (warehouseName) {
    if (warehouseName.includes("رئيس") || warehouseName.includes("main")) {
      return "main-warehouse";
    }
    return "regional-warehouse";
  }

  if (row.technicianName || row.technicianId) {
    return "technician-stock";
  }

  if (row.regionId) {
    return "regional-warehouse";
  }

  return "main-warehouse";
};

const lifecycleStyleByCategory: Record<
  SerialLifecycleCategory,
  { label: string; className: string; locationBuilder: (row: RawSerialTrackingRecord) => string }
> = {
  "main-warehouse": {
    label: "في المستودع الرئيسي",
    className: "bg-purple-700/60 text-white border border-slate-600",
    locationBuilder: (row) => row.warehouseName || "المستودع الرئيسي",
  },
  "regional-warehouse": {
    label: "في مستودع المنطقة",
    className: "bg-indigo-700/60 text-white border border-slate-600",
    locationBuilder: (row) => row.warehouseName || `مستودع المنطقة${row.regionId ? ` (${row.regionId})` : ""}`,
  },
  "technician-stock": {
    label: "في مخزون المندوب",
    className: "bg-orange-700/60 text-white border border-slate-600",
    locationBuilder: (row) => `عهدة المندوب (${row.technicianName || row.technicianId || "غير محدد"})`,
  },
  delivered: {
    label: "تم التسليم للعميل",
    className: "bg-emerald-700/70 text-white border border-slate-600",
    locationBuilder: () => "تم التسليم للعميل",
  },
  rejected: {
    label: "التسليم مرفوض",
    className: "bg-rose-800/80 text-white border border-slate-600 shadow-[0_0_12px_rgba(159,18,57,0.45)]",
    locationBuilder: (row) => `مرتجع (${row.technicianName || row.technicianId || "غير محدد"})`,
  },
};

export const toSerialLifecycleRows = (rows: RawSerialTrackingRecord[]): SerialLifecycleRecord[] => {
  return rows.map((row) => {
    const lifecycleCategory = resolveLifecycleCategory(row);
    const style = lifecycleStyleByCategory[lifecycleCategory];

    return {
      ...row,
      lifecycleCategory,
      currentLocation: style.locationBuilder(row),
      lifecycleLabel: style.label,
      badgeClass: style.className,
    };
  });
};

export const formatArabicDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const datePart = date.toLocaleDateString("ar-SA");
  const timePart = date.toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${datePart} | ${timePart}`;
};

