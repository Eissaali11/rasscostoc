import type {
  TechnicianFixedInventory,
  TechnicianInventory,
  UserSafe,
} from "@shared/schema";
import type { ISupervisorUsersReadRepository } from '@stockpro/contracts';

const SUPERVISOR_REGION_REQUIRED_MESSAGE = 'المشرف يجب أن يكون مرتبط بمنطقة';
const USER_REGION_ACCESS_DENIED_MESSAGE = 'لا يمكنك الوصول إلى مستخدمين خارج منطقتك';

export class SupervisorUsersReadUseCaseError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'SupervisorUsersReadUseCaseError';
  }
}

export type SupervisorUsersReadInput = {
  supervisorRegionId?: string | null;
  targetUserId: string;
};

export type SupervisorUserFixedInventoryOutput = (TechnicianFixedInventory & {
  technicianName: string;
  city: string;
}) | null;

export class SupervisorUsersReadUseCase {
  constructor(private readonly repository: ISupervisorUsersReadRepository) {}

  async getUserDetails(input: SupervisorUsersReadInput): Promise<UserSafe> {
    return this.getAuthorizedUser(input, false);
  }

  async getUserFixedInventory(input: SupervisorUsersReadInput): Promise<SupervisorUserFixedInventoryOutput> {
    const targetUser = await this.getAuthorizedUser(input, true);
    const inventory = await this.repository.getTechnicianFixedInventory(input.targetUserId);

    if (!inventory) {
      return null;
    }

    return {
      ...inventory,
      technicianName: targetUser.fullName,
      city: targetUser.city || 'غير محدد',
    };
  }

  async getUserMovingInventory(input: SupervisorUsersReadInput): Promise<TechnicianInventory | null> {
    await this.getAuthorizedUser(input, true);
    const inventory = await this.repository.getTechnicianMovingInventory(input.targetUserId);

    return inventory || null;
  }

  private async getAuthorizedUser(
    input: SupervisorUsersReadInput,
    hideNotFoundAsForbidden: boolean,
  ): Promise<UserSafe> {
    if (!input.supervisorRegionId) {
      throw new SupervisorUsersReadUseCaseError(400, SUPERVISOR_REGION_REQUIRED_MESSAGE);
    }

    const targetUser = await this.repository.getUserById(input.targetUserId);

    if (!targetUser) {
      if (hideNotFoundAsForbidden) {
        throw new SupervisorUsersReadUseCaseError(403, USER_REGION_ACCESS_DENIED_MESSAGE);
      }

      throw new SupervisorUsersReadUseCaseError(404, 'User not found');
    }

    if (targetUser.regionId !== input.supervisorRegionId) {
      throw new SupervisorUsersReadUseCaseError(403, USER_REGION_ACCESS_DENIED_MESSAGE);
    }

    return targetUser;
  }
}