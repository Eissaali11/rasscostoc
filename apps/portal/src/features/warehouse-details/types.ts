export interface WarehouseInventory {
  id: string;
  warehouseId: string;
  n950Boxes: number;
  n950Units: number;
  i9000sBoxes: number;
  i9000sUnits: number;
  i9100Boxes: number;
  i9100Units: number;
  rollPaperBoxes: number;
  rollPaperUnits: number;
  stickersBoxes: number;
  stickersUnits: number;
  newBatteriesBoxes: number;
  newBatteriesUnits: number;
  mobilySimBoxes: number;
  mobilySimUnits: number;
  stcSimBoxes: number;
  stcSimUnits: number;
  zainSimBoxes: number;
  zainSimUnits: number;
  lebaraBoxes: number;
  lebaraUnits: number;
}

export interface WarehouseData {
  id: string;
  name: string;
  location: string;
  description: string | null;
  isActive: boolean;
  regionId: string | null;
  inventory: WarehouseInventory | null;
  technicians?: {
    id: string;
    fullName: string;
    username?: string;
    city?: string | null;
    profileImage?: string | null;
  }[];
}

export interface WarehouseTransferRaw {
  id: string;
  warehouseId: string;
  technicianId: string;
  technicianName: string;
  itemType: string;
  packagingType: string;
  quantity: number;
  performedBy: string;
  notes?: string;
  status: "pending" | "accepted" | "rejected";
  rejectionReason?: string;
  respondedAt?: string;
  createdAt: string;
}

export interface WarehouseTransfer {
  id: string;
  allIds: string[];
  warehouseId: string;
  technicianId: string;
  technicianName: string;
  n950?: number;
  n950PackagingType?: string;
  i9000s?: number;
  i9000sPackagingType?: string;
  i9100?: number;
  i9100PackagingType?: string;
  rollPaper?: number;
  rollPaperPackagingType?: string;
  stickers?: number;
  stickersPackagingType?: string;
  newBatteries?: number;
  newBatteriesPackagingType?: string;
  mobilySim?: number;
  mobilySimPackagingType?: string;
  stcSim?: number;
  stcSimPackagingType?: string;
  zainSim?: number;
  zainSimPackagingType?: string;
  lebaraSim?: number;
  lebaraSimPackagingType?: string;
  lebara?: number;
  lebaraPackagingType?: string;
  notes?: string;
  status?: "pending" | "accepted" | "rejected";
  rejectionReason?: string;
  respondedAt?: string;
  createdAt: string;
  [key: string]: string | number | string[] | undefined;
}

export interface WarehouseItemTypeLite {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface TransferItemDisplay {
  key: string;
  nameAr: string;
  nameEn: string;
  quantity: number;
  type: string;
}
