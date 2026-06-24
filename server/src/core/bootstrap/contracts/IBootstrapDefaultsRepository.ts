import type { InsertRegion, InsertUser, Region, UserSafe } from '@shared/schema';

export interface IBootstrapDefaultsRepository {
  getUsers(): Promise<UserSafe[]>;
  getRegions(): Promise<Region[]>;
  createRegion(data: InsertRegion): Promise<Region>;
  createUser(data: InsertUser): Promise<UserSafe>;
  seedDefaultItemTypes(): Promise<void>;
}
