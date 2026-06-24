/**
 * Devices routes (Withdrawn & Received)
 */

import type { Express } from "express";
import { devicesController } from "../controllers/devices.controller";
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
  // ===== Withdrawn Devices =====

  // Get all withdrawn devices
  app.get(
    "/api/withdrawn-devices",
    requireAuth,
    devicesController.getWithdrawnDevices
  );

  // Get single withdrawn device
  app.get(
    "/api/withdrawn-devices/:id",
    requireAuth,
    devicesController.getWithdrawnDevice
  );

  // Create withdrawn device
  app.post(
    "/api/withdrawn-devices",
    requireAuth,
    validateBody(insertWithdrawnDeviceSchema),
    devicesController.createWithdrawnDevice
  );

  // Update withdrawn device
  app.patch(
    "/api/withdrawn-devices/:id",
    requireAuth,
    validateBody(insertWithdrawnDeviceSchema.partial()),
    devicesController.updateWithdrawnDevice
  );

  // Delete withdrawn device
  app.delete(
    "/api/withdrawn-devices/:id",
    requireAuth,
    requireAdmin,
    devicesController.deleteWithdrawnDevice
  );

  // ===== Received Devices =====

  // Get received devices
  app.get(
    "/api/received-devices",
    requireAuth,
    devicesController.getReceivedDevices
  );

  // Get pending received devices count
  app.get(
    "/api/received-devices/pending/count",
    requireAuth,
    devicesController.getPendingReceivedDevicesCount
  );

  // Get single received device
  app.get(
    "/api/received-devices/:id",
    requireAuth,
    devicesController.getReceivedDevice
  );

  // Create received device
  app.post(
    "/api/received-devices",
    requireAuth,
    devicesController.createReceivedDevice
  );

  // Deliver received device by barcode scan
  app.post(
    "/api/received-devices/deliver",
    requireAuth,
    devicesController.deliverDevice
  );

  // Upload delivery proof from technician mobile app
  app.post(
    "/api/received-devices/:id/delivery-proof",
    requireAuth,
    validateBody(uploadDeliveryProofSchema),
    devicesController.uploadReceivedDeviceDeliveryProof
  );

  // Update received device status
  app.patch(
    "/api/received-devices/:id/status",
    requireAuth,
    requireSupervisor,
    validateBody(updateDeviceStatusSchema),
    devicesController.updateReceivedDeviceStatus
  );

  // Delete received device
  app.delete(
    "/api/received-devices/:id",
    requireAuth,
    requireAdmin,
    devicesController.deleteReceivedDevice
  );
}
