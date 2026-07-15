import { BootstrapDefaultsUseCase } from '@core/bootstrap/use-cases/BootstrapDefaults.use-case';
import { DrizzleBootstrapDefaultsRepository } from './DrizzleBootstrapDefaultsRepository';

class BootstrapDefaultsContainer {
  private readonly repository = new DrizzleBootstrapDefaultsRepository();

  readonly bootstrapDefaultsUseCase = new BootstrapDefaultsUseCase(this.repository);
}

export const bootstrapDefaultsContainer = new BootstrapDefaultsContainer();
