import { SupervisorAssignmentsUseCase } from "@modules/identity/application/users/use-cases/SupervisorAssignments.use-case";
import { repositories } from "@modules/inventory/infrastructure/database";

class SupervisorAssignmentsContainer {
  readonly supervisorAssignmentsUseCase = new SupervisorAssignmentsUseCase(repositories.supervisorAssignments);
}

export const supervisorAssignmentsContainer = new SupervisorAssignmentsContainer();
