import type { ITechnicianProductStockRepository, RepresentativeStockBalance } from '../../application/inventory/contracts/ITechnicianProductStockRepository';
import type { TechnicianProductStock } from '../../../../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { technicianProductStock, products } from '../../../../../../shared/schema';

export class DrizzleTechnicianProductStockRepository implements ITechnicianProductStockRepository {
  constructor(private readonly executor: any) {}

  async getBalance(technicianId: string, productId: string): Promise<number> {
    const [row] = await this.executor
      .select({ quantity: technicianProductStock.quantity })
      .from(technicianProductStock)
      .where(
        and(
          eq(technicianProductStock.technicianId, technicianId),
          eq(technicianProductStock.productId, productId)
        )
      );
    return row ? row.quantity : 0;
  }

  async getBalances(technicianId: string): Promise<RepresentativeStockBalance[]> {
    const rows = await this.executor
      .select({
        productId: products.id,
        productCode: products.productCode,
        barcode: products.barcode,
        nameAr: products.nameAr,
        nameEn: products.nameEn,
        quantity: technicianProductStock.quantity,
        defaultPrice: products.defaultPrice,
        defaultTaxRate: products.defaultTaxRate,
      })
      .from(technicianProductStock)
      .innerJoin(products, eq(technicianProductStock.productId, products.id))
      .where(
        and(
          eq(technicianProductStock.technicianId, technicianId),
          eq(products.isActive, true)
        )
      );
    return rows;
  }

  async lockAndGetBalance(technicianId: string, productId: string): Promise<number> {
    const [row] = await this.executor
      .select({ quantity: technicianProductStock.quantity })
      .from(technicianProductStock)
      .where(
        and(
          eq(technicianProductStock.technicianId, technicianId),
          eq(technicianProductStock.productId, productId)
        )
      )
      .for('update');

    if (row) {
      return row.quantity;
    }

    // Insert row if not exists
    await this.executor
      .insert(technicianProductStock)
      .values({
        technicianId,
        productId,
        quantity: 0,
      })
      .onConflictDoNothing();

    // Lock it again to be safe
    const [lockedRow] = await this.executor
      .select({ quantity: technicianProductStock.quantity })
      .from(technicianProductStock)
      .where(
        and(
          eq(technicianProductStock.technicianId, technicianId),
          eq(technicianProductStock.productId, productId)
        )
      )
      .for('update');

    return lockedRow ? lockedRow.quantity : 0;
  }

  async setBalance(technicianId: string, productId: string, quantity: number): Promise<TechnicianProductStock> {
    const [updatedRow] = await this.executor
      .insert(technicianProductStock)
      .values({
        technicianId,
        productId,
        quantity,
      })
      .onConflictDoUpdate({
        target: [technicianProductStock.technicianId, technicianProductStock.productId],
        set: { quantity, updatedAt: new Date() },
      })
      .returning();

    if (!updatedRow) {
      throw new Error(`Failed to update stock for technician ${technicianId} and product ${productId}`);
    }

    return updatedRow;
  }
}
