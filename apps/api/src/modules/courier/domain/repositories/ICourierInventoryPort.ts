export interface ICourierInventoryPort {
  transferCustodyToTechnician(
    params: {
      itemId: string;
      technicianId: string;
      requestId: number;
      oldStatus: string;
      newStatus: "RECEIVED_BY_TECHNICIAN" | "IN_TRANSIT";
    },
    tx?: any
  ): Promise<void>;

  mintAndAssignToTechnician(
    params: {
      serial: string;
      itemTypeId: string;
      carrierName: string | null;
      technicianId: string;
      requestId: number;
    },
    tx?: any
  ): Promise<{ id: string; serialNumber: string }>;

  normalizeSerial(
    serial: string,
    hintItemTypeId: string,
    tx?: any
  ): Promise<{
    normalizedSerial: string;
    itemTypeId: string;
    carrierName: string | null;
  }>;

  findItemBySerial(serial: string, tx?: any): Promise<any | null>;
  findItemTypeById(itemTypeId: string, tx?: any): Promise<{ id: string; nameAr: string; nameEn: string; category: string } | null>;
  findUserById(userId: string, tx?: any): Promise<{ id: string; fullName: string; username: string; technicianCode: string | null; role: string; regionId: number | null } | null>;
  findUserByCodeOrUsername(code: string, tx?: any): Promise<{ id: string; fullName: string; username: string; technicianCode: string | null } | null>;
  findUserByFuzzyName(name: string, tx?: any): Promise<{ id: string; fullName: string; username: string; technicianCode: string | null } | null>;
  findLinkedRequestItemBySerial(serial: string, tx?: any): Promise<{ requestId: number; id: number; itemType: string; status: string } | null>;
}
