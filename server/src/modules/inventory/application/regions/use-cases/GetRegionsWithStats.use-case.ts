import type { RegionWithStats } from "@shared/schema";
import type { IRegionRepository } from '../contracts/IRegionRepository';

export class GetRegionsWithStatsUseCase {
  constructor(private readonly regionRepository: IRegionRepository) {}

  async execute(): Promise<RegionWithStats[]> {
    const regions = await this.regionRepository.findAll();

    const statsByRegion = await Promise.all(
      regions.map(async (region) => {
        const stats = await this.regionRepository.getInventoryStatsByRegionId(region.id);
        return {
          regionId: region.id,
          stats,
        };
      }),
    );

    const statsMap = new Map(statsByRegion.map((entry) => [entry.regionId, entry.stats]));

    return regions.map((region) => {
      const stats = statsMap.get(region.id);
      return {
        ...region,
        itemCount: stats?.itemCount ?? 0,
        totalQuantity: stats?.totalQuantity ?? 0,
        lowStockCount: stats?.lowStockCount ?? 0,
      };
    });
  }
}
