import type { TechnicianProductStock } from '@shared/schema';

export type RepresentativeStockBalance = {
  productId: string;
  productCode: string;
  barcode: string;
  nameAr: string;
  nameEn: string;
  quantity: number;
  /** DB-R10C.3: exact decimal string (NUMERIC(14,4)) — display/sync only, not used in sale calculation. */
  defaultPrice: string;
  /** DB-R10C.3: exact decimal string (NUMERIC(5,4), canonical fraction) — display/sync only. */
  defaultTaxRate: string;
};

export interface ITechnicianProductStockRepository {
  getBalance(technicianId: string, productId: string): Promise<number>;
  getBalances(technicianId: string): Promise<RepresentativeStockBalance[]>;
  lockAndGetBalance(technicianId: string, productId: string): Promise<number>;
  setBalance(technicianId: string, productId: string, quantity: number): Promise<TechnicianProductStock>;
}
