import { describe, it, expect, vi } from "vitest";
import { DevicesService } from "./devices.service";
import type { IDevicesRepository } from "./devices/contracts/IDevicesRepository";
import type { ReceivedDevice, WithdrawnDevice } from "@shared/schema";

describe("DevicesService", () => {
  const mockRepository: IDevicesRepository = {
    hasItemTypeColumn: vi.fn(),
    getWithdrawnDevices: vi.fn(),
    getReceivedDevicesForWithdrawnList: vi.fn(),
    getWithdrawnDevicesByRegion: vi.fn(),
    getReceivedDevicesForWithdrawnListByRegion: vi.fn(),
    getWithdrawnDevice: vi.fn(),
    getReceivedDevice: vi.fn(),
    createWithdrawnDevice: vi.fn(),
    updateWithdrawnDevice: vi.fn(),
    deleteWithdrawnDevice: vi.fn(),
    deleteReceivedDevice: vi.fn(),
    getReceivedDevices: vi.fn(),
    createReceivedDevice: vi.fn(),
    updateReceivedDevice: vi.fn(),
    updateReceivedDeviceStatus: vi.fn(),
    getPendingReceivedDevicesCount: vi.fn(),
    getDevicesSummaryByRegion: vi.fn(),
    getDevicesByTechnician: vi.fn(),
    getPendingDevicesForApproval: vi.fn(),
    approveDevicesBatch: vi.fn(),
    rejectDevicesBatch: vi.fn(),
    deliverDeviceByBarcode: vi.fn(),
    deductTechnicianInventory: vi.fn(),
  };

  const service = new DevicesService(mockRepository);

  it("should combine and format withdrawn and received devices sorted by createdAt", async () => {
    const mockWithdrawn: any[] = [
      {
        id: "w1",
        serialNumber: "W_SERIAL",
        createdAt: new Date("2026-07-01"),
        isReceived: false,
      },
    ];

    const mockReceived: any[] = [
      {
        id: "r1",
        serialNumber: "R_SERIAL",
        createdAt: new Date("2026-07-02"),
        isReceived: true,
        battery: true,
        chargerCable: true,
        chargerHead: false,
        hasSim: false,
      },
    ];

    vi.mocked(mockRepository.getWithdrawnDevices).mockResolvedValue(mockWithdrawn);
    vi.mocked(mockRepository.getReceivedDevicesForWithdrawnList).mockResolvedValue(mockReceived);

    const result = await service.getWithdrawnDevices();

    expect(mockRepository.getWithdrawnDevices).toHaveBeenCalled();
    expect(mockRepository.getReceivedDevicesForWithdrawnList).toHaveBeenCalled();
    expect(result.length).toBe(2);
    // Should be sorted desc, so R_SERIAL first (July 2nd) then W_SERIAL (July 1st)
    expect(result[0].id).toBe("r1");
    expect(result[0].battery).toBe("جيدة");
    expect(result[0].chargerCable).toBe("موجود");
    expect(result[0].chargerHead).toBe("غير موجود");
    expect(result[0].hasSim).toBe("لا");

    expect(result[1].id).toBe("w1");
  });

  it("should delegate single withdrawn or received device details fetch to the repository", async () => {
    vi.mocked(mockRepository.getWithdrawnDevice).mockResolvedValue({ id: "device-1" });
    const result = await service.getWithdrawnDevice("device-1");
    expect(mockRepository.getWithdrawnDevice).toHaveBeenCalledWith("device-1");
    expect(result).toEqual({ id: "device-1" });
  });

  it("should delegate update received device status to the repository and check existing status", async () => {
    const existing: ReceivedDevice = {
      id: "r1",
      technicianId: "t1",
      status: "pending",
      serialNumber: "S1",
      battery: true,
      chargerCable: true,
      chargerHead: true,
      hasSim: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      supervisorId: null,
      itemTypeId: null,
      terminalId: null,
      simCardType: null,
      damagePart: null,
      inventoryType: "fixed",
      adminNotes: null,
      approvedBy: null,
      approvedAt: null,
      regionId: null,
    };

    vi.mocked(mockRepository.getReceivedDevice).mockResolvedValue(existing);
    vi.mocked(mockRepository.updateReceivedDeviceStatus).mockResolvedValue({
      ...existing,
      status: "approved",
    });

    const result = await service.updateReceivedDeviceStatus("r1", "approved", "supervisor-1", "all good");

    expect(mockRepository.getReceivedDevice).toHaveBeenCalledWith("r1");
    expect(mockRepository.updateReceivedDeviceStatus).toHaveBeenCalledWith(
      "r1",
      "approved",
      "supervisor-1",
      "all good",
      existing
    );
    expect(result.status).toBe("approved");
  });
});
