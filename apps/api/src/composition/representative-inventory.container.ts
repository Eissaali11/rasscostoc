import { DrizzleInventoryV2UnitOfWork } from "@modules/inventory/infrastructure/database/DrizzleInventoryV2UnitOfWork";
import { RepresentativeInventoryRouter } from "@modules/inventory/presentation/http/representative_inventory.routes";

class RepresentativeInventoryContainer {
  private readonly unitOfWork = new DrizzleInventoryV2UnitOfWork();

  readonly representativeRouter = new RepresentativeInventoryRouter(this.unitOfWork);
}

export const representativeInventoryContainer = new RepresentativeInventoryContainer();
export default representativeInventoryContainer;
