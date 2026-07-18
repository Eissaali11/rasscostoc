import { jobsRepository } from "./jobs.repository";
import { jobsRegistry } from "./jobs.registry";
import { randomUUID } from "crypto";

export class JobsWorker {
  private readonly workerId: string;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private purgeIntervalId: NodeJS.Timeout | null = null;
  private recoveryIntervalId: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private activeJobsCount: number = 0;
  private readonly maxConcurrentJobs: number = 2;

  constructor(options?: { intervalMs?: number; maxConcurrentJobs?: number }) {
    this.workerId = `job-worker-${randomUUID()}`;
    this.intervalMs = options?.intervalMs || 3000; // poll every 3 seconds
    this.maxConcurrentJobs = options?.maxConcurrentJobs || 2;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.info(`[JobsWorker] Started Asynchronous Job Worker: ${this.workerId}`);

    // Poll trigger
    this.intervalId = setInterval(async () => {
      if (this.activeJobsCount >= this.maxConcurrentJobs) {
        return; // at capacity
      }
      try {
        await this.pollAndExecute();
      } catch (err) {
        console.error("[JobsWorker] Error in poll loop:", err);
      }
    }, this.intervalMs);

    // Stale jobs recovery trigger (every 1 minute)
    this.recoveryIntervalId = setInterval(async () => {
      try {
        const count = await jobsRepository.recoverStaleJobs();
        if (count > 0) {
          console.info(`[JobsWorker] Recovered/Requeued ${count} stale jobs.`);
        }
      } catch (err) {
        console.error("[JobsWorker] Error recovering stale jobs:", err);
      }
    }, 60 * 1000);

    // Purge trigger (every 1 hour)
    this.purgeIntervalId = setInterval(async () => {
      try {
        const count = await jobsRepository.purgeExpiredJobs();
        if (count > 0) {
          console.info(`[JobsWorker] Purged ${count} expired jobs.`);
        }
      } catch (err) {
        console.error("[JobsWorker] Error purging expired jobs:", err);
      }
    }, 60 * 60 * 1000);
  }

  /**
   * ERP-008 Phase 3: stops accepting new poll ticks immediately, then waits
   * (bounded by drainTimeoutMs) for any job(s) already claimed via
   * pollAndExecute() to finish via executeJob()'s own completeJob/failJob
   * path, so a shutdown never abandons a job mid-execution.
   */
  async stop(drainTimeoutMs = 8000): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.recoveryIntervalId) {
      clearInterval(this.recoveryIntervalId);
      this.recoveryIntervalId = null;
    }
    if (this.purgeIntervalId) {
      clearInterval(this.purgeIntervalId);
      this.purgeIntervalId = null;
    }

    const drainStart = Date.now();
    while (this.activeJobsCount > 0 && Date.now() - drainStart < drainTimeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (this.activeJobsCount > 0) {
      console.warn(
        `[JobsWorker] Stop drain timeout: ${this.activeJobsCount} job(s) still active after ${drainTimeoutMs}ms.`
      );
    }

    console.info(`[JobsWorker] Stopped Asynchronous Job Worker: ${this.workerId}`);
  }

  private async pollAndExecute(): Promise<void> {
    const job = await jobsRepository.claimNextJob();
    if (!job) {
      return; // No pending jobs
    }

    this.activeJobsCount++;
    console.info(`[JobsWorker] Claimed job ${job.id} (Type: ${job.type}). Active: ${this.activeJobsCount}`);

    // Process asynchronously so we can poll again if capacity permits
    this.executeJob(job).catch(err => {
      console.error(`[JobsWorker] Critical error executing job ${job.id}:`, err);
    }).finally(() => {
      this.activeJobsCount--;
    });
  }

  private async executeJob(job: any): Promise<void> {
    const handler = jobsRegistry.getHandler(job.type);
    if (!handler) {
      console.error(`[JobsWorker] No handler registered for job type: ${job.type}`);
      await jobsRepository.failJob(job.id, `No handler registered for job type: ${job.type}`, false);
      return;
    }

    // Start heartbeat ticker
    const heartbeatInterval = setInterval(async () => {
      try {
        await jobsRepository.updateHeartbeat(job.id);
      } catch (hbErr) {
        console.error(`[JobsWorker] Heartbeat update failed for job ${job.id}:`, hbErr);
      }
    }, 15000); // 15s heartbeats

    try {
      // Progress updater callback passed to handler
      const updateProgress = async (progress: number, details?: any) => {
        await jobsRepository.updateProgress(
          job.id,
          Math.min(100, Math.max(0, Math.round(progress))),
          details
        );
      };

      const result = await handler(job, updateProgress);
      
      await jobsRepository.completeJob(job.id, result || "");
      console.info(`[JobsWorker] Completed job ${job.id} successfully.`);
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.error(`[JobsWorker] Job ${job.id} failed:`, errorMsg);

      const nextRetryCount = job.retryCount + 1;
      const canRetry = nextRetryCount < job.maxRetries;

      await jobsRepository.failJob(job.id, errorMsg, canRetry, job.retryCount);
    } finally {
      clearInterval(heartbeatInterval);
    }
  }
}

export const jobsWorker = new JobsWorker();
