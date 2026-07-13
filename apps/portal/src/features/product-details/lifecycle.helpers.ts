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

type TranslateFn = (key: string, options?: Record<string, any>) => string;

export const resolveLifecycleCategory = (row: RawSerialTrackingRecord): SerialLifecycleCategory => {
  if (row.status === "rejected") {
    return "rejected";
  }

  if (row.status === "approved") {
    return "delivered";
  }

  const warehouseName = String(row.warehouseName || "").toLowerCase();
  if (warehouseName) {
    // Keep Arabic "رئيس" matcher for main-warehouse data classification.
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
  {
    labelKey: string;
    className: string;
    locationBuilder: (row: RawSerialTrackingRecord, t: TranslateFn) => string;
  }
> = {
  "main-warehouse": {
    labelKey: "inventory.lifecycle_main_warehouse",
    className: "bg-purple-700/60 text-white border border-slate-600",
    locationBuilder: (row, t) => row.warehouseName || t("inventory.main_warehouse_fallback"),
  },
  "regional-warehouse": {
    labelKey: "inventory.lifecycle_regional_warehouse",
    className: "bg-indigo-700/60 text-white border border-slate-600",
    locationBuilder: (row, t) =>
      row.warehouseName ||
      `${t("inventory.regional_warehouse_fallback")}${row.regionId ? ` (${row.regionId})` : ""}`,
  },
  "technician-stock": {
    labelKey: "inventory.lifecycle_technician_stock",
    className: "bg-orange-700/60 text-white border border-slate-600",
    locationBuilder: (row, t) =>
      t("inventory.technician_custody", {
        name: row.technicianName || row.technicianId || t("inventory.unspecified"),
      }),
  },
  delivered: {
    labelKey: "inventory.lifecycle_delivered",
    className: "bg-emerald-700/70 text-white border border-slate-600",
    locationBuilder: (_row, t) => t("inventory.lifecycle_delivered"),
  },
  rejected: {
    labelKey: "inventory.lifecycle_rejected",
    className: "bg-rose-800/80 text-white border border-slate-600 shadow-[0_0_12px_rgba(159,18,57,0.45)]",
    locationBuilder: (row, t) =>
      t("inventory.returned_item", {
        name: row.technicianName || row.technicianId || t("inventory.unspecified"),
      }),
  },
};

export const toSerialLifecycleRows = (
  rows: RawSerialTrackingRecord[],
  t: TranslateFn,
): SerialLifecycleRecord[] => {
  return rows.map((row) => {
    const lifecycleCategory = resolveLifecycleCategory(row);
    const style = lifecycleStyleByCategory[lifecycleCategory];

    return {
      ...row,
      lifecycleCategory,
      currentLocation: style.locationBuilder(row, t),
      lifecycleLabel: t(style.labelKey),
      badgeClass: style.className,
    };
  });
};

export const formatLocalizedDateTime = (
  value: string,
  language: "ar" | "en" = "ar",
): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const locale = language === "en" ? "en-US" : "ar-SA";
  const datePart = date.toLocaleDateString(locale);
  const timePart = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${datePart} | ${timePart}`;
};

/** @deprecated Use formatLocalizedDateTime */
export const formatArabicDateTime = (value: string): string => formatLocalizedDateTime(value, "ar");
