/**
 * Employee profile use case — thin application-layer boundary between the
 * presentation controller and the infrastructure repository, so the
 * controller depends on an application service rather than a repository.
 */

import type { IEmployeeProfileRepository } from "../contracts/IEmployeeProfileRepository";

export class EmployeeProfileUseCase {
  constructor(private readonly repository: IEmployeeProfileRepository) {}

  findUserById(userId: string) {
    return this.repository.findUserById(userId);
  }

  getProfileData(userId: string) {
    return this.repository.getProfileData(userId);
  }

  upsertProfileData(userId: string, profileData: Parameters<IEmployeeProfileRepository["upsertProfileData"]>[1]) {
    return this.repository.upsertProfileData(userId, profileData);
  }

  updateUserCore(userId: string, patch: Parameters<IEmployeeProfileRepository["updateUserCore"]>[1]) {
    return this.repository.updateUserCore(userId, patch);
  }
}
