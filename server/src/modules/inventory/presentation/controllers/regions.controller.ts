/**
 * Regions controller
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { validateBody } from "@core/middlewares/validation";
import { insertRegionSchema } from "@shared/schema";
import { NotFoundError } from "@core/errors/AppError";
import { GetRegionsWithStatsUseCase } from "@modules/inventory/application/regions/use-cases/GetRegionsWithStats.use-case";
import { repositories } from "@modules/inventory/infrastructure/database";

const getRegionsWithStatsUseCase = new GetRegionsWithStatsUseCase(repositories.region);

export class RegionsController {
  /**
   * GET /api/regions
   * Get all regions
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const regions = await getRegionsWithStatsUseCase.execute();
    res.json(regions);
  });

  /**
   * GET /api/regions/:id
   * Get single region
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const region = await repositories.region.findById(req.params.id);
    if (!region) {
      throw new NotFoundError("Region not found");
    }
    res.json(region);
  });

  /**
   * POST /api/regions
   * Create new region
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const validatedData = insertRegionSchema.parse(req.body);
    const region = await repositories.region.create(validatedData);

    // Log the activity
    await repositories.systemLogs.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: null,
      action: "create",
      entityType: "region",
      entityId: region.id,
      entityName: region.name,
      description: `تم إنشاء منطقة جديدة: ${region.name}`,
      severity: "info",
      success: true,
    });

    res.status(201).json(region);
  });

  /**
   * PATCH /api/regions/:id
   * Update region
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const updates = insertRegionSchema.partial().parse(req.body);
    const region = await repositories.region.update(req.params.id, updates);

    // Log the activity
    await repositories.systemLogs.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: region.id,
      action: "update",
      entityType: "region",
      entityId: region.id,
      entityName: region.name,
      description: `تم تحديث منطقة: ${region.name}`,
      severity: "info",
      success: true,
    });

    res.json(region);
  });

  /**
   * DELETE /api/regions/:id
   * Delete region
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    // Get region name before deletion
    const region = await repositories.region.findById(req.params.id);
    const regionName = region?.name || "Unknown";

    const usersCount = await repositories.region.countUsersByRegionId(req.params.id);
    if (usersCount > 0) {
      throw new Error("Cannot delete region with existing users");
    }

    const deleted = await repositories.region.delete(req.params.id);
    if (!deleted) {
      throw new NotFoundError("Region not found");
    }

    // Log the activity
    await repositories.systemLogs.createSystemLog({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: req.params.id,
      action: "delete",
      entityType: "region",
      entityId: req.params.id,
      entityName: regionName,
      description: `تم حذف منطقة: ${regionName}`,
      severity: "warn",
      success: true,
    });

    res.json({ message: "Region deleted successfully" });
  });
}

export const regionsController = new RegionsController();
