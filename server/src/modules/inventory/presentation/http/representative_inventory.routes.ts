import { Router } from "express";
import { RepresentativeInventoryController } from "./RepresentativeInventory.controller";
import { SyncRepresentativeInventoryUseCase } from "../../application/inventory/use-cases/SyncRepresentativeInventory.use-case";
import { CreateRepresentativeSaleUseCase } from "../../application/inventory/use-cases/CreateRepresentativeSale.use-case";
import type { IInventoryV2UnitOfWork } from "../../application/inventory/contracts/IInventoryV2UnitOfWork";
import { requireAuth } from "../../../../core/middlewares/auth.middleware";

export class RepresentativeInventoryRouter {
  private readonly controller: RepresentativeInventoryController;

  constructor(private readonly unitOfWork: IInventoryV2UnitOfWork) {
    const syncUseCase = new SyncRepresentativeInventoryUseCase(this.unitOfWork);
    const createSaleUseCase = new CreateRepresentativeSaleUseCase(this.unitOfWork);
    this.controller = new RepresentativeInventoryController(syncUseCase, createSaleUseCase);
  }

  register(router: Router): void {
    router.get(
      "/representative/inventory/sync/:technicianId?",
      requireAuth,
      this.controller.syncInventory
    );

    router.post(
      "/representative/inventory/sale",
      requireAuth,
      this.controller.createSale
    );
  }
}
