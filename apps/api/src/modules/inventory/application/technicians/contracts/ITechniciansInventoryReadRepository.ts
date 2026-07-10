export interface ITechniciansInventoryReadRepository {
  getAllTechniciansWithBothInventories(): Promise<any[]>;
  getRegionTechniciansWithInventories(regionId: string): Promise<any[]>;
}
