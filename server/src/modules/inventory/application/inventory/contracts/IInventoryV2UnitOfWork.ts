import type { IProductRepository } from './IProductRepository';
import type { ISalesOrderRepository } from './ISalesOrderRepository';
import type { ITechnicianProductStockRepository } from './ITechnicianProductStockRepository';

export type InventoryV2TransactionalContext = {
  productRepository: IProductRepository;
  salesOrderRepository: ISalesOrderRepository;
  technicianProductStockRepository: ITechnicianProductStockRepository;
};

export interface IInventoryV2UnitOfWork {
  execute<T>(work: (context: InventoryV2TransactionalContext) => Promise<T>): Promise<T>;
}
