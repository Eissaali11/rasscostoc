import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { supervisorRequestsContainer } from "@server/composition/supervisor-requests.container";

export class SupervisorRequestsController {
  /**
   * GET /api/supervisor/inventory-requests
   * Get supervisor inventory requests
   */
  getRequests = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    
    if (!user.regionId) {
      res.status(400).json({ message: "المشرف يجب أن يكون مرتبط بمنطقة لعرض البيانات" });
      return;
    }
    
    const requests = await supervisorRequestsContainer.getSupervisorRequestsUseCase.execute(user.regionId);
    res.json(requests);
  });

  /**
   * GET /api/supervisor/inventory-requests/pending/count
   * Get pending inventory requests count
   */
  getPendingCount = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    
    if (!user.regionId) {
      res.status(400).json({ message: "المشرف يجب أن يكون مرتبط بمنطقة لعرض البيانات" });
      return;
    }
    
    const pendingRequests = await supervisorRequestsContainer.getSupervisorRequestsUseCase.execute(user.regionId, "pending");
    res.json({ count: pendingRequests.length });
  });
}

export const supervisorRequestsController = new SupervisorRequestsController();
