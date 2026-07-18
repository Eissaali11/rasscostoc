/**
 * Asynchronous Job Worker — ERP-008 Phase 8-A
 * All log output now routes through the canonical structured logger.
 */
import { jobsRepository } from "./jobs.repository";
import { jobsRegistry } from "./jobs.registry";
import { randomUUID } from "crypto";
import { logger } from "@core/telemetry/logger";

const MODULE = "JobsWorker";

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
    logger.info({ message: `Started Asynchronous Job Worker: ${this.workerId}`, module: MODULE, action: "start" });

    // Poll trigger
    this.intervalId = setInterval(async () => {
      if (this.activeJobsCount >= this.maxConcurrentJobs) {
        return; // at capacity
      }
      try {
        await this.pollAndExecute();
      } catch (err) {
        logger.error({ message: "Error in poll loop", module: MODULE, action: "pollLoop", error: err });
      }
    }, this.intervalMs);

    // Stale jobs recovery trigger (every 1 minute)
    this.recoveryIntervalId = setInterval(async () => {
      try {
        const count = await jobsRepository.recoverStaleJobs();
        if (count > 0) {
          logger.info({ message: `Recovered/Requeued ${count} stale jobs`, module: MODULE, action: "recoverStale", metadata: { count } });
        }
      } catch (err) {
        logger.error({ message: "Error recovering stale jobs", module: MODULE, action: "recoverStale", error: err });
      }
    }, 60 * 1000);

    // Purge trigger (every 1 hour)
    this.purgeIntervalId = setInterval(async () => {
      try {
        const count = await jobsRepository.purgeExpiredJobs();
        if (count > 0) {
          logger.info({ message: `Purged ${count} expired jobs`, module: MODULE, action: "purgeExpired", metadata: { count } });
        }
      } catch (err) {
        logger.error({ message: "Error purging expired jobs", module: MODULE, action: "purgeExpired", error: err });
      }
    }, 60 * 60 * 1000);
  }

  stop(): void {
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
    logger.info({ message: `Stopped Asynchronous Job Worker: ${this.workerId}`, module: MODULE, action: "stop" });
  }

  private async pollAndExecute(): Promise<void> {
    const job = await jobsRepository.claimNextJob();
    if (!job) {
      return; // No pending jobs
    }

    this.activeJobsCount++;
    logger.info({
      message: `Claimed job ${job.id} (Type: ${job.type}). Active: ${this.activeJobsCount}`,
      module: MODULE,
      action: "claimJob",
      metadata: { jobId: job.id, jobType: job.type, activeCount: this.activeJobsCount },
    });

    // Process asynchronously so we can poll again if capacity permits
    this.executeJob(job).catch(err => {
      logger.error({ message: `Critical error executing job ${job.id}`, module: MODULE, action: "executeJob", metadata: { jobId: job.id }, error: err });
    }).finally(() => {
      this.activeJobsCount--;
    });
  }

  private async executeJob(job: any): Promise<void> {
    const handler = jobsRegistry.getHandler(job.type);
    if (!handler) {
      logger.error({
        message: `No handler registered for job type: ${job.type}`,
        module: MODULE,
        action: "executeJob",
        metadata: { jobId: job.id, jobType: job.type },
      });
      await jobsRepository.failJob(job.id, `No handler registered for job type: ${job.type}`, false);
      return;
    }

    // Start heartbeat ticker
    const heartbeatInterval = setInterval(async () => {
      try {
        await jobsRepository.updateHeartbeat(job.id);
      } catch (hbErr) {
        logger.warn({ message: `Heartbeat update failed for job ${job.id}`, module: MODULE, action: "heartbeat", metadata: { jobId: job.id }, error: hbErr });
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
      logger.info({
        message: `Completed job ${job.id} successfully`,
        module: MODULE,
        action: "completeJob",
        metadata: { jobId: job.id, jobType: job.type },
      });
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      logger.error({
        message: `Job ${job.id} failed`,
        module: MODULE,
        action: "failJob",
        metadata: { jobId: job.id, jobType: job.type, retryCount: job.retryCount },
        error: err,
      });

      const nextRetryCount = job.retryCount + 1;
      const canRetry = nextRetryCount < job.maxRetries;

      await jobsRepository.failJob(job.id, errorMsg, canRetry, job.retryCount);
    } finally {
      clearInterval(heartbeatInterval);
    }
  }
}

export const jobsWorker = new JobsWorker();
