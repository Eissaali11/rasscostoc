/**
 * Dashboard controller
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { SystemAnalyticsService } from "@modules/inventory/application/analytics.service";
import { db } from "@core/config/db";
import { warehouses, itemTypes, users } from "@shared/schema";
import { eq, and, sql, count } from "drizzle-orm";

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

  /**
   * GET /api/public/stock
   * Public stats and product catalog for the landing page
   */
  getPublicStock = asyncHandler(async (req: Request, res: Response) => {
    const [warehousesCount] = await db.select({ count: count() }).from(warehouses);
    const [itemTypesCount] = await db.select({ count: count() }).from(itemTypes).where(and(eq(itemTypes.isActive, true), eq(itemTypes.isVisible, true)));
    const [techniciansCount] = await db.select({ count: count() }).from(users).where(eq(users.role, "technician"));
    
    const citiesResult = await db.select({
      count: sql<number>`COUNT(DISTINCT ${users.city})`
    }).from(users).where(sql`${users.city} IS NOT NULL AND ${users.city} != ''`);
    const citiesCount = Number(citiesResult[0]?.count || 0);

    const products = await db.select()
      .from(itemTypes)
      .where(and(eq(itemTypes.isActive, true), eq(itemTypes.isVisible, true)))
      .orderBy(itemTypes.sortOrder, itemTypes.nameAr);

    res.json({
      stats: {
        warehouses: warehousesCount.count,
        products: itemTypesCount.count,
        technicians: techniciansCount.count,
        cities: citiesCount || 29
      },
      products: products.map(p => ({
        id: p.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        category: p.category,
        icon: p.icon,
        color: p.color
      }))
    });
  });
}

export const dashboardController = new DashboardController();
