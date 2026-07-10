export type WarehouseTransferRecord = {
  id: string;
  warehouseId: string;
  technicianId: string;
  itemType: string;
  packagingType: 'box' | 'unit';
  quantity: number;
  status: string;
  performedBy: string;
  notes?: string | null;
};
