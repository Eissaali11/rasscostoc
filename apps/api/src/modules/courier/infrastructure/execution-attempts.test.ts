import { describe, it, expect, vi, beforeEach } from "vitest";
import { CourierService } from "../application/courier.service";
import { drizzleCourierRepository, DrizzleCourierRepository } from "./repositories/drizzle-courier.repository";
import { DrizzleCourierUnitOfWork } from "./repositories/DrizzleCourierUnitOfWork";
import { EventBus } from "@core/events/event-bus";
import { ExecutionCompletedEvent } from "@core/events/events";

const { mockRepoInstance } = vi.hoisted(() => {
  return {
    mockRepoInstance: {
      findRequestById: vi.fn(),
      findExecutionByRequestId: vi.fn(),
      updateExecution: vi.fn(),
      insertAuditLog: vi.fn(),
      findExecutionAttempts: vi.fn(),
      insertExecutionAttempt: vi.fn(),
      findRequestItems: vi.fn(),
      updateRequestItem: vi.fn(),
      insertRequestItems: vi.fn(),
      findUserById: vi.fn(),
      findItemBySerial: vi.fn(),
      findUserByCodeOrUsername: vi.fn(),
      findUserByFuzzyName: vi.fn(),
      findLinkedRequestItemBySerial: vi.fn(),
      findItemTypeById: vi.fn(),
    }
  };
});

// Mock the drizzleCourierRepository module
vi.mock("./repositories/drizzle-courier.repository", () => {
  return {
    drizzleCourierRepository: mockRepoInstance,
    DrizzleCourierRepository: vi.fn().mockImplementation(() => mockRepoInstance),
  };
});

// Mock the DrizzleCourierUnitOfWork module
vi.mock("./repositories/DrizzleCourierUnitOfWork", () => {
  return {
    DrizzleCourierUnitOfWork: vi.fn().mockImplementation(() => {
      return {
        execute: vi.fn().mockImplementation(async (cb) => {
          return cb({
            requestsRepository: mockRepoInstance,
            executionsRepository: mockRepoInstance,
            pdfRepository: mockRepoInstance,
            dashboardRepository: mockRepoInstance,
            inventoryPort: mockRepoInstance,
            tx: {},
          });
        }),
      };
    }),
  };
});

// Mock database to avoid hitting PostgreSQL
vi.mock("@server/core/config/db", () => {
  return {
    db: {
      transaction: vi.fn().mockImplementation((cb) => cb({})),
    },
    pool: {},
  };
});

