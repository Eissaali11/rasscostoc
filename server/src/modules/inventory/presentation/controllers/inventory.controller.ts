/**
 * Inventory controller
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { validateBody, validateParams } from "@core/middlewares/validation";
import { insertInventoryItemSchema } from "@shared/schema";
import { z } from "zod";
import { NotFoundError } from "@core/errors/AppError";
import * as inventoryRepository from "@modules/inventory/infrastructure/database/inventory.repo";
import { inventoryContainer } from "@server/composition/inventory.container";

export class InventoryController {
  /**
   * GET /api/inventory
   * Get all inventory items
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const items = await inventoryRepository.getInventoryItems();
    res.json(items);
  });

  /**
   * GET /api/inventory/:id
   * Get single inventory item
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await inventoryRepository.getInventoryItem(req.params.id);
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
    const item = await inventoryRepository.createInventoryItem(validatedData);
    res.status(201).json(item);
  });

  /**
   * PATCH /api/inventory/:id
   * Update inventory item
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const updates = insertInventoryItemSchema.partial().parse(req.body);
    const item = await inventoryRepository.updateInventoryItem(req.params.id, updates);
    res.json(item);
  });

  /**
   * DELETE /api/inventory/:id
   * Delete inventory item
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const deleted = await inventoryRepository.deleteInventoryItem(req.params.id);
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
    const item = await inventoryContainer.addInventoryStockUseCase.execute({
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
    const item = await inventoryContainer.withdrawInventoryStockUseCase.execute({
      itemId: req.params.id,
      quantity,
      reason,
      userId,
    });
    res.json(item);
  });
}

export const inventoryController = new InventoryController();
