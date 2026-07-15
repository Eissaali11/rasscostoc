import type { ICourierRequestsRepository } from "./ICourierRequestsRepository";
import type { ICourierExecutionsRepository } from "./ICourierExecutionsRepository";
import type { ICourierPdfRepository } from "./ICourierPdfRepository";
import type { ICourierDashboardReadRepository } from "./ICourierDashboardReadRepository";
import type { ICourierInventoryPort } from "./ICourierInventoryPort";

export type CourierTransactionalContext = {
  requestsRepository: ICourierRequestsRepository;
  executionsRepository: ICourierExecutionsRepository;
  pdfRepository: ICourierPdfRepository;
  dashboardRepository: ICourierDashboardReadRepository;
  inventoryPort: ICourierInventoryPort;
  tx?: any;
};

export interface ICourierUnitOfWork {
  execute<T>(work: (context: CourierTransactionalContext) => Promise<T>): Promise<T>;
}
export interface ICourierTransactionPort {
  run<T>(work: (tx: any) => Promise<T>): Promise<T>;
}
