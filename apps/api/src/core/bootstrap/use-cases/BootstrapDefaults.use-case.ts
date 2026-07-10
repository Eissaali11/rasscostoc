import type { IBootstrapDefaultsRepository } from '../contracts/IBootstrapDefaultsRepository';

export type PasswordHasher = (plainPassword: string) => Promise<string>;
export type BootstrapDefaultsResult = {
  createdUsers: boolean;
  createdRegion: boolean;
};

export class BootstrapDefaultsUseCase {
  constructor(private readonly repository: IBootstrapDefaultsRepository) {}

  async execute(hashPassword: PasswordHasher): Promise<BootstrapDefaultsResult> {
    const users = await this.repository.getUsers();
    let createdUsers = false;
    let createdRegion = false;

    if (users.length === 0) {
      createdUsers = true;
      const regions = await this.repository.getRegions();
      let defaultRegionId: string;

      if (regions.length === 0) {
        createdRegion = true;
        const defaultRegion = await this.repository.createRegion({
          name: 'المنطقة الرئيسية',
          description: 'المنطقة الافتراضية للنظام',
          isActive: true,
        });
        defaultRegionId = defaultRegion.id;
      } else {
        defaultRegionId = regions[0].id;
      }

      const adminPassword = await hashPassword('admin123');
      const techPassword = await hashPassword('tech123');
      const supervisorPassword = await hashPassword('super123');

      await this.repository.createUser({
        username: 'admin',
        email: 'admin@company.com',
        password: adminPassword,
        fullName: 'مدير النظام',
        city: 'الرياض',
        role: 'admin',
        regionId: defaultRegionId,
        isActive: true,
      });

      await this.repository.createUser({
        username: 'tech1',
        email: 'tech1@company.com',
        password: techPassword,
        fullName: 'مندوب تجريبي',
        city: 'جدة',
        role: 'technician',
        regionId: defaultRegionId,
        isActive: true,
      });

      await this.repository.createUser({
        username: 'supervisor1',
        email: 'supervisor1@company.com',
        password: supervisorPassword,
        fullName: 'مشرف تجريبي',
        city: 'الرياض',
        role: 'supervisor',
        regionId: defaultRegionId,
        isActive: true,
      });
    }

    return {
      createdUsers,
      createdRegion,
    };
  }
}

