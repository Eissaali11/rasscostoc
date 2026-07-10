export type LegacyStockField =
  | 'n950Boxes'
  | 'n950Units'
  | 'i9000sBoxes'
  | 'i9000sUnits'
  | 'i9100Boxes'
  | 'i9100Units'
  | 'rollPaperBoxes'
  | 'rollPaperUnits'
  | 'stickersBoxes'
  | 'stickersUnits'
  | 'newBatteriesBoxes'
  | 'newBatteriesUnits'
  | 'mobilySimBoxes'
  | 'mobilySimUnits'
  | 'stcSimBoxes'
  | 'stcSimUnits'
  | 'zainSimBoxes'
  | 'zainSimUnits';

export type LegacyStockSnapshot = Record<LegacyStockField, number>;

export type WarehouseTransferAdminRecord = {
  id: string;
  warehouseId: string;
  technicianId: string;
  itemType: string;
  packagingType: 'box' | 'unit';
  quantity: number;
  status: string;
};

export interface IWarehouseTransferAdminRepository {
  getTransfersByIds(ids: string[]): Promise<WarehouseTransferAdminRecord[]>;
  getWarehouseInventoryByWarehouseId(warehouseId: string): Promise<LegacyStockSnapshot | undefined>;
  updateWarehouseInventoryByWarehouseId(warehouseId: string, updates: LegacyStockSnapshot): Promise<void>;
  getTechnicianFullNameById(technicianId: string): Promise<string | undefined>;
  getTechnicianMovingInventoryByName(technicianName: string): Promise<LegacyStockSnapshot | undefined>;
  updateTechnicianMovingInventoryByName(technicianName: string, updates: LegacyStockSnapshot): Promise<void>;
  deleteTransfersByIds(ids: string[]): Promise<void>;
}
