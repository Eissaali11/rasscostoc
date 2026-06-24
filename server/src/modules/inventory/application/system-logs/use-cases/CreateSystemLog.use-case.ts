import type { ISystemLogsRepository } from '../contracts/ISystemLogsRepository';
import type { InsertSystemLog, SystemLog } from "@shared/schema";

export class CreateSystemLogUseCase {
  constructor(private readonly systemLogsRepository: ISystemLogsRepository) {}

  async execute(log: InsertSystemLog): Promise<SystemLog> {
    return this.systemLogsRepository.createSystemLog(log);
  }
}
