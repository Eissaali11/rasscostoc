import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { insertWarehouseSchema } from "@shared/schema";
import { NotFoundError } from "@core/errors/AppError";
import { z } from "zod";
import type { IWarehouseRepository } from "../../application/warehouse/contracts/IWarehouseRepository";
import type { IWarehouseInventoryRepository } from "../../application/warehouse/contracts/IWarehouseInventoryRepository";
import type { ISystemLogsRepository } from "../../application/system-logs/contracts/ISystemLogsRepository";
import type { GetSupervisorWarehousesUseCase } from "../../application/warehouses/use-cases/GetSupervisorWarehouses.use-case";

export class WarehousesController {
  constructor(
    private readonly warehouseRepository: IWarehouseRepository,
    private readonly warehouseInventoryRepository: IWarehouseInventoryRepository,
    private readonly systemLogsRepository: ISystemLogsRepository,
    private readonly getSupervisorWarehousesUseCase: GetSupervisorWarehousesUseCase,
  ) {}

  /**
   * GET /api/warehouses
   * Get all warehouses (admin)
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const warehouses = await this.warehouseRepository.getWarehouses();
    res.json(warehouses);
  });

  /**
   * GET /api/supervisor/warehouses
   * Get warehouses for supervisor
   */
  getSupervisorWarehouses = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const warehouses = await this.getSupervisorWarehousesUseCase.execute({
      supervisorId: user.id,
      regionId: user.regionId,
    });
    res.json(warehouses);
  });

  /**
   * GET /api/warehouses/:id
   * Get single warehouse with inventory
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const warehouse = await this.warehouseRepository.getWarehouse(req.params.id);
    if (!warehouse) {
      throw new NotFoundError("Warehouse not found");
    }
    res.json(warehouse);
  });

  /**
   * POST /api/warehouses
   * Create new warehouse
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const validatedData = insertWarehouseSchema.parse(req.body);
    const warehouse = await this.warehouseRepository.createWarehouse(validatedData, user.id);

    // Log the activity
    await this.systemLogsRepository.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: warehouse.regionId,
      action: "create",
      entityType: "warehouse",
      entityId: warehouse.id,
      entityName: warehouse.name,
      description: `تم إنشاء مستودع جديد: ${warehouse.name}`,
      severity: "info",
      success: true,
    });

    res.status(201).json(warehouse);
  });

  /**
   * PUT /api/warehouses/:id
   * Update warehouse
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const updates = insertWarehouseSchema.partial().parse(req.body);
    const warehouse = await this.warehouseRepository.updateWarehouse(req.params.id, updates);

    // Log the activity
    await this.systemLogsRepository.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: warehouse.regionId,
      action: "update",
      entityType: "warehouse",
      entityId: warehouse.id,
      entityName: warehouse.name,
      description: `تم تحديث مستودع: ${warehouse.name}`,
      severity: "info",
      success: true,
    });

    res.json(warehouse);
  });

  /**
   * DELETE /api/warehouses/:id
   * Delete warehouse
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const warehouse = await this.warehouseRepository.getWarehouse(req.params.id);
    if (!warehouse) {
      throw new NotFoundError("Warehouse not found");
    }

    const deleted = await this.warehouseRepository.deleteWarehouse(req.params.id);
    if (!deleted) {
      throw new NotFoundError("Warehouse not found");
    }

    // Log the activity
    await this.systemLogsRepository.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: warehouse.regionId,
      action: "delete",
      entityType: "warehouse",
      entityId: req.params.id,
      entityName: warehouse.name,
      description: `تم حذف مستودع: ${warehouse.name}`,
      severity: "warn",
      success: true,
    });

    res.json({ message: "Warehouse deleted successfully" });
  });

  /**
   * GET /api/warehouse-inventory/:warehouseId
   * Get warehouse inventory
   */
  getInventory = asyncHandler(async (req: Request, res: Response) => {
    const inventory = await this.warehouseRepository.getWarehouseInventory(req.params.warehouseId);
    res.json(inventory);
  });

  /**
   * PUT /api/warehouse-inventory/:warehouseId
   * Update warehouse inventory
   */
  updateInventory = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const updates = req.body;
    const inventory = await this.warehouseRepository.updateWarehouseInventory(
      req.params.warehouseId,
      updates
    );

    // Log the activity
    await this.systemLogsRepository.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: null,
      action: "update",
      entityType: "warehouse",
      entityId: req.params.warehouseId,
      entityName: "مخزون المستودع",
      description: `تم تحديث مخزون المستودع`,
      severity: "info",
      success: true,
    });

    res.json(inventory);
  });

  /**
   * GET /api/warehouses/:warehouseId/inventory-entries
   * Get warehouse inventory entries (dynamic)
   */
  getInventoryEntries = asyncHandler(async (req: Request, res: Response) => {
    const entries = await this.warehouseInventoryRepository.getWarehouseInventoryEntries(req.params.warehouseId);
    res.json(entries);
  });

  /**
   * POST /api/warehouses/:warehouseId/inventory-entries
   * Upsert warehouse inventory entry
   */
  upsertInventoryEntry = asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      itemTypeId: z.string(),
      boxes: z.number().min(0),
      units: z.number().min(0),
    });
    const data = schema.parse(req.body);
    const entry = await this.warehouseInventoryRepository.upsertWarehouseInventoryEntry(
      req.params.warehouseId,
      data.itemTypeId,
      data.boxes,
      data.units
    );
    res.json(entry);
  });
}
