import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { z } from "zod";
import type { SerializedItemsService } from "../../infrastructure/services/serialized-items.service";

const scanInSchema = z.object({
  serialNumber: z.string().trim().min(1, "الرقم التسلسلي مطلوب"),
  itemTypeId: z.string().trim().min(1, "نوع الصنف مطلوب"),
  carrierName: z.string().trim().optional(),
  simPackageType: z.string().trim().optional(),
});

const batchScanInSchema = z.object({
  items: z.array(
    z.object({
      serialNumber: z.string().trim().min(1, "الرقم التسلسلي مطلوب"),
      itemTypeId: z.string().trim().min(1, "نوع الصنف مطلوب"),
      carrierName: z.string().trim().optional(),
      simPackageType: z.string().trim().optional(),
    })
  ).min(1, "الرجاء إدخال مادة واحدة على الأقل"),
});

const scanOutSchema = z.object({
  serialNumber: z.string().trim().min(1, "الرقم التسلسلي مطلوب"),
  receiverName: z.string().trim().min(1, "اسم المستلم مطلوب"),
  orderNumber: z.string().trim().min(1, "رقم الطلب مطلوب"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export class SerializedItemsController {
  constructor(
    private readonly serializedItemsService: SerializedItemsService
  ) {}

  /**
   * POST /api/serialized-items/scan-in
   * Add item to technician's active custody
   */
  scanIn = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = scanInSchema.parse(req.body);

    const item = await this.serializedItemsService.scanIn(
      user.id,
      body.serialNumber,
      body.itemTypeId,
      body.carrierName,
      body.simPackageType
    );

    res.status(200).json({
      success: true,
      message: "تم تسجيل المادة في عهدتك بنجاح",
      data: item,
    });
  });

  /**
   * POST /api/serialized-items/batch-scan-in
   * Add multiple items to technician's active custody
   */
  batchScanIn = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = batchScanInSchema.parse(req.body);

    const items = await this.serializedItemsService.batchScanIn(
      user.id,
      body.items
    );

    res.status(200).json({
      success: true,
      message: `تم تسجيل ${items.length} من المواد في عهدتك بنجاح`,
      data: items,
    });
  });

  /**
   * POST /api/serialized-items/scan-out
   * Deliver item from technician's custody to customer
   */
  scanOut = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = scanOutSchema.parse(req.body);

    const item = await this.serializedItemsService.scanOut(
      user.id,
      body.serialNumber,
      body.receiverName,
      body.orderNumber,
      body.latitude,
      body.longitude
    );

    res.status(200).json({
      success: true,
      message: "تم تسليم المادة بنجاح وتحديث حالتها",
      data: item,
    });
  });

  /**
   * GET /api/serialized-items/lookup/:serialNumber
   * Retrieve item status, metadata, and history
   */
  lookup = asyncHandler(async (req: Request, res: Response) => {
    const { serialNumber } = req.params;
    if (!serialNumber) {
      return res.status(400).json({
        success: false,
        message: "الرقم التسلسلي مطلوب للبحث",
      });
    }

    const item = await this.serializedItemsService.lookup(serialNumber);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "المادة غير مسجلة في النظام كعهدة حالية",
      });
    }

    res.status(200).json({
      success: true,
      data: item,
    });
  });
}
