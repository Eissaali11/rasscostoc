import { AuthService } from "@modules/identity/application/auth.service";
import { UserRepository } from "@modules/identity/infrastructure/database/UserRepository";
import { DrizzleRefreshTokenRepository } from "@modules/identity/infrastructure/database/DrizzleRefreshTokenRepository";

class AuthContainer {
  private readonly userRepository = new UserRepository();
  private readonly refreshTokenRepository = new DrizzleRefreshTokenRepository();

  readonly authService = new AuthService(this.userRepository, this.refreshTokenRepository);
}

export const authContainer = new AuthContainer();
export const authService = authContainer.authService;
