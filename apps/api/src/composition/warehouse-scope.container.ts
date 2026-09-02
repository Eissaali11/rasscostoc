import { repositories } from "@modules/inventory/infrastructure/database";
import { identityRepositories } from "@modules/identity/infrastructure/database";
import { AuthorizeWarehouseScopeUseCase } from "@modules/inventory/application/warehouse/use-cases/AuthorizeWarehouseScope.use-case";
import { AuthorizeWarehouseTransferMutationUseCase } from "@modules/inventory/application/warehouse/use-cases/AuthorizeWarehouseTransferMutation.use-case";
import { WarehouseTransferService } from "@modules/inventory/infrastructure/services/warehouse-transfer.service";

/**
 * OPS-PERM-S1-F1.R2.SR2/SR3 — composition for the single warehouse-scope seam.
 *
 * Both the read seam (AuthorizeWarehouseScopeUseCase) and the transfer-mutation
 * seam (AuthorizeWarehouseTransferMutationUseCase) are wired here from the SAME
 * warehouse reader and the SAME supervisor-relation reader, so a scope decision
 * cannot drift between a read path and a mutation path.
 *
 * The relation reader is identityRepositories.supervisor — the identity module
 * owns supervisor_warehouses, exactly as warehouses.container.ts already reads it
 * for GetSupervisorWarehousesUseCase.
 */
class WarehouseScopeContainer {
  /** Authoritative warehouse reader: region comes from the warehouses row, never
   * from the request. */
  private readonly warehouseRepository = {
    getWarehouse: async (id: string) => {
      const warehouse = await repositories.warehouse.getWarehouse(id);
      return warehouse ? { id: warehouse.id, regionId: warehouse.regionId ?? null } : undefined;
    },
  };

  /** Actor's own supervisor_warehouses relation rows. */
  private readonly supervisorAssignmentsRepository = {
    getSupervisorWarehouseIds: async (supervisorId: string) => {
      const assignments = await identityRepositories.supervisor.getSupervisorWarehouses(supervisorId);
      return assignments.map((assignment) => assignment.warehouseId);
    },
  };

  private readonly warehouseTransferReader = new WarehouseTransferService();

  readonly authorizeWarehouseScopeUseCase = new AuthorizeWarehouseScopeUseCase({
    warehouseRepository: this.warehouseRepository,
    supervisorAssignmentsRepository: this.supervisorAssignmentsRepository,
  });

  readonly authorizeWarehouseTransferMutationUseCase = new AuthorizeWarehouseTransferMutationUseCase({
    warehouseRepository: this.warehouseRepository,
    supervisorAssignmentsRepository: this.supervisorAssignmentsRepository,
    warehouseTransferRepository: {
      getWarehouseTransferById: (id: string) => this.warehouseTransferReader.getWarehouseTransferById(id),
    },
  });
}

export const warehouseScopeContainer = new WarehouseScopeContainer();
export default warehouseScopeContainer;
