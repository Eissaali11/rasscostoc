import type {
  ProductDistributionRow,
  ProductMaster,
  ProductsKpi,
  StorageBucketType,
  StorageOption,
} from "../types";

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asString = (value: unknown): string => (value == null ? "" : String(value));

export const normalizeProductMaster = (raw: any): ProductMaster => ({
  id: asString(raw?.id),
  itemCode: raw?.itemCode ?? raw?.code ?? raw?.sku ?? null,
  barcode: raw?.barcode ?? raw?.barCode ?? null,
  nameAr: asString(raw?.nameAr ?? raw?.name_ar ?? raw?.name ?? "منتج"),
  nameEn: raw?.nameEn ?? raw?.name_en ?? null,
  unitsPerBox: Math.max(1, asNumber(raw?.unitsPerBox ?? raw?.units_per_box ?? 1)),
});

const readInventoryLine = (line: any) => ({
  itemTypeId: asString(line?.itemTypeId ?? line?.item_type_id ?? line?.itemId ?? line?.item_id),
  boxes: asNumber(line?.boxes ?? line?.box ?? line?.cartons),
  units: asNumber(line?.units ?? line?.unit ?? line?.pieces),
  quantity: asNumber(line?.quantity ?? line?.qty ?? line?.availableQuantity ?? line?.available_quantity),
  warehouseId: asString(line?.warehouseId ?? line?.warehouse_id),
  warehouseName: asString(line?.warehouseName ?? line?.warehouse_name ?? line?.storageName),
  technicianId: asString(line?.technicianId ?? line?.technician_id),
  technicianName: asString(line?.technicianName ?? line?.technician_name ?? line?.storageName),
});

export const toStorageOptions = (rows: any[], type: StorageBucketType): StorageOption[] => {
  if (type === "warehouse") {
    return rows
      .map((row) => ({
        id: asString(row?.id),
        label: asString(row?.nameAr ?? row?.name_ar ?? row?.name ?? row?.warehouseName ?? "مستودع"),
      }))
      .filter((option) => option.id.length > 0);
  }

  return rows
    .map((row) => ({
      id: asString(row?.id),
      label: asString(
        (row?.fullName ??
          row?.name ??
          row?.nameAr ??
          [row?.firstName, row?.lastName].filter(Boolean).join(" ")) ||
          row?.technicianName ||
          "مندوب"
      ),
    }))
    .filter((option) => option.id.length > 0);
};

export const buildProductDistributionRows = (
  productsRaw: any[],
  warehouseInventoryRaw: any[],
  technicianInventoryRaw: any[]
): ProductDistributionRow[] => {
  const products = productsRaw.map(normalizeProductMaster);
  const unitsPerBoxByItemId = new Map(products.map((product) => [product.id, product.unitsPerBox]));

  const byItemId = new Map<string, ProductDistributionRow>();
  for (const product of products) {
    if (!product.id) {
      continue;
    }

    byItemId.set(product.id, {
      itemTypeId: product.id,
      itemCode: product.itemCode ?? "-",
      itemNameAr: product.nameAr,
      totalQuantity: 0,
      warehouseQuantity: 0,
      technicianQuantity: 0,
      locations: [],
    });
  }

  const upsertIfMissing = (itemTypeId: string) => {
    const existing = byItemId.get(itemTypeId);
    if (existing) {
      return existing;
    }

    const fallback: ProductDistributionRow = {
      itemTypeId,
      itemCode: "-",
      itemNameAr: `منتج #${itemTypeId}`,
      totalQuantity: 0,
      warehouseQuantity: 0,
      technicianQuantity: 0,
      locations: [],
    };
    byItemId.set(itemTypeId, fallback);
    return fallback;
  };

  const appendLocationQuantity = (
    target: ProductDistributionRow,
    storageType: StorageBucketType,
    storageId: string,
    storageName: string,
    quantity: number
  ) => {
    const existing = target.locations.find(
      (location) =>
        location.storageType === storageType &&
        location.storageId === storageId &&
        location.storageName === storageName
    );

    if (existing) {
      existing.quantity += quantity;
      return;
    }

    target.locations.push({
      storageType,
      storageId,
      storageName,
      quantity,
    });
  };

  for (const raw of warehouseInventoryRaw) {
    const line = readInventoryLine(raw);
    if (!line.itemTypeId) {
      continue;
    }

    const unitsPerBox = unitsPerBoxByItemId.get(line.itemTypeId) ?? 1;
    const normalizedQuantity = line.quantity > 0 ? line.quantity : line.boxes * unitsPerBox + line.units;
    if (normalizedQuantity <= 0) {
      continue;
    }

    const target = upsertIfMissing(line.itemTypeId);
    target.totalQuantity += normalizedQuantity;
    target.warehouseQuantity += normalizedQuantity;
    appendLocationQuantity(
      target,
      "warehouse",
      line.warehouseId,
      line.warehouseName || "مستودع",
      normalizedQuantity
    );
  }

  for (const raw of technicianInventoryRaw) {
    const line = readInventoryLine(raw);
    if (!line.itemTypeId) {
      continue;
    }

    const unitsPerBox = unitsPerBoxByItemId.get(line.itemTypeId) ?? 1;
    const normalizedQuantity = line.quantity > 0 ? line.quantity : line.boxes * unitsPerBox + line.units;
    if (normalizedQuantity <= 0) {
      continue;
    }

    const target = upsertIfMissing(line.itemTypeId);
    target.totalQuantity += normalizedQuantity;
    target.technicianQuantity += normalizedQuantity;
    appendLocationQuantity(
      target,
      "technician",
      line.technicianId,
      line.technicianName || "مندوب",
      normalizedQuantity
    );
  }

  return Array.from(byItemId.values()).sort((left, right) => right.totalQuantity - left.totalQuantity);
};

export const calculateProductsKpis = (rows: ProductDistributionRow[]): ProductsKpi => {
  return rows.reduce<ProductsKpi>(
    (accumulator, row) => {
      accumulator.totalProducts += 1;
      accumulator.totalStock += row.totalQuantity;
      accumulator.totalWarehouseStock += row.warehouseQuantity;
      accumulator.totalTechnicianStock += row.technicianQuantity;
      return accumulator;
    },
    {
      totalProducts: 0,
      totalStock: 0,
      totalWarehouseStock: 0,
      totalTechnicianStock: 0,
    }
  );
};

