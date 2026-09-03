import { PermissionsService } from "@modules/permissions/application/PermissionsService";
import { DrizzlePermissionsRepository } from "@modules/permissions/infrastructure/DrizzlePermissionsRepository";
import { UserRepositoryActorLookup } from "@modules/permissions/infrastructure/UserRepositoryActorLookup";
import { DrizzleUserRepository } from "@modules/identity/infrastructure/database/DrizzleUserRepository";

class PermissionsContainer {
  private readonly repository = new DrizzlePermissionsRepository();
  private readonly actorLookup = new UserRepositoryActorLookup(new DrizzleUserRepository());

  readonly service = new PermissionsService(this.repository, this.actorLookup);
}

export const permissionsContainer = new PermissionsContainer();
