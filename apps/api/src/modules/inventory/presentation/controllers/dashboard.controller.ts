/**
 * Dashboard controller
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import type { SystemAnalyticsService } from "@modules/inventory/infrastructure/services/analytics.service";

export class DashboardController {
  constructor(
    private readonly analyticsService: SystemAnalyticsService
  ) {}

  /**
   * GET /api/dashboard
   * Get dashboard statistics
   */
  getStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.analyticsService.getDashboardStats();
    res.json(stats);
  });

  /**
   * GET /api/admin/stats
   * Get admin statistics
   */
  getAdminStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.analyticsService.getAdminStats();
    res.json(stats);
  });

  /**
   * GET /api/public/stock
   * Public stats and product catalog for the landing page
   */
  getPublicStock = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.analyticsService.getPublicStock();
    res.json(data);
  });
}
