import { db } from "@core/config/db";
import { coreJobs } from "@shared/schema";
import { eq, and, or, gt, lt, sql } from "drizzle-orm";
import type { JobStatus, ProgressDetails, ResultMetadata } from "./jobs.types";

export class JobsRepository {
  async createJob(params: {
    type: string;
    ownerId: string;
    payload?: string;
    expiresInHours?: number;
  }): Promise<string> {
    const hours = params.expiresInHours || 24; // default 24h retention
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    
    const [inserted] = await db
      .insert(coreJobs)
      .values({
        type: params.type,
        ownerId: params.ownerId,
        status: "PENDING",
        payload: params.payload,
        expiresAt,
        progress: 0,
        retryCount: 0,
      })
      .returning({ id: coreJobs.id });
      
    return inserted.id;
  }

  async getJobById(id: string) {
    const [job] = await db
      .select()
      .from(coreJobs)
      .where(eq(coreJobs.id, id));
    return job || null;
  }

  async updateProgress(id: string, progress: number, details?: ProgressDetails): Promise<void> {
    const updateData: any = { progress };
    if (details) {
      updateData.progressDetails = JSON.stringify(details);
    }
    await db
      .update(coreJobs)
      .set(updateData)
      .where(eq(coreJobs.id, id));
  }

  async updateHeartbeat(id: string): Promise<void> {
    await db
      .update(coreJobs)
      .set({ lastHeartbeatAt: new Date() })
      .where(eq(coreJobs.id, id));
  }

  async completeJob(id: string, result: ResultMetadata | string): Promise<void> {
    const resultUrl = typeof result === "string" ? result : result.url;
    const resultMetadata = typeof result === "string" ? null : JSON.stringify(result);

    await db
      .update(coreJobs)
      .set({
        status: "COMPLETED",
        progress: 100,
        resultUrl,
        resultMetadata,
        finishedAt: new Date(),
      })
      .where(eq(coreJobs.id, id));
  }

  async failJob(id: string, errorMessage: string, retry: boolean, currentRetryCount: number = 0): Promise<void> {
    const updateData: any = {
      errorMessage,
      lastErrorAt: new Date(),
      finishedAt: new Date(),
    };
    
    if (retry) {
      updateData.status = "PENDING"; // set back to pending for retry
      updateData.retryCount = sql`retry_count + 1`;
      updateData.progress = 0;
      // Exponential backoff: 30s * 2^retryCount
      const delayMs = Math.pow(2, currentRetryCount) * 30 * 1000;
      updateData.nextRetryAt = new Date(Date.now() + delayMs);
    } else {
      updateData.status = "FAILED";
    }

    await db
      .update(coreJobs)
      .set(updateData)
      .where(eq(coreJobs.id, id));
  }

  async cancelJob(id: string): Promise<void> {
    await db
      .update(coreJobs)
      .set({
        status: "CANCELLED",
        finishedAt: new Date(),
      })
      .where(eq(coreJobs.id, id));
  }

  /**
   * Atomically claims the next eligible PENDING job using SELECT FOR UPDATE SKIP LOCKED.
   */
  async claimNextJob(): Promise<any | null> {
    return await db.transaction(async (tx) => {
      // Find one PENDING job where nextRetryAt is null or in the past
      const [eligible] = await tx
        .select()
        .from(coreJobs)
        .where(
          and(
            eq(coreJobs.status, "PENDING"),
            gt(coreJobs.expiresAt, new Date()),
            or(
              sql`next_retry_at IS NULL`,
              lt(coreJobs.nextRetryAt, new Date())
            )
          )
        )
        .limit(1)
        .for("update", { skipLocked: true });

      if (!eligible) {
        return null;
      }

      // Update its status to RUNNING and set initial heartbeat
      await tx
        .update(coreJobs)
        .set({
          status: "RUNNING",
          startedAt: new Date(),
          lastHeartbeatAt: new Date(),
        })
        .where(eq(coreJobs.id, eligible.id));

      return {
        ...eligible,
        status: "RUNNING",
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
      };
    });
  }

  /**
   * Recovers stale running jobs that have missed worker heartbeat ticks.
   */
  async recoverStaleJobs(staleThresholdMs: number = 120000): Promise<number> {
    const thresholdDate = new Date(Date.now() - staleThresholdMs);
    
    const staleJobs = await db
      .select()
      .from(coreJobs)
      .where(
        and(
          eq(coreJobs.status, "RUNNING"),
          or(
            lt(coreJobs.lastHeartbeatAt, thresholdDate),
            and(
              sql`last_heartbeat_at IS NULL`,
              lt(coreJobs.startedAt, thresholdDate)
            )
          )
        )
      );

    if (staleJobs.length === 0) return 0;

    for (const job of staleJobs) {
      const canRetry = job.retryCount < job.maxRetries;
      if (canRetry) {
        const delayMs = Math.pow(2, job.retryCount) * 30 * 1000;
        await db
          .update(coreJobs)
          .set({
            status: "PENDING",
            retryCount: job.retryCount + 1,
            progress: 0,
            errorMessage: "Job execution stalled (worker heartbeat timeout). Re-queued automatically.",
            nextRetryAt: new Date(Date.now() + delayMs),
            lastHeartbeatAt: null,
          })
          .where(eq(coreJobs.id, job.id));
      } else {
        await db
          .update(coreJobs)
          .set({
            status: "FAILED",
            errorMessage: "Job execution stalled and exceeded maximum retries.",
            finishedAt: new Date(),
          })
          .where(eq(coreJobs.id, job.id));
      }
    }

    return staleJobs.length;
  }

  /**
   * Cleans up expired jobs and their assets.
   */
  async purgeExpiredJobs(): Promise<number> {
    const expired = await db
      .select()
      .from(coreJobs)
      .where(lt(coreJobs.expiresAt, new Date()));
      
    if (expired.length === 0) return 0;
    
    const expiredIds = expired.map(j => j.id);
    await db
      .update(coreJobs)
      .set({ status: "EXPIRED" })
      .where(eq(coreJobs.status, "COMPLETED")); // mark as expired

    return expiredIds.length;
  }
}

export const jobsRepository = new JobsRepository();
