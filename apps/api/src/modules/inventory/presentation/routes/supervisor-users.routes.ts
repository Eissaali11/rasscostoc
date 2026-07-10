import type { Express } from "express";
import { requireAuth, requireSupervisor } from "@core/middlewares/auth.middleware";
import { supervisorUsersContainer } from "@server/composition/supervisor-users.container";

/**
 * Supervisor User Detail & Inventories - تفاصيل المستخدم ومخزونه (<100 سطر)
 */
export function registerSupervisorUsersRoutes(app: Express): void {
  // عرض تفاصيل مستخدم في المنطقة
  app.get("/api/supervisor/users/:userId", requireAuth, requireSupervisor, async (req, res) => {
    try {
      const user = (req as any).user;
      const targetUser = await supervisorUsersContainer.supervisorUsersReadUseCase.getUserDetails({
        supervisorRegionId: user.regionId,
        targetUserId: req.params.userId,
      });
      res.json(targetUser);
    } catch (error: any) {
      if (error && typeof error.statusCode === 'number') {
        return res.status(error.statusCode).json({ message: error.message });
      }

      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // عرض المخزون الثابت للمندوب
  app.get("/api/supervisor/users/:userId/fixed-inventory", requireAuth, requireSupervisor, async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await supervisorUsersContainer.supervisorUsersReadUseCase.getUserFixedInventory({
        supervisorRegionId: user.regionId,
        targetUserId: req.params.userId,
      });

      res.json(result);
    } catch (error: any) {
      if (error && typeof error.statusCode === 'number') {
        return res.status(error.statusCode).json({ message: error.message });
      }

      console.error("Error fetching fixed inventory:", error);
      res.status(500).json({ message: "Failed to fetch fixed inventory" });
    }
  });

  // عرض المخزون المتنقل للمندوب
  app.get("/api/supervisor/users/:userId/moving-inventory", requireAuth, requireSupervisor, async (req, res) => {
    try {
      const user = (req as any).user;
      const inventory = await supervisorUsersContainer.supervisorUsersReadUseCase.getUserMovingInventory({
        supervisorRegionId: user.regionId,
        targetUserId: req.params.userId,
      });
      res.json(inventory);
    } catch (error: any) {
      if (error && typeof error.statusCode === 'number') {
        return res.status(error.statusCode).json({ message: error.message });
      }

      console.error("Error fetching moving inventory:", error);
      res.status(500).json({ message: "Failed to fetch moving inventory" });
    }
  });
}
