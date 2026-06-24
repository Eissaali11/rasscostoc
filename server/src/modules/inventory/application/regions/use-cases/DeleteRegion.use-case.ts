import type { IRegionRepository } from '../contracts/IRegionRepository';

export class DeleteRegionUseCase {
  constructor(private readonly regionRepository: IRegionRepository) {}

  async execute(regionId: string): Promise<boolean> {
    const [usersCount, warehousesCount] = await Promise.all([
      this.regionRepository.countUsersByRegionId(regionId),
      this.regionRepository.countWarehousesByRegionId(regionId),
    ]);

    if (usersCount > 0 || warehousesCount > 0) {
      throw new Error('Cannot delete region with existing users or warehouses');
    }

    return this.regionRepository.delete(regionId);
  }
}
