import { SupervisorUsersReadUseCase } from "@modules/identity/application/users/use-cases/SupervisorUsersRead.use-case";
import { DrizzleSupervisorUsersReadRepository } from "@modules/identity/infrastructure/database/DrizzleSupervisorUsersReadRepository";

class SupervisorUsersContainer {
  private readonly repository = new DrizzleSupervisorUsersReadRepository();

  readonly supervisorUsersReadUseCase = new SupervisorUsersReadUseCase(this.repository);
}

export const supervisorUsersContainer = new SupervisorUsersContainer();