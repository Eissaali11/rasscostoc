import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { RepresentativeInventoryRouter } from './representative_inventory.routes';
import {
  IdempotencyCollisionError,
  InsufficientStockError,
  ProductNotFoundError,
} from '../../../../core/errors/AppError';
import type { IInventoryV2UnitOfWork, InventoryV2TransactionalContext } from '../../application/inventory/contracts/IInventoryV2UnitOfWork';
import type { IProductRepository } from '../../application/inventory/contracts/IProductRepository';
import type { ISalesOrderRepository, CreateSalesOrderInput, CreateSalesOrderItemInput } from '../../application/inventory/contracts/ISalesOrderRepository';
import type { ITechnicianProductStockRepository, RepresentativeStockBalance } from '../../application/inventory/contracts/ITechnicianProductStockRepository';
import type { Product, SalesOrder } from '@shared/schema';

// Mock the authentication middleware before any imports load it
vi.mock("../../../../core/middlewares/auth.middleware", () => {
  return {
    requireAuth: (req: any, res: any, next: any) => {
      req.user = { id: "test-tech-123", username: "testtech", role: "technician" };
      next();
    },
  };
});

// Fake implementations of Repositories for integration isolation
class FakeProductRepository implements IProductRepository {
  public products = new Map<string, Product>();

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
  public idempotencyKeys = new Set<string>();

  async existsByIdempotencyKey(key: string): Promise<boolean> {
    return this.idempotencyKeys.has(key);
  }

  async findByIdempotencyKey(key: string): Promise<SalesOrder | undefined> {
    for (const order of this.orders.values()) {
      if (order.idempotencyKey === key) return order;
    }
    return undefined;
  }

  async create(order: CreateSalesOrderInput, items: CreateSalesOrderItemInput[]): Promise<SalesOrder> {
    if (this.idempotencyKeys.has(order.idempotencyKey)) {
      throw new IdempotencyCollisionError();
    }
    this.idempotencyKeys.add(order.idempotencyKey);
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
    return newOrder;
  }
}

class FakeTechnicianProductStockRepository implements ITechnicianProductStockRepository {
  public balances = new Map<string, RepresentativeStockBalance[]>();

  async getBalances(technicianId: string): Promise<RepresentativeStockBalance[]> {
    return this.balances.get(technicianId) || [];
  }

  async getBalance(technicianId: string, productId: string): Promise<number> {
    const list = this.balances.get(technicianId) || [];
    const item = list.find((b) => b.productId === productId);
    return item ? item.quantity : 0;
  }

  async lockAndGetBalance(technicianId: string, productId: string): Promise<number> {
    return this.getBalance(technicianId, productId);
  }

  async setBalance(technicianId: string, productId: string, quantity: number): Promise<any> {
    const list = this.balances.get(technicianId) || [];
    const idx = list.findIndex((b) => b.productId === productId);
    if (idx !== -1) {
      list[idx].quantity = quantity;
    } else {
      list.push({
        productId,
        productCode: `PC-${productId}`,
        barcode: `BAR-${productId}`,
        nameAr: `اسم-${productId}`,
        nameEn: `Name-${productId}`,
        quantity,
        defaultPrice: 10,
        defaultTaxRate: 15,
      });
    }
    this.balances.set(technicianId, list);
    return { id: "stock-id", technicianId, productId, quantity, updatedAt: new Date() };
  }
}

class FakeInventoryV2UnitOfWork implements IInventoryV2UnitOfWork {
  constructor(
    public readonly productRepository: FakeProductRepository,
    public readonly salesOrderRepository: FakeSalesOrderRepository,
    public readonly technicianProductStockRepository: FakeTechnicianProductStockRepository
  ) {}

  async execute<T>(work: (context: InventoryV2TransactionalContext) => Promise<T>): Promise<T> {
    return work({
      productRepository: this.productRepository,
      salesOrderRepository: this.salesOrderRepository,
      technicianProductStockRepository: this.technicianProductStockRepository,
    });
  }
}

