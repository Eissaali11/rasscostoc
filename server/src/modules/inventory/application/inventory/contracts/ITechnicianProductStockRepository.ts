import type { TechnicianProductStock } from '@shared/schema';

export type RepresentativeStockBalance = {
  productId: string;
  productCode: string;
  barcode: string;
  nameAr: string;
  nameEn: string;
  quantity: number;
  defaultPrice: number;
  defaultTaxRate: number;
};

export interface ITechnicianProductStockRepository {
  getBalance(technicianId: string, productId: string): Promise<number>;
  getBalances(technicianId: string): Promise<RepresentativeStockBalance[]>;
  lockAndGetBalance(technicianId: string, productId: string): Promise<number>;
  setBalance(technicianId: string, productId: string, quantity: number): Promise<TechnicianProductStock>;
}
