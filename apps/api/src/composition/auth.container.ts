import { AuthService } from "@modules/identity/application/auth.service";
import { UserRepository } from "@modules/identity/infrastructure/database/UserRepository";
import { DrizzleRefreshTokenRepository } from "@modules/identity/infrastructure/database/DrizzleRefreshTokenRepository";
import { DrizzleIdentityUnitOfWork } from "@modules/identity/infrastructure/repositories/DrizzleIdentityUnitOfWork";

class AuthContainer {
  private readonly userRepository = new UserRepository();
  private readonly refreshTokenRepository = new DrizzleRefreshTokenRepository();
  private readonly identityUnitOfWork = new DrizzleIdentityUnitOfWork();

  readonly authService = new AuthService(
    this.userRepository,
    this.refreshTokenRepository,
    this.identityUnitOfWork
  );
}

export const authContainer = new AuthContainer();
export const authService = authContainer.authService;
