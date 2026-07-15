/**
 * Courier Domain Shared Types
 *
 * Defines types that are shared across Domain, Application, and Infrastructure
 * layers within the Courier module. These types must NOT depend on any framework,
 * ORM, or infrastructure concern.
 */

export interface ListFilters {
  q?: string;
  city?: string;
  technician?: string;
  status?: string;
  reason?: string;
  simType?: string;
  vendor?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  /** When false, skip COUNT(*) (total ≈ page row count). Default true. */
  includeTotal?: boolean;
}

export interface ItemUpdatePayload {
  itemId: number;
  status: string;
  serialNumber?: string;
  simSerial?: string;
}

/** Snapshot of the serial lookup result returned by the serial engine. */
export interface SerialLookupResult {
  found: boolean;
  serial: string;
  normalized: string;
  item: {
    id: string;
    serialNumber: string | null;
    status: string;
    barcode: string | null;
  } | null;
  itemType: {
    id: string;
    nameAr: string;
    category: string;
    carrierName: string | null;
  } | null;
  technician: {
    id: string;
    fullName: string;
    username: string;
    technicianCode: string | null;
  } | null;
  custodyStatus: string | null;
  inActiveCustody: boolean;
  linkedRequest: {
    requestId: number;
    tid: string | null;
    terminalId: string | null;
    customerName: string | null;
    installationType: string | null;
    itemStatus: string;
  } | null;
  ownershipValid: boolean;
  message?: string;
}

export interface CourierRequest {
  id: number;
  date: string | null;
  installationType: string | null;
  sim: string | null;
  tid: string | null;
  otp: string | null;
  ticketingHolouly: string | null;
  incidentNumber: string | null;
  pinCode: string | null;
  trsm: string | null;
  terminalId: string | null;
  simSn: string | null;
  idData: string | null;
  vendorType: string | null;
  city: string | null;
  cityTec: string | null;
  customerName: string | null;
  retailerName: string | null;
  addressAr: string | null;
  addressEn: string | null;
  mobile: string | null;
  mobile2: string | null;
  tecName: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  version: number;
}

export interface CourierRequestItem {
  id: number;
  requestId: number;
  itemType: string;
  inventoryItemId: number | null;
  serialNumber: string | null;
  simSerial: string | null;
  quantity: number;
  status: string;
  scannedAt: Date | null;
  receivedAt: Date | null;
  installedAt: Date | null;
  deliveredAt: Date | null;
  technicianId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CourierExecution {
  id: number;
  requestId: number;
  requestPriorityLevel: string | null;
  pushBack: string | null;
  installationStatus: string | null;
  paperRoll: string | null;
  time: string | null;
  deliveryDate: string | null;
  responseDate: string | null;
  sn: string | null;
  simSerial: string | null;
  simType: string | null;
  customerNotes: string | null;
  extraField1: string | null;
  extraField2: string | null;
  responseReasonCode: string | null;
  salesTechnician: string | null;
  technicianCode: string | null;
  extractionConfidence: string | null;
  enteredBy: string | null;
  enteredAt: Date | null;
  updatedAt: Date | null;
  version: number;
}

export interface CourierPdfReport {
  id: number;
  requestId: number | null;
  fileName: string;
  filePath: string;
  uploadedBy: string | null;
  uploadedAt: Date | null;
  ocrText: string | null;
  extractedJson: string | null;
  overallConfidence: number | null;
  status: string;
}

export interface CourierExecutionAttempt {
  id: number;
  requestId: number;
  attemptNumber: number;
  status: string;
  failureReasonCode: string | null;
  notes: string | null;
  snInstalled: string | null;
  simInstalled: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  batteryLevel: number | null;
  networkOperator: string | null;
  startTime: Date | null;
  arrivalTime: Date | null;
  endTime: Date | null;
  evidencePhotos: any | null; // string[] as JSON/array
  customerSignature: string | null;
  enteredBy: string | null;
  createdAt: Date | null;
}
