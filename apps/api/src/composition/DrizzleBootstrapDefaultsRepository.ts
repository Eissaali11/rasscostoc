import type { IBootstrapDefaultsRepository } from '../core/bootstrap/contracts/IBootstrapDefaultsRepository';
import type { InsertRegion, InsertUser, Region, UserSafe } from '@shared/schema';
import { ItemTypesService } from '@modules/inventory/infrastructure/services/item-types.service';
import { DrizzleRegionRepository } from '@modules/inventory/infrastructure/database/DrizzleRegionRepository';
import { UserRepository } from '@modules/identity/infrastructure/database/UserRepository';

export class DrizzleBootstrapDefaultsRepository implements IBootstrapDefaultsRepository {
  private readonly usersRepository = new UserRepository();
  private readonly regionRepository = new DrizzleRegionRepository();
  private readonly itemTypesService = new ItemTypesService();

  async getUsers(): Promise<UserSafe[]> {
    return this.usersRepository.getUsers();
  }

  async getRegions(): Promise<Region[]> {
    return this.regionRepository.findAll();
  }

  async createRegion(data: InsertRegion): Promise<Region> {
    return this.regionRepository.create(data);
  }

  async createUser(data: InsertUser): Promise<UserSafe> {
    return this.usersRepository.createUser(data);
  }

  async seedDefaultItemTypes(): Promise<void> {
    await this.itemTypesService.seedDefaultItemTypes();
  }
}
