import type { IUserRepository } from "@stockpro/contracts";
import type {
  IWithdrawTechnicianInventoryToWarehouseLookupRepository,
  IWithdrawSystemLogRepository,
} from "@modules/inventory/application/inventory/use-cases/WithdrawTechnicianInventoryToWarehouse.use-case";
import { repositories } from "@modules/inventory/infrastructure/database";
import { WarehouseRepository } from "./WarehouseRepository";

/**
 * DB-R1 / Phase C4.6C.2 — read-only lookups (user/warehouse existence,
 * region authorization) plus the post-commit system_logs write. The
 * balance-affecting reads/writes that used to live here now go through
 * DrizzleWithdrawTechnicianInventoryToWarehouseUnitOfWork instead, so
 * they run inside one locked transaction.
 */
export class DrizzleWithdrawTechnicianInventoryToWarehouseRepository
  implements IWithdrawTechnicianInventoryToWarehouseLookupRepository, IWithdrawSystemLogRepository
{
  private readonly warehouses = new WarehouseRepository();

  constructor(
    private readonly userRepository: IUserRepository
  ) {}

  async getUser(id: string) {
    const user = await this.userRepository.getUser(id);
    if (!user) return undefined;
    return {
      id: user.id,
      role: user.role,
      fullName: user.fullName || user.username,
      regionId: user.regionId
    };
  }

  getWarehouse(id: string) {
    return this.warehouses.getWarehouse(id);
  }

  logSystemActivity(payload: {
    userId: string;
    userName: string;
    userRole: string;
    regionId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    entityName: string;
    description: string;
    details?: string;
    severity: string;
    success: boolean;
  }) {
    return repositories.systemLogs.createSystemLog(payload as any);
  }
}
