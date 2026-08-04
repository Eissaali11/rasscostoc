import { EmployeeProfileUseCase } from "@modules/identity/application/users/use-cases/EmployeeProfile.use-case";
import { EmployeeProfileRepository } from "@modules/identity/infrastructure/database/EmployeeProfileRepository";

class EmployeeProfileContainer {
  private readonly repository = new EmployeeProfileRepository();

  readonly employeeProfileUseCase = new EmployeeProfileUseCase(this.repository);
}

export const employeeProfileContainer = new EmployeeProfileContainer();
