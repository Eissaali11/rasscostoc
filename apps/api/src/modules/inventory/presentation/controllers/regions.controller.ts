/**
 * Regions controller
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { insertRegionSchema } from "@shared/schema";
import { NotFoundError } from "@core/errors/AppError";
import type { GetRegionsWithStatsUseCase } from "@modules/inventory/application/regions/use-cases/GetRegionsWithStats.use-case";
import type { IRegionRepository } from "@modules/inventory/application/regions/contracts/IRegionRepository";
import type { ISystemLogsRepository } from "@modules/inventory/application/system-logs/contracts/ISystemLogsRepository";

export class RegionsController {
  constructor(
    private readonly regionRepository: IRegionRepository,
    private readonly systemLogsRepository: ISystemLogsRepository,
    private readonly getRegionsWithStatsUseCase: GetRegionsWithStatsUseCase
  ) {}

  /**
   * GET /api/regions
   * Get all regions
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const regions = await this.getRegionsWithStatsUseCase.execute();
    res.json(regions);
  });

  /**
   * GET /api/regions/:id
   * Get single region
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const region = await this.regionRepository.findById(req.params.id);
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
    const region = await this.regionRepository.create(validatedData);

    // Log the activity
    await this.systemLogsRepository.createSystemLog({
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
    const region = await this.regionRepository.update(req.params.id, updates);

    // Log the activity
    await this.systemLogsRepository.createSystemLog({
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
    const region = await this.regionRepository.findById(req.params.id);
    const regionName = region?.name || "Unknown";

    const usersCount = await this.regionRepository.countUsersByRegionId(req.params.id);
    if (usersCount > 0) {
      throw new Error("Cannot delete region with existing users");
    }

    const deleted = await this.regionRepository.delete(req.params.id);
    if (!deleted) {
      throw new NotFoundError("Region not found");
    }

    // Log the activity
    await this.systemLogsRepository.createSystemLog({
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
