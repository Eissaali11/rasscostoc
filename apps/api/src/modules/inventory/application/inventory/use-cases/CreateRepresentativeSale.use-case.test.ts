import { describe, expect, it } from 'vitest';
import type { IInventoryV2UnitOfWork, InventoryV2TransactionalContext } from '../contracts/IInventoryV2UnitOfWork';
import type { IProductRepository } from '../contracts/IProductRepository';
import type { ISalesOrderRepository, CreateSalesOrderInput, CreateSalesOrderItemInput } from '../contracts/ISalesOrderRepository';
import type { ITechnicianProductStockRepository, RepresentativeStockBalance } from '../contracts/ITechnicianProductStockRepository';
import type { Product, SalesOrder, TechnicianProductStock } from '../../../../../../../shared/schema';
import { CreateRepresentativeSaleUseCase } from './CreateRepresentativeSale.use-case';
import { IdempotencyCollisionError, InsufficientStockError, ProductNotFoundError } from '../../../../../core/errors/AppError';

class FakeProductRepository implements IProductRepository {
  private products = new Map<string, Product>();

  constructor(seedProducts: Product[] = []) {
    for (const p of seedProducts) {
      this.products.set(p.id, p);
    }
  }

  async findById(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async findByBarcode(barcode: string): Promise<Product | undefined> {
    for (const p of this.products.values()) {
      if (p.barcode === barcode) return p;
    }
    return undefined;
  }

  async findByProductCode(code: string): Promise<Product | undefined> {
    for (const p of this.products.values()) {
      if (p.productCode === code) return p;
    }
    return undefined;
  }

  async listActive(): Promise<Product[]> {
    return Array.from(this.products.values()).filter((p) => p.isActive);
  }
}

class FakeSalesOrderRepository implements ISalesOrderRepository {
  public orders = new Map<string, SalesOrder>();
  public orderItems: any[] = [];

  async existsByIdempotencyKey(key: string): Promise<boolean> {
    for (const order of this.orders.values()) {
      if (order.idempotencyKey === key) return true;
    }
    return false;
  }

  async findByIdempotencyKey(key: string): Promise<SalesOrder | undefined> {
    for (const order of this.orders.values()) {
      if (order.idempotencyKey === key) return order;
    }
    return undefined;
  }

  async create(order: CreateSalesOrderInput, items: CreateSalesOrderItemInput[]): Promise<SalesOrder> {
    const newOrder: SalesOrder = {
      id: `order-${this.orders.size + 1}`,
      representativeId: order.representativeId,
      orderNo: order.orderNo,
      amountBeforeTax: order.amountBeforeTax,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      idempotencyKey: order.idempotencyKey,
      createdAt: new Date(),
    };

    this.orders.set(newOrder.id, newOrder);

    for (const item of items) {
      this.orderItems.push({
        id: `item-${this.orderItems.length + 1}`,
        orderId: newOrder.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTaxAmount: item.lineTaxAmount,
      });
    }

    return newOrder;
  }

  clone(): FakeSalesOrderRepository {
    const cloned = new FakeSalesOrderRepository();
    cloned.orders = new Map(this.orders);
    cloned.orderItems = [...this.orderItems];
    return cloned;
  }

  applyFrom(source: FakeSalesOrderRepository) {
    this.orders = new Map(source.orders);
    this.orderItems = [...source.orderItems];
  }
}

class FakeTechnicianProductStockRepository implements ITechnicianProductStockRepository {
  public stock = new Map<string, number>(); // key: technicianId:productId -> quantity

  static key(technicianId: string, productId: string) {
    return `${technicianId}:${productId}`;
  }

  async getBalance(technicianId: string, productId: string): Promise<number> {
    return this.stock.get(FakeTechnicianProductStockRepository.key(technicianId, productId)) || 0;
  }

  async getBalances(technicianId: string): Promise<RepresentativeStockBalance[]> {
    return [];
  }

  async lockAndGetBalance(technicianId: string, productId: string): Promise<number> {
    return this.getBalance(technicianId, productId);
  }

  async setBalance(technicianId: string, productId: string, quantity: number): Promise<TechnicianProductStock> {
    this.stock.set(FakeTechnicianProductStockRepository.key(technicianId, productId), quantity);
    return { id: 'stock-id', technicianId, productId, quantity, updatedAt: new Date() };
  }

  clone(): FakeTechnicianProductStockRepository {
    const cloned = new FakeTechnicianProductStockRepository();
    cloned.stock = new Map(this.stock);
    return cloned;
  }

  applyFrom(source: FakeTechnicianProductStockRepository) {
    this.stock = new Map(source.stock);
  }
}

class TransactionalFakeInventoryV2UnitOfWork implements IInventoryV2UnitOfWork {
  constructor(
    private readonly productRepo: FakeProductRepository,
    private readonly salesRepo: FakeSalesOrderRepository,
    private readonly stockRepo: FakeTechnicianProductStockRepository
  ) {}

