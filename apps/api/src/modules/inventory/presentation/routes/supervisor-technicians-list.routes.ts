import type { Express } from "express";
import { requireAuth, requireSupervisor } from "@core/middlewares/auth.middleware";
import { techniciansContainer } from "@server/composition/technicians.container";
import { usersContainer } from "@server/composition/users.container";

/**
 * Supervisor Technicians List - عرض قوائم المندوبين (<100 سطر)
 */
export function registerSupervisorTechniciansListRoutes(app: Express): void {
  // عرض مخزون جميع المندوبين في المنطقة
  app.get("/api/supervisor/technicians-inventory", requireAuth, requireSupervisor, async (req, res) => {
    try {
      const user = (req as any).user;
      
      if (!user.regionId) {
        return res.status(400).json({ message: "المشرف يجب أن يكون مرتبط بمنطقة لعرض البيانات" });
      }
      
      const { technicians } = await techniciansContainer.getTechniciansInventoryByActorUseCase.execute({
        actor: {
          role: user.role,
          regionId: user.regionId,
        },
      });
      res.json({ technicians });
    } catch (error) {
      console.error("Error fetching region technicians inventory:", error);
      res.status(500).json({ message: "Failed to fetch region technicians inventory" });
    }
  });

  // عرض قائمة المندوبين في المنطقة
  app.get("/api/supervisor/technicians", requireAuth, requireSupervisor, async (req, res) => {
    try {
      const supervisor = (req as any).user;
      
      if (!supervisor.regionId) {
        return res.status(400).json({ message: "المشرف يجب أن يكون مرتبط بمنطقة" });
      }

      const allUsers = await usersContainer.userManagementUseCase.findByRegion(supervisor.regionId);
      
      // Filter technicians in supervisor's region
      const technicians = allUsers.filter(user => 
        user.role === 'technician' && user.regionId === supervisor.regionId
      );

      res.json(technicians);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      res.status(500).json({ message: "Failed to fetch technicians" });
    }
  });
}

