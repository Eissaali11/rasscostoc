import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { registerDevicesRoutes } from "../routes/devices.routes";
import { errorHandler } from "../../../../core/errors/errorHandler";

// Mock the authentication middleware
vi.mock("@core/middlewares/auth.middleware", () => {
  return {
    requireAuth: (req: any, res: any, next: any) => {
      req.user = { id: "test-user-id", username: "testuser", role: "admin", regionId: null };
      next();
    },
    requireAdmin: (req: any, res: any, next: any) => next(),
    requireSupervisor: (req: any, res: any, next: any) => next(),
  };
});

const { mockDeduct } = vi.hoisted(() => {
  return {
    mockDeduct: vi.fn(),
  };
});

// Mock DevicesService class
vi.mock("../../application/devices.service", () => {
  return {
    DevicesService: vi.fn().mockImplementation(() => {
      return {
        deductTechnicianInventory: mockDeduct,
      };
    }),
  };
});

describe("Devices Routes HTTP Integration Tests", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerDevicesRoutes(app);
    app.use(errorHandler);
    vi.clearAllMocks();
  });

  describe("POST /api/technicians/deduct-inventory", () => {
    it("should successfully deduct inventory and return 200 with normal auth", async () => {
      const mockResult = [
        { serialNumber: "SN12345", itemTypeId: "n950", status: "delivered" }
      ];

      mockDeduct.mockResolvedValue(mockResult);

      const res = await request(app)
        .post("/api/technicians/deduct-inventory")
        .send({
          technicianCode: "tech123",
          devices: [
            { serialNumber: "SN12345", model: "Newland N950" }
          ],
          notes: "Test delivery"
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.deductions).toEqual(mockResult);
      expect(mockDeduct).toHaveBeenCalled();
    });

    it("should successfully deduct inventory with X-System-Token system authentication", async () => {
      const mockResult = [
        { serialNumber: "SN54321", itemTypeId: "i9000s", status: "delivered" }
      ];

      mockDeduct.mockResolvedValue(mockResult);

      const res = await request(app)
        .post("/api/technicians/deduct-inventory")
        .set("X-System-Token", "rassco-stockpro-secret-token")
        .send({
          technicianCode: "tech123",
          devices: [
            { serialNumber: "SN54321", model: "PAX A920" }
          ]
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.deductions).toEqual(mockResult);
    });

    it("should return 400 validation error if technicianCode is missing", async () => {
      await request(app)
        .post("/api/technicians/deduct-inventory")
        .send({
          devices: [
            { serialNumber: "SN12345", model: "Newland N950" }
          ]
        })
        .expect(400);

      expect(mockDeduct).not.toHaveBeenCalled();
    });
  });
});