  async execute<T>(work: (context: InventoryV2TransactionalContext) => Promise<T>): Promise<T> {
    const salesClone = this.salesRepo.clone();
    const stockClone = this.stockRepo.clone();

    try {
      const result = await work({
        productRepository: this.productRepo,
        salesOrderRepository: salesClone,
        technicianProductStockRepository: stockClone,
      });

      this.salesRepo.applyFrom(salesClone);
      this.stockRepo.applyFrom(stockClone);
      return result;
    } catch (error) {
      throw error;
    }
  }
}

describe('CreateRepresentativeSaleUseCase', () => {
  const representativeId = 'rep-1';
  const prod1: Product = {
    id: 'prod-1',
    productCode: 'CODE-1',
    barcode: 'BAR-1',
    nameAr: 'المنتج 1',
    nameEn: 'Product 1',
    defaultPrice: 100.0,
    defaultTaxRate: 15.0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should successfully record a sale and deduct representative stock', async () => {
    const productRepo = new FakeProductRepository([prod1]);
    const salesRepo = new FakeSalesOrderRepository();
    const stockRepo = new FakeTechnicianProductStockRepository();

    // Give representative 5 units of prod-1 in stock
    await stockRepo.setBalance(representativeId, prod1.id, 5);

    const uow = new TransactionalFakeInventoryV2UnitOfWork(productRepo, salesRepo, stockRepo);
    const useCase = new CreateRepresentativeSaleUseCase(uow);

    const result = await useCase.execute({
      representativeId,
      orderNo: 'INV-1001',
      amountBeforeTax: 200.0,
      taxAmount: 30.0,
      totalAmount: 230.0,
      idempotencyKey: 'idemp-key-1',
      items: [
        {
          productId: prod1.id,
          quantity: 2,
          unitPrice: 100.0,
          lineTaxAmount: 15.0,
        },
      ],
    });

    expect(result.order.orderNo).toBe('INV-1001');
    expect(result.order.totalAmount).toBe(230.0);
    expect(salesRepo.orders.size).toBe(1);
    expect(salesRepo.orderItems).toHaveLength(1);
    expect(salesRepo.orderItems[0].quantity).toBe(2);

    // Verify stock was reduced from 5 to 3
    const finalStock = await stockRepo.getBalance(representativeId, prod1.id);
    expect(finalStock).toBe(3);
  });

  it('should resolve idempotently on second request with same key by returning original order', async () => {
    const productRepo = new FakeProductRepository([prod1]);
    const salesRepo = new FakeSalesOrderRepository();
    const stockRepo = new FakeTechnicianProductStockRepository();
    await stockRepo.setBalance(representativeId, prod1.id, 5);

    const uow = new TransactionalFakeInventoryV2UnitOfWork(productRepo, salesRepo, stockRepo);
    const useCase = new CreateRepresentativeSaleUseCase(uow);

    const saleInput = {
      representativeId,
      orderNo: 'INV-1001',
      amountBeforeTax: 100.0,
      taxAmount: 15.0,
      totalAmount: 115.0,
      idempotencyKey: 'idemp-key-dup',
      items: [
        {
          productId: prod1.id,
          quantity: 1,
          unitPrice: 100.0,
          lineTaxAmount: 15.0,
        },
      ],
    };

    // First call
    const firstResult = await useCase.execute(saleInput);
    expect(firstResult.order.id).toBeDefined();
    expect(salesRepo.orders.size).toBe(1);

    // Second call with same idempotency key
    const secondResult = await useCase.execute(saleInput);
    expect(secondResult.order.id).toBe(firstResult.order.id);

    // No extra orders should be added, and stock should only be deducted once (from 5 to 4)
    expect(salesRepo.orders.size).toBe(1);
    const finalStock = await stockRepo.getBalance(representativeId, prod1.id);
    expect(finalStock).toBe(4);
  });

  it('should throw ProductNotFoundError when selling a non-existent product ID', async () => {
    const productRepo = new FakeProductRepository([]); // Empty
    const salesRepo = new FakeSalesOrderRepository();
    const stockRepo = new FakeTechnicianProductStockRepository();

    const uow = new TransactionalFakeInventoryV2UnitOfWork(productRepo, salesRepo, stockRepo);
    const useCase = new CreateRepresentativeSaleUseCase(uow);

    await expect(
      useCase.execute({
        representativeId,
        orderNo: 'INV-1002',
        amountBeforeTax: 100.0,
        taxAmount: 15.0,
        totalAmount: 115.0,
        idempotencyKey: 'idemp-key-fail-1',
        items: [
          {
            productId: 'invalid-prod-id',
            quantity: 1,
            unitPrice: 100.0,
            lineTaxAmount: 15.0,
          },
        ],
      })
    ).rejects.toThrowError(ProductNotFoundError);

    expect(salesRepo.orders.size).toBe(0);
  });

  it('should throw InsufficientStockError and rollback transaction if stock is insufficient', async () => {
    const productRepo = new FakeProductRepository([prod1]);
    const salesRepo = new FakeSalesOrderRepository();
    const stockRepo = new FakeTechnicianProductStockRepository();
    await stockRepo.setBalance(representativeId, prod1.id, 1); // Only 1 unit in stock

    const uow = new TransactionalFakeInventoryV2UnitOfWork(productRepo, salesRepo, stockRepo);
    const useCase = new CreateRepresentativeSaleUseCase(uow);

    await expect(
      useCase.execute({
        representativeId,
        orderNo: 'INV-1003',
        amountBeforeTax: 200.0,
        taxAmount: 30.0,
        totalAmount: 230.0,
        idempotencyKey: 'idemp-key-fail-2',
        items: [
          {
            productId: prod1.id,
            quantity: 2, // Requested 2, which exceeds stock of 1
            unitPrice: 100.0,
            lineTaxAmount: 15.0,
          },
        ],
      })
    ).rejects.toThrowError(InsufficientStockError);

    // Verify order was NOT saved and stock remained at 1 (transaction rolled back)
    expect(salesRepo.orders.size).toBe(0);
    const finalStock = await stockRepo.getBalance(representativeId, prod1.id);
    expect(finalStock).toBe(1);
  });
});
