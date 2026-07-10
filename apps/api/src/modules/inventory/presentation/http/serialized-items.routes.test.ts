import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { registerSerializedItemsRoutes } from "../routes/serialized-items.routes";
import { serializedItemsContainer } from "@server/composition/serialized-items.container";
import { errorHandler } from "../../../../core/errors/errorHandler";

// Mock the authentication middleware
vi.mock("@core/middlewares/auth.middleware", () => {
  return {
    requireAuth: (req: any, res: any, next: any) => {
      req.user = { id: "test-tech-id-123", username: "testtech", role: "technician" };
      next();
    },
  };
});

// Mock SerializedItemsService before container is loaded
vi.mock("@modules/inventory/infrastructure/services/serialized-items.service", () => {
  const scanInMock = vi.fn();
  const scanOutMock = vi.fn();
  const lookupMock = vi.fn();

  return {
    SerializedItemsService: class {
      scanIn = scanInMock;
      scanOut = scanOutMock;
      lookup = lookupMock;
    },
    serializedItemsService: {
      scanIn: scanInMock,
      scanOut: scanOutMock,
      lookup: lookupMock,
    }
  };
});

describe("Serialized Items HTTP Integration Tests", () => {
  let app: express.Express;
  const mockSerializedItemsService = serializedItemsContainer.serializedItemsService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerSerializedItemsRoutes(app);
    app.use(errorHandler);
    vi.clearAllMocks();
  });

  describe("POST /api/serialized-items/scan-in", () => {
    it("should successfully register custody scan-in and return 200", async () => {
      const mockResult = {
        id: "item-uuid-111",
        serialNumber: "SN-DEVICE-777",
        status: "IN_TRANSIT_CUSTODY",
        currentOwnerId: "test-tech-id-123",
      };

      vi.mocked(mockSerializedItemsService.scanIn).mockResolvedValue(mockResult as any);

      const res = await request(app)
        .post("/api/serialized-items/scan-in")
        .send({
          serialNumber: "SN-DEVICE-777",
          itemTypeId: "device-type-pos",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(mockSerializedItemsService.scanIn).toHaveBeenCalledWith(
        "test-tech-id-123",
        "SN-DEVICE-777",
        "device-type-pos",
        undefined,
        undefined
      );
    });

    it("should return 400 validation error if serialNumber is missing", async () => {
      await request(app)
        .post("/api/serialized-items/scan-in")
        .send({
          itemTypeId: "device-type-pos",
        })
        .expect(400);

      expect(mockSerializedItemsService.scanIn).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/serialized-items/scan-out", () => {
    it("should successfully register scan-out and return 200", async () => {
      const mockResult = {
        id: "item-uuid-111",
        serialNumber: "SN-DEVICE-777",
        status: "DELIVERED",
        currentOwnerId: null,
      };

      vi.mocked(mockSerializedItemsService.scanOut).mockResolvedValue(mockResult as any);

      const res = await request(app)
        .post("/api/serialized-items/scan-out")
        .send({
          serialNumber: "SN-DEVICE-777",
          receiverName: "Ahmed Ali",
          orderNumber: "ORD-9988",
          latitude: 24.7136,
          longitude: 46.6753,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(mockSerializedItemsService.scanOut).toHaveBeenCalledWith(
        "test-tech-id-123",
        "SN-DEVICE-777",
        "Ahmed Ali",
        "ORD-9988",
        24.7136,
        46.6753
      );
    });

    it("should return 400 validation error if receiverName is missing", async () => {
      await request(app)
        .post("/api/serialized-items/scan-out")
        .send({
          serialNumber: "SN-DEVICE-777",
          orderNumber: "ORD-9988",
        })
        .expect(400);

      expect(mockSerializedItemsService.scanOut).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/serialized-items/lookup/:serialNumber", () => {
    it("should return 200 and device custody history logs if item exists", async () => {
      const mockLookupResult = {
        id: "item-uuid-111",
        serialNumber: "SN-DEVICE-777",
        status: "DELIVERED",
        carrierName: "STC",
        createdAt: "2026-06-25T00:00:00Z",
        itemTypeNameAr: "شريحة اتصال STC",
        ownerName: "الفني المختص",
        ownerUsername: "tech1",
        history: [
          {
            id: "log-uuid-1",
            fromStatus: "NONE",
            toStatus: "IN_TRANSIT_CUSTODY",
            changedAt: "2026-06-25T00:05:00Z",
            notes: "استلام عهدة أولية",
            changedByName: "فني الاختبار",
          },
        ],
      };

      vi.mocked(mockSerializedItemsService.lookup).mockResolvedValue(mockLookupResult as any);

      const res = await request(app)
        .get("/api/serialized-items/lookup/SN-DEVICE-777")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockLookupResult);
      expect(mockSerializedItemsService.lookup).toHaveBeenCalledWith("SN-DEVICE-777");
    });

    it("should return 404 error if item is not found", async () => {
      vi.mocked(mockSerializedItemsService.lookup).mockResolvedValue(null);

      const res = await request(app)
        .get("/api/serialized-items/lookup/SN-DEVICE-UNKNOWN")
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("المادة غير مسجلة");
    });
  });
});
