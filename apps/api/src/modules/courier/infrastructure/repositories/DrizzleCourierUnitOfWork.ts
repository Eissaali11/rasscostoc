import { getDatabase } from "@core/database/connection";
import type { ICourierUnitOfWork, CourierTransactionalContext } from "../../domain/repositories/ICourierUnitOfWork";
import { DrizzleCourierRepository } from "./drizzle-courier.repository";
import { CourierInventoryPortAdapter } from "@server/composition/courier-inventory.adapter";

export class DrizzleCourierUnitOfWork implements ICourierUnitOfWork {
  async execute<T>(work: (context: CourierTransactionalContext) => Promise<T>): Promise<T> {
    const database = getDatabase();
    return database.transaction(async (tx) => {
      const repo = new DrizzleCourierRepository(tx);
      const inventoryPort = new CourierInventoryPortAdapter(repo, tx);
      const context: CourierTransactionalContext = {
        requestsRepository: repo,
        executionsRepository: repo,
        pdfRepository: repo,
        dashboardRepository: repo,
        inventoryPort,
        tx,
      };
      return work(context);
    });
  }
}
