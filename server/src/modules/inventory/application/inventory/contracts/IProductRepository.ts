import type { Product } from '@shared/schema';

export interface IProductRepository {
  findById(id: string): Promise<Product | undefined>;
  findByBarcode(barcode: string): Promise<Product | undefined>;
  findByProductCode(code: string): Promise<Product | undefined>;
  listActive(): Promise<Product[]>;
}
