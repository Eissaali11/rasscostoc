import { describe, expect, it } from 'vitest';
import type { IInventoryV2UnitOfWork, InventoryV2TransactionalContext } from '../contracts/IInventoryV2UnitOfWork';
import type { IProductRepository } from '../contracts/IProductRepository';
import type { ISalesOrderRepository } from '../contracts/ISalesOrderRepository';
import type { ITechnicianProductStockRepository, RepresentativeStockBalance } from '../contracts/ITechnicianProductStockRepository';
import type { Product, SalesOrder, TechnicianProductStock } from '../../../../../../../shared/schema';
import { SyncRepresentativeInventoryUseCase } from './SyncRepresentativeInventory.use-case';

class InMemoryTechnicianProductStockRepository implements ITechnicianProductStockRepository {
  public balances = new Map<string, RepresentativeStockBalance[]>();

  async getBalance(technicianId: string, productId: string): Promise<number> {
    const list = this.balances.get(technicianId) || [];
    const item = list.find((b) => b.productId === productId);
    return item ? item.quantity : 0;
  }

  async getBalances(technicianId: string): Promise<RepresentativeStockBalance[]> {
    return this.balances.get(technicianId) || [];
  }

  async lockAndGetBalance(technicianId: string, productId: string): Promise<number> {
    return this.getBalance(technicianId, productId);
  }

  async setBalance(technicianId: string, productId: string, quantity: number): Promise<TechnicianProductStock> {
    const list = this.balances.get(technicianId) || [];
    const idx = list.findIndex((b) => b.productId === productId);
    if (idx !== -1) {
      list[idx].quantity = quantity;
    } else {
      list.push({
        productId,
        productCode: `P-${productId}`,
        barcode: `B-${productId}`,
        nameAr: 'اسم المنتج',
        nameEn: 'Product Name',
        quantity,
        defaultPrice: 100,
        defaultTaxRate: 15,
      });
    }
    this.balances.set(technicianId, list);
    return { id: 'stock-id', technicianId, productId, quantity, updatedAt: new Date() };
  }
}

class FakeInventoryV2UnitOfWork implements IInventoryV2UnitOfWork {
  constructor(
    private readonly stockRepo: ITechnicianProductStockRepository,
    private readonly productRepo: IProductRepository = {} as any,
    private readonly salesRepo: ISalesOrderRepository = {} as any
  ) {}

  async execute<T>(work: (context: InventoryV2TransactionalContext) => Promise<T>): Promise<T> {
    return work({
      productRepository: this.productRepo,
      salesOrderRepository: this.salesRepo,
      technicianProductStockRepository: this.stockRepo,
    });
  }
}

describe('SyncRepresentativeInventoryUseCase', () => {
  it('should fetch active representative product balances successfully', async () => {
    const technicianId = 'tech-1';
    const mockBalances: RepresentativeStockBalance[] = [
      {
        productId: 'prod-1',
        productCode: 'PC-1',
        barcode: 'BAR-1',
        nameAr: 'منتج 1',
        nameEn: 'Product 1',
        quantity: 10,
        defaultPrice: 50.0,
        defaultTaxRate: 15.0,
      },
      {
        productId: 'prod-2',
        productCode: 'PC-2',
        barcode: 'BAR-2',
        nameAr: 'منتج 2',
        nameEn: 'Product 2',
        quantity: 5,
        defaultPrice: 100.0,
        defaultTaxRate: 15.0,
      },
    ];

    const stockRepo = new InMemoryTechnicianProductStockRepository();
    stockRepo.balances.set(technicianId, mockBalances);

    const unitOfWork = new FakeInventoryV2UnitOfWork(stockRepo);
    const useCase = new SyncRepresentativeInventoryUseCase(unitOfWork);

    const result = await useCase.execute({ technicianId });

    expect(result.balances).toHaveLength(2);
    expect(result.balances[0].productId).toBe('prod-1');
    expect(result.balances[0].quantity).toBe(10);
    expect(result.balances[1].productId).toBe('prod-2');
    expect(result.balances[1].quantity).toBe(5);
  });

  it('should return empty list if representative has no stock', async () => {
    const stockRepo = new InMemoryTechnicianProductStockRepository();
    const unitOfWork = new FakeInventoryV2UnitOfWork(stockRepo);
    const useCase = new SyncRepresentativeInventoryUseCase(unitOfWork);

    const result = await useCase.execute({ technicianId: 'tech-empty' });
    expect(result.balances).toEqual([]);
  });
});
