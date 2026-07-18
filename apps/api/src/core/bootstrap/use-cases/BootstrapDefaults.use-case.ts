import type { IBootstrapDefaultsRepository } from '../contracts/IBootstrapDefaultsRepository';

export type PasswordHasher = (plainPassword: string) => Promise<string>;
export type BootstrapDefaultsResult = {
  createdUsers: boolean;
  createdRegion: boolean;
};

/** Known weak defaults — never accepted for bootstrap (ERP-008 P1.1). */
const FORBIDDEN_BOOTSTRAP_PASSWORDS = new Set([
  'admin123',
  'tech123',
  'super123',
  'emp123',
  'password',
  'password123',
  '123456',
  'changeme',
]);

export class BootstrapAdminRequiredError extends Error {
  readonly code = 'BOOTSTRAP_ADMIN_REQUIRED';

  constructor(message: string) {
    super(message);
    this.name = 'BootstrapAdminRequiredError';
  }
}

export function assertSafeBootstrapPassword(password: string | undefined): string {
  const value = (password || '').trim();
  if (value.length < 12) {
    throw new BootstrapAdminRequiredError(
      'ERP-008: Empty database requires BOOTSTRAP_ADMIN_PASSWORD (min 12 characters). ' +
        'Default accounts (admin/admin123) are disabled. Use scripts/bootstrap-first-admin.ts or set the env var before start.',
    );
  }
  if (FORBIDDEN_BOOTSTRAP_PASSWORDS.has(value.toLowerCase())) {
    throw new BootstrapAdminRequiredError(
      'ERP-008: BOOTSTRAP_ADMIN_PASSWORD rejects known default passwords (e.g. admin123). Choose a unique strong password.',
    );
  }
  return value;
}

export class BootstrapDefaultsUseCase {
  constructor(private readonly repository: IBootstrapDefaultsRepository) {}

  async execute(
    hashPassword: PasswordHasher,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<BootstrapDefaultsResult> {
    const users = await this.repository.getUsers();
    let createdUsers = false;
    let createdRegion = false;

    if (users.length === 0) {
      const bootstrapPassword = assertSafeBootstrapPassword(env.BOOTSTRAP_ADMIN_PASSWORD);
      const bootstrapUsername = (env.BOOTSTRAP_ADMIN_USERNAME || 'admin').trim() || 'admin';
      const bootstrapFullName = (env.BOOTSTRAP_ADMIN_FULL_NAME || 'مدير النظام').trim();
      const bootstrapEmail =
        (env.BOOTSTRAP_ADMIN_EMAIL || `${bootstrapUsername}@localhost.local`).trim();

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

      const adminPassword = await hashPassword(bootstrapPassword);

      // ERP-008 P1.1: create ONLY the first admin — never seed tech/supervisor with defaults.
      await this.repository.createUser({
        username: bootstrapUsername,
        email: bootstrapEmail,
        password: adminPassword,
        fullName: bootstrapFullName,
        city: 'الرياض',
        role: 'admin',
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
