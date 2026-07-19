import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import type { WarehouseTransferService } from "../../infrastructure/services/warehouse-transfer.service";
import type {
  AcceptWarehouseTransferUseCase,
  RejectWarehouseTransferUseCase,
} from "../../application/inventory/use-cases/WarehouseTransferOperations.use-case";

export class WarehouseTransferController {
  constructor(
    private readonly warehouseTransferService: WarehouseTransferService,
    private readonly acceptWarehouseTransferUseCase: AcceptWarehouseTransferUseCase,
    private readonly rejectWarehouseTransferUseCase: RejectWarehouseTransferUseCase
  ) {}

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const transfer = await this.warehouseTransferService.getWarehouseTransferById(id);

    if (!transfer) {
      return res.status(404).json({ message: "الطلب غير موجود" });
    }

    const user = req.user!;
    if (user.role !== "admin" && user.role !== "supervisor" && transfer.technicianId !== user.id) {
      return res.status(403).json({ message: "غير مصرح لك بتحديث حالة هذا الطلب" });
    }

    const status = String(req.body?.status || "").toLowerCase();
    if (status === "approved" || status === "accepted") {
      const result = await this.acceptWarehouseTransferUseCase.execute({
        transferId: id,
      });
      return res.json(result);
    }
    if (status === "rejected") {
      const reason = typeof req.body?.reason === "string" ? req.body.reason : "Rejected via status endpoint";
      const result = await this.rejectWarehouseTransferUseCase.execute({
        transferId: id,
        reason,
      });
      return res.json(result);
    }

    return res.status(400).json({ message: "Invalid status. Use approved|accepted|rejected" });
  });

  accept = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const transfer = await this.warehouseTransferService.getWarehouseTransferById(id);

    if (!transfer) {
      return res.status(404).json({ message: "الطلب غير موجود" });
    }

    const user = req.user!;
    if (user.role !== "admin" && user.role !== "supervisor" && transfer.technicianId !== user.id) {
      return res.status(403).json({ message: "غير مصرح لك بقبول هذا الطلب" });
    }

    const result = await this.acceptWarehouseTransferUseCase.execute({
      transferId: id,
    });
    res.json(result);
  });

  reject = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const transfer = await this.warehouseTransferService.getWarehouseTransferById(id);

    if (!transfer) {
      return res.status(404).json({ message: "الطلب غير موجود" });
    }

    const user = req.user!;
    if (user.role !== "admin" && user.role !== "supervisor" && transfer.technicianId !== user.id) {
      return res.status(403).json({ message: "غير مصرح لك برفض هذا الطلب" });
    }

    const { reason } = req.body;
    const result = await this.rejectWarehouseTransferUseCase.execute({
      transferId: id,
      reason,
    });
    res.json(result);
  });

  scanSerial = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const transferId = req.params.id;
    const { serialNumber } = req.body;

    if (!serialNumber || typeof serialNumber !== "string" || !serialNumber.trim()) {
      return res.status(400).json({ message: "الرقم التسلسلي مطلوب" });
    }

    const transfer = await this.warehouseTransferService.getWarehouseTransferById(transferId);
    if (!transfer) {
      return res.status(404).json({ message: "الطلب غير موجود" });
    }

    if (user.role !== "admin" && user.role !== "supervisor" && transfer.technicianId !== user.id) {
      return res.status(403).json({ message: "غير مصرح لك بمسح الأرقام التسلسلية لهذا الطلب" });
    }

    if (transfer.status !== "accepted") {
      return res.status(400).json({ message: "يجب قبول الطلب أولاً قبل بدء المسح" });
    }

    const result = await this.warehouseTransferService.scanSerial(
      user.id,
      transferId,
      serialNumber,
      transfer.itemType
    );
    res.status(200).json(result);
  });

  confirmReceipt = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const transferId = req.params.id;

    const transfer = await this.warehouseTransferService.getWarehouseTransferById(transferId);
    if (!transfer) {
      return res.status(404).json({ message: "الطلب غير موجود" });
    }

    if (user.role !== "admin" && user.role !== "supervisor" && transfer.technicianId !== user.id) {
      return res.status(403).json({ message: "غير مصرح لك بتأكيد استلام هذا الطلب" });
    }

    if (transfer.status !== "accepted") {
      return res.status(400).json({ message: "الطلب يجب أن يكون مقبولاً ليتم تأكيد استلامه" });
    }

    const result = await this.warehouseTransferService.confirmReceipt(
      user.id,
      transferId,
      transfer.itemType,
      transfer.quantity,
      transfer.packagingType
    );
    res.status(200).json(result);
  });

  getTechnicianSerializedItems = asyncHandler(async (req: Request, res: Response) => {
    const { technicianId } = req.params;
    const items = await this.warehouseTransferService.getTechnicianSerializedItems(technicianId);
    res.json(items);
  });

  getTechnicianDeliveredItems = asyncHandler(async (req: Request, res: Response) => {
    const { technicianId } = req.params;
    const itemTypeId = typeof req.query.itemTypeId === "string" ? req.query.itemTypeId : undefined;
    const items = await this.warehouseTransferService.getTechnicianDeliveredItems(technicianId, itemTypeId);
    res.json(items);
  });

  lookupSerial = asyncHandler(async (req: Request, res: Response) => {
    const { serialNumber } = req.params;
    const result = await this.warehouseTransferService.lookupItemBySerial(serialNumber);

    if (!result) {
      return res.status(404).json({ message: `لم يُعثر على سيريال: ${serialNumber}` });
    }

    res.json(result);
  });

  updateItemStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, orderNumber, warehouseId } = req.body;
    const adminId = req.user!.id;

    if (!status) {
      return res.status(400).json({ message: "الحالة مطلوبة" });
    }

    const result = await this.warehouseTransferService.updateItemStatus(
      adminId,
      id,
      status,
      orderNumber,
      warehouseId
    );
    res.json(result);
  });
}
