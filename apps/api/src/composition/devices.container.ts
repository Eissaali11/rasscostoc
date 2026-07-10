import { repositories } from "@modules/inventory/infrastructure/database";
import { DevicesService } from "@modules/inventory/application/devices.service";
import { DevicesController } from "@modules/inventory/presentation/controllers/devices.controller";

class DevicesContainer {
  readonly devicesService = new DevicesService(repositories.devices);

  readonly devicesController = new DevicesController(
    this.devicesService,
    repositories.systemLogs
  );
}

export const devicesContainer = new DevicesContainer();
export default devicesContainer;
