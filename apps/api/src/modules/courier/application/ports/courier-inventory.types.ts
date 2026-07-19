/**
 * Courier-owned view of inventory catalog data (consumer language).
 * Never expose Drizzle inventory rows across the module boundary.
 */

export type CourierItemTypeView = {
  id: string;
  nameAr: string;
  nameEn: string;
  category: string;
};

export type CourierSerializedItemView = {
  id: string;
  serialNumber: string;
  status: string;
  itemTypeId: string;
  currentOwnerId: string | null;
  carrierName: string | null;
};

export type DeductCourierCustodyCommand = {
  technicianId: string;
  serialNumber: string;
  customerName: string;
  referenceNumber: string;
};

export type TransferCourierCustodyCommand = {
  itemId: string;
  technicianId: string;
  requestId: number;
  oldStatus: string;
  newStatus: "RECEIVED_BY_TECHNICIAN" | "IN_TRANSIT";
};

export type MintCourierCustodyCommand = {
  serial: string;
  itemTypeId: string;
  carrierName: string | null;
  technicianId: string;
  requestId: number;
};
