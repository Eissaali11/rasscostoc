import { UserManagementUseCase } from "@modules/identity/application/users/use-cases/UserManagement.use-case";
import { UserRepository } from "@modules/identity/infrastructure/database/UserRepository";

class UsersContainer {
  private readonly repository = new UserRepository();

  readonly userManagementUseCase = new UserManagementUseCase(this.repository);
}

export const usersContainer = new UsersContainer();