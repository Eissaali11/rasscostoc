export type StorageBucketType = "warehouse" | "technician";

export type ProductMaster = {
  id: string;
  itemCode?: string | null;
  barcode?: string | null;
  nameAr: string;
  nameEn?: string | null;
  unitsPerBox: number;
};

export type DistributionLocation = {
  storageType: StorageBucketType;
  storageId: string;
  storageName: string;
  quantity: number;
};

export type ProductDistributionRow = {
  itemTypeId: string;
  itemCode: string;
  itemNameAr: string;
  totalQuantity: number;
  warehouseQuantity: number;
  technicianQuantity: number;
  locations: DistributionLocation[];
};

export type ProductsKpi = {
  totalProducts: number;
  totalStock: number;
  totalWarehouseStock: number;
  totalTechnicianStock: number;
};

export type ProductScanRecord = {
  id: string;
  itemTypeId: string;
  itemNameAr: string;
  quantity: number;
  operationType:
    | "ADD_STOCK"
    | "DEDUCT_STOCK"
    | "TRANSFER_TO_TECHNICIAN"
    | "WITHDRAW_FROM_TECHNICIAN";
  packagingType: "box" | "unit";
  storageType: StorageBucketType;
  storageId: string;
  storageName: string;
  createdAt: string;
};

export type StorageOption = {
  id: string;
  label: string;
};
