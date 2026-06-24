import { SupervisorAssignmentsUseCase } from "@modules/identity/application/users/use-cases/SupervisorAssignments.use-case";
import { SupervisorRepository } from "@modules/identity/infrastructure/database/SupervisorRepository";

class SupervisorAssignmentsContainer {
  private readonly repository = new SupervisorRepository();

  readonly supervisorAssignmentsUseCase = new SupervisorAssignmentsUseCase(this.repository);
}

export const supervisorAssignmentsContainer = new SupervisorAssignmentsContainer();
