import type { ISystemLogsRepository, SystemLogsFilters } from '../contracts/ISystemLogsRepository';
import type { SystemLog } from "@shared/schema";

type GetSystemLogsInput = SystemLogsFilters & { page?: number };

export class GetSystemLogsUseCase {
  constructor(private readonly systemLogsRepository: ISystemLogsRepository) {}

  async execute(filters?: GetSystemLogsInput): Promise<SystemLog[]> {
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? (filters?.page ? (filters.page - 1) * limit : 0);

    const { page: _page, ...repositoryFilters } = filters ?? {};

    return this.systemLogsRepository.getSystemLogs({
      ...repositoryFilters,
      limit,
      offset,
    });
  }
}
