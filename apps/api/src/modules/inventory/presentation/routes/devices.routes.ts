/**
 * Devices routes (Withdrawn & Received)
 */

import crypto from "crypto";
import type { Express } from "express";
import { devicesContainer } from "@server/composition/devices.container";
import { requireAuth, requireAdmin, requireSupervisor } from "@core/middlewares/auth.middleware";
import { validateBody } from "@core/middlewares/validation";
import {
  insertWithdrawnDeviceSchema,
} from "@shared/schema";
import { z } from "zod";

const updateDeviceStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
  adminNotes: z.string().optional(),
});

const uploadDeliveryProofSchema = z
  .object({
    fileUrl: z.string().trim().min(1).optional(),
    fileName: z.string().trim().optional(),
    receiptFormFileUrl: z.string().trim().min(1).optional(),
    receiptFormFileName: z.string().trim().optional(),
    customerName: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    deliveredAt: z.string().datetime().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })
  .refine((value) => !!(value.fileUrl || value.receiptFormFileUrl), {
    message: "يجب إرفاق ملف تسليم واحد على الأقل (delivery أو فرم الاستلام الورقي)",
    path: ["fileUrl"],
  });

export function registerDevicesRoutes(app: Express): void {
  const controller = devicesContainer.devicesController;

  // ===== Withdrawn Devices =====

  // Get all withdrawn devices
  app.get(
    "/api/withdrawn-devices",
    requireAuth,
    controller.getWithdrawnDevices
  );

  // Get single withdrawn device
  app.get(
    "/api/withdrawn-devices/:id",
    requireAuth,
    controller.getWithdrawnDevice
  );

  // Create withdrawn device
  app.post(
    "/api/withdrawn-devices",
    requireAuth,
    validateBody(insertWithdrawnDeviceSchema),
    controller.createWithdrawnDevice
  );

  // Update withdrawn device
  app.patch(
    "/api/withdrawn-devices/:id",
    requireAuth,
    validateBody(insertWithdrawnDeviceSchema.partial()),
    controller.updateWithdrawnDevice
  );

  // Delete withdrawn device
  app.delete(
    "/api/withdrawn-devices/:id",
    requireAuth,
    requireAdmin,
    controller.deleteWithdrawnDevice
  );

  // ===== Received Devices =====

  // Get received devices
  app.get(
    "/api/received-devices",
    requireAuth,
    controller.getReceivedDevices
  );

  // Get pending received devices count
  app.get(
    "/api/received-devices/pending/count",
    requireAuth,
    controller.getPendingReceivedDevicesCount
  );

  // Get single received device
  app.get(
    "/api/received-devices/:id",
    requireAuth,
    controller.getReceivedDevice
  );

  // Create received device
  app.post(
    "/api/received-devices",
    requireAuth,
    controller.createReceivedDevice
  );

  // Deliver received device by barcode scan
  app.post(
    "/api/received-devices/deliver",
    requireAuth,
    controller.deliverDevice
  );

  // Deduct inventory batch for technician (called by RASSCO or other systems)
  app.post(
    "/api/technicians/deduct-inventory",
    async (req, res, next) => {
      const token = req.headers["x-system-token"] || req.headers["authorization"];
      const expectedToken = process.env.SYSTEM_INTERNAL_TOKEN;

      // Constant-time comparison: hash both sides to a fixed-length digest first
      // so timingSafeEqual never throws on mismatched lengths, and so the
      // comparison itself doesn't leak timing information about the secret.
      const constantTimeEquals = (a: string, b: string): boolean => {
        const hashA = crypto.createHash("sha256").update(a).digest();
        const hashB = crypto.createHash("sha256").update(b).digest();
        return crypto.timingSafeEqual(hashA, hashB);
      };

      if (
        expectedToken &&
        typeof token === "string" &&
        (constantTimeEquals(token, expectedToken) ||
          constantTimeEquals(token, `Bearer ${expectedToken}`))
      ) {
        req.user = {
          id: "system",
          role: "admin",
          username: "system",
          regionId: null,
          employeeCode: null,
          technicianCode: null,
          permissions: [],
        };
        return next();
      }
      return requireAuth(req, res, next);
    },
    controller.deductTechnicianInventory
  );

  // Upload delivery proof from technician mobile app
  app.post(
    "/api/received-devices/:id/delivery-proof",
    requireAuth,
    validateBody(uploadDeliveryProofSchema),
    controller.uploadReceivedDeviceDeliveryProof
  );

  // Update received device status
  app.patch(
    "/api/received-devices/:id/status",
    requireAuth,
    requireSupervisor,
    validateBody(updateDeviceStatusSchema),
    controller.updateReceivedDeviceStatus
  );

  // Update received device details (serialNumber, etc.)
  app.patch(
    "/api/received-devices/:id",
    requireAuth,
    controller.patchReceivedDevice
  );

  // Delete received device
  app.delete(
    "/api/received-devices/:id",
    requireAuth,
    controller.deleteReceivedDevice
  );
}

