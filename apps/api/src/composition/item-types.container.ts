import { ItemTypesService } from "@modules/inventory/infrastructure/services/item-types.service";
import { CreateItemTypeUseCase } from "@modules/inventory/application/item-types/use-cases/CreateItemType.use-case";
import { ItemTypesController } from "@modules/inventory/presentation/controllers/item-types.controller";
import type { InsertItemType } from "@shared/schema";

class ItemTypesContainer {
  readonly itemTypesService = new ItemTypesService();

  readonly createItemTypeUseCase = new CreateItemTypeUseCase({
    getById: (id: string) => this.itemTypesService.getItemTypeById(id),
    getAll: () => this.itemTypesService.getItemTypes(),
    create: (data: InsertItemType) => this.itemTypesService.createItemType(data),
  });

  readonly itemTypesController = new ItemTypesController(
    this.itemTypesService,
    this.createItemTypeUseCase
  );
}

export const itemTypesContainer = new ItemTypesContainer();
export default itemTypesContainer;