describe("Courier Execution Engine & Attempts Lifecycle", () => {
  let service: CourierService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CourierService(
      new DrizzleCourierUnitOfWork(),
      mockRepoInstance as any,
      mockRepoInstance as any,
      mockRepoInstance as any,
      mockRepoInstance as any,
      mockRepoInstance as any,
    );
    // Clear EventBus
    const eventBus = EventBus.getInstance();
    (eventBus as any).emitter.removeAllListeners();
  });

  describe("Route Transitions", () => {
    it("should update status to ON_ROUTE when starting route", async () => {
      vi.mocked(drizzleCourierRepository.findRequestById).mockResolvedValue({ id: 1 } as any);
      vi.mocked(drizzleCourierRepository.findExecutionByRequestId).mockResolvedValue({
        id: 10,
        requestId: 1,
        installationStatus: "ACCEPTED",
        version: 1,
      } as any);
      vi.mocked(drizzleCourierRepository.updateExecution).mockResolvedValue({
        id: 10,
        installationStatus: "ON_ROUTE",
      } as any);

      const result = await service.startRoute(1, "actor-1");

      expect(result.success).toBe(true);
      expect(result.status).toBe("ON_ROUTE");
      expect(drizzleCourierRepository.updateExecution).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ installationStatus: "ON_ROUTE" }),
        1
      );
      expect(drizzleCourierRepository.insertAuditLog).toHaveBeenCalled();
    });

    it("should update status to ARRIVED when arriving at customer", async () => {
      vi.mocked(drizzleCourierRepository.findRequestById).mockResolvedValue({ id: 1 } as any);
      vi.mocked(drizzleCourierRepository.findExecutionByRequestId).mockResolvedValue({
        id: 10,
        requestId: 1,
        installationStatus: "ON_ROUTE",
        version: 1,
      } as any);
      vi.mocked(drizzleCourierRepository.updateExecution).mockResolvedValue({
        id: 10,
        installationStatus: "ARRIVED",
      } as any);

      const result = await service.arriveCustomer(1, "actor-1");

      expect(result.success).toBe(true);
      expect(result.status).toBe("ARRIVED");
      expect(drizzleCourierRepository.updateExecution).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ installationStatus: "ARRIVED" }),
        1
      );
    });

    it("should update status to INSTALLING when starting installation", async () => {
      vi.mocked(drizzleCourierRepository.findRequestById).mockResolvedValue({ id: 1 } as any);
      vi.mocked(drizzleCourierRepository.findExecutionByRequestId).mockResolvedValue({
        id: 10,
        requestId: 1,
        installationStatus: "ARRIVED",
        version: 1,
      } as any);
      vi.mocked(drizzleCourierRepository.updateExecution).mockResolvedValue({
        id: 10,
        installationStatus: "INSTALLING",
      } as any);

      const result = await service.startInstallation(1, "actor-1");

      expect(result.success).toBe(true);
      expect(result.status).toBe("INSTALLING");
    });
  });

  describe("Execution Attempt Submission", () => {
    it("should create a SUCCESS attempt, transition request, and publish completion event", async () => {
      const eventBus = EventBus.getInstance();
      const publishSpy = vi.spyOn(eventBus, "publish");

      vi.mocked(drizzleCourierRepository.findRequestById).mockResolvedValue({ id: 1, customerName: "Test" } as any);
      vi.mocked(drizzleCourierRepository.findExecutionByRequestId).mockResolvedValue({
        id: 10,
        requestId: 1,
        installationStatus: "INSTALLING",
        version: 1,
        sn: "OLD_SN",
        simSerial: "OLD_SIM",
      } as any);
      vi.mocked(drizzleCourierRepository.findExecutionAttempts).mockResolvedValue([]);
      vi.mocked(drizzleCourierRepository.insertExecutionAttempt).mockResolvedValue({
        id: 100,
        requestId: 1,
        attemptNumber: 1,
        status: "SUCCESS",
      } as any);
      vi.mocked(drizzleCourierRepository.updateExecution).mockResolvedValue({
        id: 10,
        requestId: 1,
        installationStatus: "Installation Completed",
        sn: "NEW_SN",
        simSerial: "NEW_SIM",
      } as any);
      vi.mocked(drizzleCourierRepository.findRequestItems).mockResolvedValue([
        { id: 200, status: "RECEIVED" },
      ] as any);

      const attemptResult = await service.createExecutionAttempt(1, "actor-1", {
        status: "SUCCESS",
        snInstalled: "NEW_SN",
        simInstalled: "NEW_SIM",
        notes: "تم التركيب بنجاح",
        gpsLatitude: 24.7136,
        gpsLongitude: 46.6753,
      });

      expect(attemptResult.status).toBe("SUCCESS");
      expect(attemptResult.attemptNumber).toBe(1);

      // Verify DB updates
      expect(drizzleCourierRepository.insertExecutionAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptNumber: 1,
          status: "SUCCESS",
          snInstalled: "NEW_SN",
          simInstalled: "NEW_SIM",
          gpsLatitude: 24.7136,
          gpsLongitude: 46.6753,
        })
      );

      expect(drizzleCourierRepository.updateExecution).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          installationStatus: "Installation Completed",
          sn: "NEW_SN",
          simSerial: "NEW_SIM",
        }),
        1
      );

      // Verify that request item status was updated to INSTALLED
      expect(drizzleCourierRepository.updateRequestItem).toHaveBeenCalledWith(
        200,
        expect.objectContaining({ status: "INSTALLED" })
      );

      // Verify event was published
      expect(publishSpy).toHaveBeenCalled();
       const publishedEvent = publishSpy.mock.calls[0][0] as any;
      expect(publishedEvent).toBeInstanceOf(ExecutionCompletedEvent);
      expect(publishedEvent.payload.requestId).toBe(1);
    });

    it("should create a FAILED attempt, transition request status to reason code, and not publish completion event", async () => {
      const eventBus = EventBus.getInstance();
      const publishSpy = vi.spyOn(eventBus, "publish");

      vi.mocked(drizzleCourierRepository.findRequestById).mockResolvedValue({ id: 1 } as any);
      vi.mocked(drizzleCourierRepository.findExecutionByRequestId).mockResolvedValue({
        id: 10,
        requestId: 1,
        installationStatus: "INSTALLING",
        version: 1,
      } as any);
      vi.mocked(drizzleCourierRepository.findExecutionAttempts).mockResolvedValue([
        { id: 99, attemptNumber: 1 },
      ] as any);
      vi.mocked(drizzleCourierRepository.insertExecutionAttempt).mockResolvedValue({
        id: 101,
        requestId: 1,
        attemptNumber: 2,
        status: "FAILED",
      } as any);
      vi.mocked(drizzleCourierRepository.updateExecution).mockResolvedValue({
        id: 10,
        requestId: 1,
        installationStatus: "CUST_NOT_ANSWER",
      } as any);

      const attemptResult = await service.createExecutionAttempt(1, "actor-1", {
        status: "FAILED",
        failureReasonCode: "CUST_NOT_ANSWER",
        notes: "العميل لا يرد على الاتصالات المتكررة",
        gpsLatitude: 24.7136,
        gpsLongitude: 46.6753,
      });

      expect(attemptResult.status).toBe("FAILED");
      expect(attemptResult.attemptNumber).toBe(2);

      expect(drizzleCourierRepository.insertExecutionAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptNumber: 2,
          status: "FAILED",
          failureReasonCode: "CUST_NOT_ANSWER",
        })
      );

      expect(drizzleCourierRepository.updateExecution).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          installationStatus: "CUST_NOT_ANSWER",
          responseReasonCode: "CUST_NOT_ANSWER",
        }),
        1
      );

      // Verify that request items were NOT updated
      expect(drizzleCourierRepository.updateRequestItem).not.toHaveBeenCalled();

      // Verify NO Completion Event was published
      expect(publishSpy).not.toHaveBeenCalled();
    });
  });
});
