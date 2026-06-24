import type { IInventoryV2UnitOfWork } from '../contracts/IInventoryV2UnitOfWork';
import type { RepresentativeStockBalance } from '../contracts/ITechnicianProductStockRepository';

export type SyncRepresentativeInventoryInput = {
  technicianId: string;
};

export type SyncRepresentativeInventoryOutput = {
  balances: RepresentativeStockBalance[];
};

export class SyncRepresentativeInventoryUseCase {
  constructor(private readonly unitOfWork: IInventoryV2UnitOfWork) {}

  async execute(input: SyncRepresentativeInventoryInput): Promise<SyncRepresentativeInventoryOutput> {
    return this.unitOfWork.execute(async (context) => {
      const balances = await context.technicianProductStockRepository.getBalances(input.technicianId);
      return { balances };
    });
  }
}
