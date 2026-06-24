/**
 * Devices controller (Withdrawn & Received)
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import {
  insertWithdrawnDeviceSchema,
  insertReceivedDeviceSchema,
} from "@shared/schema";
import { ROLES } from "@shared/roles";
import { AuthorizationError, NotFoundError } from "@core/errors/AppError";
import { z } from "zod";
import { repositories } from "@modules/inventory/infrastructure/database";
import { DevicesService } from "@modules/inventory/application/devices.service";

const devicesService = new DevicesService();

export class DevicesController {
  /**
   * GET /api/withdrawn-devices
   * Get all withdrawn devices
   */
  getWithdrawnDevices = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    let devices;

    if (user.role === "supervisor" && user.regionId) {
      devices = await devicesService.getWithdrawnDevicesByRegion(user.regionId);
    } else {
      devices = await devicesService.getWithdrawnDevices();
    }

    res.json(devices);
  });

  /**
   * GET /api/withdrawn-devices/:id
   * Get single withdrawn device
   */
  getWithdrawnDevice = asyncHandler(async (req: Request, res: Response) => {
    const device = await devicesService.getWithdrawnDevice(req.params.id);
    if (!device) {
      throw new NotFoundError("Device not found");
    }
    res.json(device);
  });

  /**
   * POST /api/withdrawn-devices
   * Create withdrawn device
   */
  createWithdrawnDevice = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const validatedData = insertWithdrawnDeviceSchema.parse(req.body);
    
    const device = await devicesService.createWithdrawnDevice({
      ...validatedData,
      createdBy: user.id,
      regionId: user.regionId,
    });

    // Log the activity
    await repositories.systemLogs.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: user.regionId,
      action: "create",
      entityType: "device",
      entityId: device.id,
      entityName: device.serialNumber,
      description: `تم سحب جهاز: ${device.serialNumber}`,
      severity: "info",
      success: true,
    });

    res.status(201).json(device);
  });

  /**
   * PATCH /api/withdrawn-devices/:id
   * Update withdrawn device
   */
  updateWithdrawnDevice = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const updates = insertWithdrawnDeviceSchema.partial().parse(req.body);
    const device = await devicesService.updateWithdrawnDevice(req.params.id, updates);

    // Log the activity
    await repositories.systemLogs.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: device.regionId,
      action: "update",
      entityType: "device",
      entityId: device.id,
      entityName: device.serialNumber,
      description: `تم تحديث جهاز مسحوب: ${device.serialNumber}`,
      severity: "info",
      success: true,
    });

    res.json(device);
  });

  /**
   * DELETE /api/withdrawn-devices/:id
   * Delete withdrawn device
   */
  deleteWithdrawnDevice = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const device = await devicesService.getWithdrawnDevice(req.params.id);
    if (!device) {
      throw new NotFoundError("Device not found");
    }

    const deleted = await devicesService.deleteWithdrawnDevice(req.params.id);
    if (!deleted) {
      throw new NotFoundError("Device not found");
    }

    // Log the activity
    await repositories.systemLogs.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: device.regionId,
      action: "delete",
      entityType: "device",
      entityId: req.params.id,
      entityName: device.serialNumber,
      description: `تم حذف جهاز مسحوب: ${device.serialNumber}`,
      severity: "warn",
      success: true,
    });

    res.json({ message: "Device deleted successfully" });
  });

  /**
   * GET /api/received-devices
   * Get received devices
   */
  getReceivedDevices = asyncHandler(async (req: Request, res: Response) => {
    const { status, technicianId, supervisorId, regionId } = req.query;
    const user = req.user!;

    const filters: any = {
      status: status as string,
      technicianId: technicianId as string,
      supervisorId: supervisorId as string,
      regionId: (regionId as string) || (user.role === "supervisor" ? user.regionId : undefined),
    };

    const devices = await devicesService.getReceivedDevices(filters);
    res.json(devices);
  });

  /**
   * GET /api/received-devices/pending/count
   * Get count of pending received devices
   */
  getPendingReceivedDevicesCount = asyncHandler(
    async (req: Request, res: Response) => {
      const user = req.user!;
      const supervisorId = user.role === "supervisor" ? user.id : undefined;
      const regionId = user.role === "supervisor" ? user.regionId : undefined;

      const count = await devicesService.getPendingReceivedDevicesCount(
        supervisorId,
        regionId
      );
      res.json({ count });
    }
  );

  /**
   * GET /api/received-devices/:id
   * Get single received device
   */
  getReceivedDevice = asyncHandler(async (req: Request, res: Response) => {
    const device = await devicesService.getReceivedDevice(req.params.id);
    if (!device) {
      throw new NotFoundError("Device not found");
    }
    res.json(device);
  });

  /**
   * POST /api/received-devices
   * Create received device
   */
  createReceivedDevice = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const validatedData = insertReceivedDeviceSchema.parse({
      ...req.body,
      technicianId: req.body.technicianId || user.id,
      regionId: req.body.regionId || user.regionId,
    });

    const device = await devicesService.createReceivedDevice({
      ...validatedData,
      supervisorId: user.role === "supervisor" ? user.id : null,
    });

    // Log the activity
    await repositories.systemLogs.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: user.regionId,
      action: "create",
      entityType: "device",
      entityId: device.id,
      entityName: device.serialNumber,
      description: `تم استلام جهاز: ${device.serialNumber}`,
      severity: "info",
      success: true,
    });

    res.status(201).json(device);
  });

  /**
   * POST /api/received-devices/:id/delivery-proof
   * Upload delivery proof from technician mobile app
   */
  uploadReceivedDeviceDeliveryProof = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;

    if (user.role !== ROLES.TECHNICIAN) {
      throw new AuthorizationError("هذه العملية متاحة للمندوب فقط");
    }

    const schema = z
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
        message: "يجب إرفاق ملف تسليم واحد على الأقل",
        path: ["fileUrl"],
      });

    const payload = schema.parse(req.body);

    const device = await devicesService.getReceivedDevice(req.params.id);
    if (!device) {
      throw new NotFoundError("Device not found");
    }

    if (device.technicianId && device.technicianId !== user.id) {
      throw new AuthorizationError("لا يمكنك رفع ملف تسليم لجهاز لا يتبع عهدتك");
    }

    const deliveredAt = payload.deliveredAt || new Date().toISOString();

    const primaryFileUrl = payload.fileUrl || payload.receiptFormFileUrl || "";
    const primaryFileName = payload.fileName || payload.receiptFormFileName;

    await repositories.systemLogs.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: device.regionId || user.regionId,
      action: "delivery_proof",
      entityType: "device",
      entityId: device.id,
      entityName: device.serialNumber,
      description: `تم رفع ملف تسليم الجهاز للعميل من تطبيق المندوب: ${device.serialNumber}`,
      details: JSON.stringify({
        fileUrl: primaryFileUrl,
        fileName: primaryFileName || null,
        receiptFormFileUrl: payload.receiptFormFileUrl || null,
        receiptFormFileName: payload.receiptFormFileName || null,
        customerName: payload.customerName || null,
        notes: payload.notes || null,
        deliveredAt,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        source: "mobile_app",
        targetRole: "supervisor",
        reviewRequired: true,
      }),
      severity: "info",
      success: true,
    });

    res.json({
      success: true,
      message: "تم رفع ملف التسليم بنجاح",
      deviceId: device.id,
      serialNumber: device.serialNumber,
    });
  });

  /**
   * PATCH /api/received-devices/:id/status
   * Update received device status
   */
  updateReceivedDeviceStatus = asyncHandler(
    async (req: Request, res: Response) => {
      const user = req.user!;
      if (user.role !== ROLES.SUPERVISOR && user.role !== ROLES.ADMIN) {
        throw new AuthorizationError("اعتماد حالة الجهاز متاح للمشرف أو المدير فقط");
      }

      const schema = z.object({
        status: z.enum(["pending", "approved", "rejected"]),
        adminNotes: z.string().optional(),
      });
      const { status, adminNotes } = schema.parse(req.body);

      const device = await devicesService.updateReceivedDeviceStatus(
        req.params.id,
        status,
        user.id,
        adminNotes
      );

      // Log the activity
      await repositories.systemLogs.createSystemLog({
        userId: user.id,
        userName: user.username,
        userRole: user.role,
        regionId: device.regionId,
        action: status === "approved" ? "approve" : "reject",
        entityType: "device",
        entityId: device.id,
        entityName: device.serialNumber,
        description: `تم ${status === "approved" ? "الموافقة على" : "رفض"} استلام جهاز: ${device.serialNumber}`,
        severity: "info",
        success: true,
      });

      res.json(device);
    }
  );

  /**
   * DELETE /api/received-devices/:id
   * Delete received device
   */
  deleteReceivedDevice = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const device = await devicesService.getReceivedDevice(req.params.id);
    if (!device) {
      throw new NotFoundError("Device not found");
    }

    const deleted = await devicesService.deleteReceivedDevice(req.params.id);
    if (!deleted) {
      throw new NotFoundError("Device not found");
    }

    // Log the activity
    await repositories.systemLogs.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: device.regionId,
      action: "delete",
      entityType: "device",
      entityId: req.params.id,
      entityName: device.serialNumber,
      description: `تم حذف جهاز مستلم: ${device.serialNumber}`,
      severity: "warn",
      success: true,
    });

    res.json({ message: "Device deleted successfully" });
  });

  /**
   * POST /api/received-devices/deliver
   * Deliver device by barcode scan
   */
  deliverDevice = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const { barcode } = z.object({ barcode: z.string().trim().min(1) }).parse(req.body);

    const device = await devicesService.deliverDeviceByBarcode(user.id, barcode);

    // Log the activity
    await repositories.systemLogs.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: device.regionId,
      action: "deliver",
      entityType: "device",
      entityId: device.id,
      entityName: device.serialNumber,
      description: `تم تسليم الجهاز بالباركود بنجاح: ${device.serialNumber}`,
      severity: "info",
      success: true,
    });

    res.json({
      success: true,
      message: "تم تسليم الجهاز وتوريده بنجاح",
      device,
    });
  });
}

export const devicesController = new DevicesController();

