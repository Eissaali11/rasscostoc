/**
 * Inventory controller
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { insertInventoryItemSchema } from "@shared/schema";
import { z } from "zod";
import { NotFoundError } from "@core/errors/AppError";
import type { InventoryService } from "@modules/inventory/infrastructure/services/inventory.service";
import type { AddInventoryStockUseCase } from "@modules/inventory/application/inventory/use-cases/AddInventoryStock.use-case";
import type { WithdrawInventoryStockUseCase } from "@modules/inventory/application/inventory/use-cases/WithdrawInventoryStock.use-case";

export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly addInventoryStockUseCase: AddInventoryStockUseCase,
    private readonly withdrawInventoryStockUseCase: WithdrawInventoryStockUseCase
  ) {}

  /**
   * GET /api/inventory
   * Get all inventory items
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const items = await this.inventoryService.getInventoryItems();
    res.json(items);
  });

  /**
   * GET /api/inventory/:id
   * Get single inventory item
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await this.inventoryService.getInventoryItem(req.params.id);
    if (!item) {
      throw new NotFoundError("Item not found");
    }
    res.json(item);
  });

  /**
   * POST /api/inventory
   * Create new inventory item
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = insertInventoryItemSchema.parse(req.body);
    const item = await this.inventoryService.createInventoryItem(validatedData);
    res.status(201).json(item);
  });

  /**
   * PATCH /api/inventory/:id
   * Update inventory item
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const updates = insertInventoryItemSchema.partial().parse(req.body);
    const item = await this.inventoryService.updateInventoryItem(req.params.id, updates);
    res.json(item);
  });

  /**
   * DELETE /api/inventory/:id
   * Delete inventory item
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const deleted = await this.inventoryService.deleteInventoryItem(req.params.id);
    if (!deleted) {
      throw new NotFoundError("Item not found");
    }
    res.json({ message: "Item deleted successfully" });
  });

  /**
   * POST /api/inventory/:id/add
   * Add stock to inventory item
   */
  addStock = asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      quantity: z.number().positive(),
      reason: z.string().optional(),
    });
    const { quantity, reason } = schema.parse(req.body);
    const userId = req.user!.id;
    const item = await this.addInventoryStockUseCase.execute({
      itemId: req.params.id,
      quantity,
      reason,
      userId,
    });
    res.json(item);
  });

  /**
   * POST /api/inventory/:id/withdraw
   * Withdraw stock from inventory item
   */
  withdrawStock = asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      quantity: z.number().positive(),
      reason: z.string().optional(),
    });
    const { quantity, reason } = schema.parse(req.body);
    const userId = req.user!.id;
    const item = await this.withdrawInventoryStockUseCase.execute({
      itemId: req.params.id,
      quantity,
      reason,
      userId,
    });
    res.json(item);
  });
}
