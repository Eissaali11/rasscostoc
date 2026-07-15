import { AddInventoryStockUseCase } from "@modules/inventory/application/inventory/use-cases/AddInventoryStock.use-case";
import { AcceptBulkWarehouseTransfersUseCase } from "@modules/inventory/application/inventory/use-cases/AcceptBulkWarehouseTransfers.use-case";
import { AcceptWarehouseTransferBatchUseCase } from "@modules/inventory/application/inventory/use-cases/AcceptWarehouseTransferBatch.use-case";
import { DeleteWarehouseTransfersUseCase } from "@modules/inventory/application/inventory/use-cases/DeleteWarehouseTransfers.use-case";
import { GetStockMovementsUseCase } from "@modules/inventory/application/inventory/use-cases/GetStockMovements.use-case";
import { GetWarehouseInventoryUseCase } from "@modules/inventory/application/inventory/use-cases/GetWarehouseInventory.use-case";
import {
  AcceptWarehouseTransferByRequestIdUseCase,
  RejectBulkWarehouseTransfersUseCase,
  RejectWarehouseTransferBatchUseCase,
  RejectWarehouseTransferByRequestIdUseCase,
} from "@modules/inventory/application/inventory/use-cases/WarehouseTransferBatchRejection.use-case";
import {
  AcceptWarehouseTransferUseCase,
  CreateWarehouseTransfersUseCase,
  GetWarehouseTransfersUseCase,
  RejectWarehouseTransferUseCase,
} from "@modules/inventory/application/inventory/use-cases/WarehouseTransferOperations.use-case";
import { TransferStockUseCase } from "@modules/inventory/application/inventory/use-cases/TransferStock.use-case";
import { WithdrawInventoryStockUseCase } from "@modules/inventory/application/inventory/use-cases/WithdrawInventoryStock.use-case";
import { DrizzleInventoryUnitOfWork } from "@modules/inventory/infrastructure/database/DrizzleInventoryUnitOfWork";
import { DrizzleWarehouseTransferOperationsRepository } from "@modules/inventory/infrastructure/database/DrizzleWarehouseTransferOperationsRepository";
import { InventoryService } from "@modules/inventory/infrastructure/services/inventory.service";
import { InventoryController } from "@modules/inventory/presentation/controllers/inventory.controller";
import { WarehouseTransferService } from "@modules/inventory/infrastructure/services/warehouse-transfer.service";
import { WarehouseTransferController } from "@modules/inventory/presentation/controllers/warehouse-transfer.controller";

class InventoryContainer {
  private readonly unitOfWork = new DrizzleInventoryUnitOfWork();
  private readonly warehouseTransferOperationsRepository = new DrizzleWarehouseTransferOperationsRepository();
  readonly inventoryService = new InventoryService();

  readonly addInventoryStockUseCase = new AddInventoryStockUseCase(this.unitOfWork);
  readonly withdrawInventoryStockUseCase = new WithdrawInventoryStockUseCase(this.unitOfWork);
  readonly transferStockUseCase = new TransferStockUseCase(this.unitOfWork);
  readonly acceptWarehouseTransferBatchUseCase = new AcceptWarehouseTransferBatchUseCase(this.unitOfWork);
  readonly acceptBulkWarehouseTransfersUseCase = new AcceptBulkWarehouseTransfersUseCase(this.unitOfWork);
  readonly deleteWarehouseTransfersUseCase = new DeleteWarehouseTransfersUseCase(this.unitOfWork);
  readonly rejectWarehouseTransferBatchUseCase = new RejectWarehouseTransferBatchUseCase(this.unitOfWork);
  readonly rejectBulkWarehouseTransfersUseCase = new RejectBulkWarehouseTransfersUseCase(this.unitOfWork);
  readonly acceptWarehouseTransferByRequestIdUseCase = new AcceptWarehouseTransferByRequestIdUseCase(
    this.unitOfWork,
    this.acceptWarehouseTransferBatchUseCase
  );
  readonly rejectWarehouseTransferByRequestIdUseCase = new RejectWarehouseTransferByRequestIdUseCase(
    this.unitOfWork,
    this.rejectWarehouseTransferBatchUseCase
  );
  readonly getStockMovementsUseCase = new GetStockMovementsUseCase(this.unitOfWork);
  readonly getWarehouseInventoryUseCase = new GetWarehouseInventoryUseCase(this.unitOfWork);
  readonly getWarehouseTransfersUseCase = new GetWarehouseTransfersUseCase(this.warehouseTransferOperationsRepository);
  readonly createWarehouseTransfersUseCase = new CreateWarehouseTransfersUseCase(this.warehouseTransferOperationsRepository);
  readonly acceptWarehouseTransferUseCase = new AcceptWarehouseTransferUseCase(this.warehouseTransferOperationsRepository);
  readonly rejectWarehouseTransferUseCase = new RejectWarehouseTransferUseCase(this.warehouseTransferOperationsRepository);

  readonly inventoryController = new InventoryController(
    this.inventoryService,
    this.addInventoryStockUseCase,
    this.withdrawInventoryStockUseCase
  );

  readonly warehouseTransferService = new WarehouseTransferService();
  readonly warehouseTransferController = new WarehouseTransferController(this.warehouseTransferService);
}

export const inventoryContainer = new InventoryContainer();
