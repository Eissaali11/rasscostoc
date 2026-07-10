import { SerializedItemsService } from "@modules/inventory/infrastructure/services/serialized-items.service";
import { SerializedItemsController } from "@modules/inventory/presentation/controllers/serialized-items.controller";

class SerializedItemsContainer {
  readonly serializedItemsService = new SerializedItemsService();

  readonly serializedItemsController = new SerializedItemsController(
    this.serializedItemsService
  );
}

export const serializedItemsContainer = new SerializedItemsContainer();
export default serializedItemsContainer;