describe('Representative Inventory HTTP Integration Tests', () => {
  let app: express.Express;
  let fakeProductRepo: FakeProductRepository;
  let fakeSalesRepo: FakeSalesOrderRepository;
  let fakeStockRepo: FakeTechnicianProductStockRepository;
  let fakeUow: FakeInventoryV2UnitOfWork;

  const technicianId = "test-tech-123";
  const prod1: Product = {
    id: 'prod-1',
    productCode: 'PC-1',
    barcode: 'BAR-1',
    nameAr: 'منتج 1',
    nameEn: 'Product 1',
    defaultPrice: 100.0,
    defaultTaxRate: 15.0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());

    fakeProductRepo = new FakeProductRepository();
    fakeSalesRepo = new FakeSalesOrderRepository();
    fakeStockRepo = new FakeTechnicianProductStockRepository();
    fakeUow = new FakeInventoryV2UnitOfWork(fakeProductRepo, fakeSalesRepo, fakeStockRepo);

    // Register routes
    const router = new RepresentativeInventoryRouter(fakeUow);
    router.register(app);
  });

  describe('GET /representative/inventory/sync/:technicianId?', () => {
    it('should return 200 and representative stock balances successfully', async () => {
      // Seed product and representative stock balance
      fakeProductRepo.products.set(prod1.id, prod1);
      await fakeStockRepo.setBalance(technicianId, prod1.id, 10);

      const res = await request(app)
        .get(`/representative/inventory/sync/${technicianId}`)
        .expect(200);

      expect(res.body).toHaveProperty('balances');
      expect(res.body.balances).toHaveLength(1);
      expect(res.body.balances[0].productId).toBe(prod1.id);
      expect(res.body.balances[0].quantity).toBe(10);
    });

    it('should fallback to authenticated user ID if no technicianId parameter is passed', async () => {
      fakeProductRepo.products.set(prod1.id, prod1);
      await fakeStockRepo.setBalance(technicianId, prod1.id, 5);

      const res = await request(app)
        .get('/representative/inventory/sync')
        .expect(200);

      expect(res.body.balances).toHaveLength(1);
      expect(res.body.balances[0].quantity).toBe(5);
    });

    it('should return empty balances if technician has no registered stock', async () => {
      const res = await request(app)
        .get(`/representative/inventory/sync/other-tech`)
        .expect(200);

      expect(res.body.balances).toEqual([]);
    });
  });

  describe('POST /representative/inventory/sale', () => {
    const validSalePayload = {
      orderNo: "ORD-999",
      amountBeforeTax: "100.0",
      taxAmount: "15.0",
      totalAmount: "115.0",
      items: [
        {
          productId: "prod-1",
          quantity: "2",
          unitPrice: "50.0",
          lineTaxAmount: "7.5",
        }
      ]
    };

    it('should return 200 and process sale successfully', async () => {
      fakeProductRepo.products.set(prod1.id, prod1);
      await fakeStockRepo.setBalance(technicianId, prod1.id, 5);

      const res = await request(app)
        .post('/representative/inventory/sale')
        .set('x-idempotency-key', 'sale-idemp-1')
        .send(validSalePayload)
        .expect(200);

      expect(res.body).toHaveProperty('order');
      expect(res.body.order.orderNo).toBe('ORD-999');

      // Verify stock was decremented from 5 to 3
      const balance = await fakeStockRepo.getBalance(technicianId, prod1.id);
      expect(balance).toBe(3);
    });

    it('should return 400 when x-idempotency-key header is missing', async () => {
      const res = await request(app)
        .post('/representative/inventory/sale')
        .send(validSalePayload)
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('x-idempotency-key header is required');
    });

    it('should return 400 when missing essential sale fields in request body', async () => {
      const incompletePayload = {
        orderNo: "ORD-999",
        // missing amountBeforeTax, taxAmount, totalAmount
        items: []
      };

      const res = await request(app)
        .post('/representative/inventory/sale')
        .set('x-idempotency-key', 'sale-idemp-2')
        .send(incompletePayload)
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('Missing required sales order fields');
    });

    it('should return 404 when trying to sell a non-existent product', async () => {
      // Product "prod-1" is not seeded in fakeProductRepo
      await fakeStockRepo.setBalance(technicianId, "prod-1", 5);

      const res = await request(app)
        .post('/representative/inventory/sale')
        .set('x-idempotency-key', 'sale-idemp-3')
        .send(validSalePayload)
        .expect(404);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('Product with ID prod-1 was not found');
    });

    it('should return 422 when representative stock balance is insufficient', async () => {
      fakeProductRepo.products.set(prod1.id, prod1);
      await fakeStockRepo.setBalance(technicianId, prod1.id, 1); // Only 1, payload asks for 2

      const res = await request(app)
        .post('/representative/inventory/sale')
        .set('x-idempotency-key', 'sale-idemp-4')
        .send(validSalePayload)
        .expect(422);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('Insufficient stock for product');
    });

    it('should return 409 Conflict if IdempotencyCollisionError is thrown', async () => {
      fakeProductRepo.products.set(prod1.id, prod1);
      await fakeStockRepo.setBalance(technicianId, prod1.id, 5);

      // Seed the key beforehand
      fakeSalesRepo.idempotencyKeys.add('sale-idemp-dup');

      const res = await request(app)
        .post('/representative/inventory/sale')
        .set('x-idempotency-key', 'sale-idemp-dup')
        .send(validSalePayload)
        .expect(409);

      expect(res.body).toHaveProperty('error');
    });
  });
});
