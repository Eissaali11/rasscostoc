import type { StockMovementWithDetails } from '@shared/schema';
import type { IStockTransferRepository, StockTransferInput, StockTransferOutput } from '../contracts/IStockTransferRepository';

export class StockTransferUseCase {
  constructor(private readonly repository: IStockTransferRepository) {}

  async transfer(input: StockTransferInput): Promise<StockTransferOutput> {
    return this.repository.transferStock(input);
  }

  async getMovements(technicianId?: string, limit?: number): Promise<StockMovementWithDetails[]> {
    return this.repository.getStockMovements(technicianId, limit);
  }
}
