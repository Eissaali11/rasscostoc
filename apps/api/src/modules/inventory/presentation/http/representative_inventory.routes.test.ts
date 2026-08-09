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
        defaultPrice: '10.0000', // DB-R10C.3: RepresentativeStockBalance now carries exact decimal strings
        defaultTaxRate: '0.1500',
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
    // DB-R10C.3: exact decimal strings (NUMERIC columns), not numbers.
    defaultPrice: '100.0000',
    defaultTaxRate: '0.1500',
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
    // DB-R10C.2: financial fields must be consistent with prod1
    // (defaultPrice=100, defaultTaxRate=15.0 legacy -> canonical 0.15)
    // for qty=2: amountBeforeTax=200, tax=30, total=230, unitPrice=100,
    // lineTaxAmount=30. Prior to DB-R10C.2 this payload deliberately (if
    // unintentionally) used an inconsistent unitPrice of 50.0 against a
    // real price of 100 and the sale still succeeded — that mismatch
    // being silently accepted was exactly the vulnerability this slice
    // closes; the server now rejects such a payload outright (see the
    // dedicated FinancialMismatchError test below).
    const validSalePayload = {
      orderNo: "ORD-999",
      amountBeforeTax: "200.0",
      taxAmount: "30.0",
      totalAmount: "230.0",
      items: [
        {
          productId: "prod-1",
          quantity: "2",
          unitPrice: "100.0",
          lineTaxAmount: "30.0",
        }
      ]
    };

    it('DB-R10C.2A §1: header financial fields (amountBeforeTax/taxAmount/totalAmount) are REQUIRED at the actual HTTP boundary — confirmed via the real endpoint, not just the use-case', async () => {
      fakeProductRepo.products.set(prod1.id, prod1);
      await fakeStockRepo.setBalance(technicianId, prod1.id, 5);

      const { amountBeforeTax, ...withoutHeaderFinancials } = validSalePayload;
      const res = await request(app)
        .post('/representative/inventory/sale')
        .set('x-idempotency-key', 'sale-idemp-header-required')
        .send(withoutHeaderFinancials)
        .expect(400);

      expect(res.body.error).toContain('Missing required sales order fields');
    });

    it('DB-R10C.2A §1: item-level financial fields (unitPrice/lineTaxAmount) are OPTIONAL at the actual HTTP boundary — confirmed via the real endpoint, not just the use-case', async () => {
      fakeProductRepo.products.set(prod1.id, prod1);
      await fakeStockRepo.setBalance(technicianId, prod1.id, 5);

      const payloadWithoutItemFinancials = {
        ...validSalePayload,
        items: [{ productId: 'prod-1', quantity: '2' }], // no unitPrice/lineTaxAmount
      };

      const res = await request(app)
        .post('/representative/inventory/sale')
        .set('x-idempotency-key', 'sale-idemp-item-optional')
        .send(payloadWithoutItemFinancials)
        .expect(200);

      // Server still derives correctly from prod1.defaultPrice=100/defaultTaxRate=0.15.
      // DB-R10C.3: response carries exact decimal STRINGS (JSON string), not numbers.
      expect(res.body.order.amountBeforeTax).toBe('200.00');
      expect(res.body.order.taxAmount).toBe('30.00');
    });

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

    it('DB-R10C.2: should return 409 with FinancialMismatchError details when client unit price disagrees with the authoritative product price', async () => {
      fakeProductRepo.products.set(prod1.id, prod1); // real defaultPrice=100
      await fakeStockRepo.setBalance(technicianId, prod1.id, 5);

      // Header fields are deliberately CORRECT (200/30/230, matching
      // prod1's real price) so the mismatch is isolated to the item-level
      // unitPrice — proving the server checks per-item fields, not only
      // header totals.
      const fraudulentPayload = {
        orderNo: "ORD-FRAUD",
        amountBeforeTax: "200.0",
        taxAmount: "30.0",
        totalAmount: "230.0",
        items: [
          {
            productId: "prod-1",
            quantity: "2",
            unitPrice: "1.0", // real price is 100 — client is lying
            lineTaxAmount: "30.0",
          }
        ]
      };

      const res = await request(app)
        .post('/representative/inventory/sale')
        .set('x-idempotency-key', 'sale-idemp-fraud')
        .send(fraudulentPayload)
        .expect(409);

      expect(res.body).toHaveProperty('error');
      expect(res.body.field).toBe('items[0].unitPrice');
      // DB-R10C.3: "expected" is now the exact NUMERIC(14,4) decimal string.
      expect(res.body.expected).toBe('100.0000');
      expect(res.body.received).toBe('1');

      // Nothing persisted, stock untouched.
      const balance = await fakeStockRepo.getBalance(technicianId, prod1.id);
      expect(balance).toBe(5);
    });
  });
});
