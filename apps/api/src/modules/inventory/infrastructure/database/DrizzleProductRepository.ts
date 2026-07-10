import type { IProductRepository } from '../../application/inventory/contracts/IProductRepository';
import type { Product } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { products } from '@shared/schema';

export class DrizzleProductRepository implements IProductRepository {
  constructor(private readonly executor: any) {}

  async findById(id: string): Promise<Product | undefined> {
    const [row] = await this.executor
      .select()
      .from(products)
      .where(eq(products.id, id));
    return row || undefined;
  }

  async findByBarcode(barcode: string): Promise<Product | undefined> {
    const [row] = await this.executor
      .select()
      .from(products)
      .where(eq(products.barcode, barcode));
    return row || undefined;
  }

  async findByProductCode(code: string): Promise<Product | undefined> {
    const [row] = await this.executor
      .select()
      .from(products)
      .where(eq(products.productCode, code));
    return row || undefined;
  }

  async listActive(): Promise<Product[]> {
    return this.executor
      .select()
      .from(products)
      .where(eq(products.isActive, true));
  }
}
