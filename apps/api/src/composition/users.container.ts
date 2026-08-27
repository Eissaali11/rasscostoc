import { UserManagementUseCase } from "@modules/identity/application/users/use-cases/UserManagement.use-case";
import { UserRepository } from "@modules/identity/infrastructure/database/UserRepository";
import { DrizzleIdentityUnitOfWork } from "@modules/identity/infrastructure/repositories/DrizzleIdentityUnitOfWork";

class UsersContainer {
  private readonly repository = new UserRepository();
  private readonly identityUnitOfWork = new DrizzleIdentityUnitOfWork();

  readonly userManagementUseCase = new UserManagementUseCase(this.repository, this.identityUnitOfWork);
}

export const usersContainer = new UsersContainer();
