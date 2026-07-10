import { stockMovements } from "@shared/schema";
import type { CreateStockMovementInput } from "@modules/inventory/application/inventory/contracts/IStockMovementRepository";
import type { StockMovement } from '@shared/schema';

export class DrizzleStockMovementRepository {
  constructor(private readonly executor: any) {}

  async create(input: CreateStockMovementInput): Promise<StockMovement> {
    const [movement] = await this.executor
      .insert(stockMovements)
      .values({
        technicianId: input.technicianId,
        itemType: input.itemType,
        packagingType: input.packagingType,
        quantity: input.quantity,
        fromInventory: input.fromInventory,
        toInventory: input.toInventory,
        performedBy: input.performedBy,
        reason: input.reason,
        notes: input.notes,
      })
      .returning();

    return movement;
  }

  async createMany(inputs: CreateStockMovementInput[]): Promise<StockMovement[]> {
    if (inputs.length === 0) {
      return [];
    }

    return this.executor
      .insert(stockMovements)
      .values(
        inputs.map((input) => ({
          technicianId: input.technicianId,
          itemType: input.itemType,
          packagingType: input.packagingType,
          quantity: input.quantity,
          fromInventory: input.fromInventory,
          toInventory: input.toInventory,
          performedBy: input.performedBy,
          reason: input.reason,
          notes: input.notes,
        }))
      )
      .returning();
  }
}
