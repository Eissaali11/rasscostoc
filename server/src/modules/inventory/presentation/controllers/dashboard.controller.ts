/**
 * Dashboard controller
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { SystemAnalyticsService } from "@modules/inventory/application/analytics.service";

const analyticsService = new SystemAnalyticsService();

export class DashboardController {
  /**
   * GET /api/dashboard
   * Get dashboard statistics
   */
  getStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await analyticsService.getDashboardStats();
    res.json(stats);
  });

  /**
   * GET /api/admin/stats
   * Get admin statistics
   */
  getAdminStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await analyticsService.getAdminStats();
    res.json(stats);
  });
}

export const dashboardController = new DashboardController();
