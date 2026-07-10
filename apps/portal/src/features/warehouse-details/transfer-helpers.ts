import type {
  TransferItemDisplay,
  WarehouseItemTypeLite,
  WarehouseTransfer,
  WarehouseTransferRaw,
} from "./types";

const TRANSFER_BASE_KEYS = [
  "id",
  "allIds",
  "warehouseId",
  "technicianId",
  "technicianName",
  "notes",
  "status",
  "rejectionReason",
  "respondedAt",
  "createdAt",
];

const LEGACY_ITEM_NAMES: Record<string, { name: string; nameAr: string }> = {
  n950: { name: "N950", nameAr: "N950" },
  i9000s: { name: "I9000s", nameAr: "I9000s" },
  i9100: { name: "I9100", nameAr: "I9100" },
  rollPaper: { name: "Roll Paper", nameAr: "ورق" },
  stickers: { name: "Stickers", nameAr: "ملصقات" },
  newBatteries: { name: "Batteries", nameAr: "بطاريات" },
  mobilySim: { name: "Mobily SIM", nameAr: "موبايلي" },
  stcSim: { name: "STC SIM", nameAr: "STC" },
  zainSim: { name: "Zain SIM", nameAr: "زين" },
  lebaraSim: { name: "Lebara SIM", nameAr: "ليبارا" },
  lebara: { name: "Lebara SIM", nameAr: "ليبارا" },
};

export function groupWarehouseTransfers(
  rawTransfers: WarehouseTransferRaw[] | undefined,
  warehouseId: string,
): WarehouseTransfer[] {
  if (!rawTransfers || rawTransfers.length === 0) {
    return [];
  }

  const filtered = rawTransfers.filter((transfer) => transfer.warehouseId === warehouseId);

  const grouped = filtered.reduce((acc, transfer) => {
    const timestamp = new Date(transfer.createdAt).getTime();
    const timeWindow = Math.floor(timestamp / 10000);
    const key = `${transfer.technicianId}-${timeWindow}-${transfer.performedBy}-${transfer.status}-${transfer.notes || "no-notes"}`;

    if (!acc[key]) {
      acc[key] = {
        id: transfer.id,
        allIds: [],
        warehouseId: transfer.warehouseId,
        technicianId: transfer.technicianId,
        technicianName: transfer.technicianName,
        notes: transfer.notes,
        status: transfer.status,
        rejectionReason: transfer.rejectionReason,
        respondedAt: transfer.respondedAt,
        createdAt: transfer.createdAt,
      } as WarehouseTransfer;
    }

    acc[key].allIds.push(transfer.id);
    acc[key][transfer.itemType] = transfer.quantity;
    acc[key][`${transfer.itemType}PackagingType`] = transfer.packagingType;

    return acc;
  }, {} as Record<string, WarehouseTransfer>);

  return Object.values(grouped);
}

export function filterWarehouseTransfers(transfers: WarehouseTransfer[], searchQuery: string): WarehouseTransfer[] {
  if (!searchQuery.trim()) {
    return transfers;
  }

  const query = searchQuery.toLowerCase();
  return transfers.filter(
    (transfer) =>
      transfer.technicianName.toLowerCase().includes(query) ||
      (!!transfer.notes && transfer.notes.toLowerCase().includes(query)),
  );
}

export function extractTransferItems(
  transfer: WarehouseTransfer,
  itemTypesData?: WarehouseItemTypeLite[],
): TransferItemDisplay[] {
  const items: TransferItemDisplay[] = [];
  const transferObj = transfer as Record<string, unknown>;

  const transferKeys = Object.keys(transferObj).filter(
    (key) => !TRANSFER_BASE_KEYS.includes(key) && !key.endsWith("PackagingType"),
  );

  transferKeys.forEach((key) => {
    const quantityRaw = transferObj[key];
    const quantity = Number(quantityRaw || 0);
    const packagingType = String(transferObj[`${key}PackagingType`] || "box");

    if (quantity <= 0) {
      return;
    }

    let itemNameEn = key;
    let itemNameAr = key;

    if (itemTypesData && itemTypesData.length > 0) {
      const matchedType = itemTypesData.find(
        (itemType) => itemType.nameEn.toLowerCase() === key.toLowerCase() || itemType.id === key,
      );

      if (matchedType) {
        itemNameEn = matchedType.nameEn;
        itemNameAr = matchedType.nameAr;
      }
    }

    if (LEGACY_ITEM_NAMES[key]) {
      itemNameEn = LEGACY_ITEM_NAMES[key].name;
      itemNameAr = LEGACY_ITEM_NAMES[key].nameAr;
    }

    items.push({
      key,
      nameAr: itemNameAr,
      nameEn: itemNameEn,
      quantity,
      type: packagingType,
    });
  });

  return items;
}

export function getTransferStatusText(status?: string): string {
  if (status === "pending") return "معلقة";
  if (status === "accepted") return "مقبولة";
  return "مرفوضة";
}

export function getTransferStatusColor(status?: string): string {
  if (status === "accepted") return "#22c55e";
  if (status === "rejected") return "#ef4444";
  return "#eab308";
}

export function buildTransferExportRows(
  transfers: WarehouseTransfer[],
  itemTypesData?: WarehouseItemTypeLite[],
) {
  return transfers.map((transfer) => {
    const items = extractTransferItems(transfer, itemTypesData);

    return {
      technicianName: transfer.technicianName,
      items: items
        .map((item) => `${item.nameAr}: ${item.quantity} ${item.type === "box" ? "كرتون" : "قطعة"}`)
        .join(" | "),
      status: getTransferStatusText(transfer.status),
      createdAt: transfer.createdAt,
      notes: transfer.notes,
    };
  });
}
