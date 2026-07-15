import type { JobHandler } from "./jobs.types";

export class JobsRegistry {
  private handlers = new Map<string, JobHandler>();

  register(type: string, handler: JobHandler): void {
    if (this.handlers.has(type)) {
      console.warn(`[JobsRegistry] Overwriting handler for type: ${type}`);
    }
    this.handlers.set(type, handler);
  }

  getHandler(type: string): JobHandler | undefined {
    return this.handlers.get(type);
  }
}

export const jobsRegistry = new JobsRegistry();
