import { describe, expect, it, beforeEach } from "vitest";
import { db } from "../config/db";
import { coreJobs, users } from "@shared/schema";
import { jobsRepository } from "./jobs.repository";
import { jobsRegistry } from "./jobs.registry";
import { JobsWorker } from "./jobs.worker";
import { eq } from "drizzle-orm";

describe("Asynchronous Job Framework Integration Tests", () => {
  let userId: string;

  beforeEach(async () => {
    // Clear jobs table
    await db.delete(coreJobs);

    // Get or create a user for references
    const [existingUser] = await db.select().from(users).limit(1);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const testUserId = "test-job-owner-id";
      await db.insert(users).values({
        id: testUserId,
        username: "testjobowner",
        fullName: "Job Test User",
        email: "jobtest@example.com",
        role: "admin",
        password: "mock-hash",
      });
      userId = testUserId;
    }
  });

  it("should successfully dispatch, execute, and complete a background job with metadata and progress details", async () => {
    let handlerExecuted = false;
    let reportedProgress: number[] = [];

    // Register a mock handler using detailed progress and result metadata
    jobsRegistry.register("TEST_SUCCESS_JOB", async (job, updateProgress) => {
      handlerExecuted = true;
      await updateProgress(50, { processedRows: 50, totalRows: 100, currentStep: "Streaming" });
      await updateProgress(100, { processedRows: 100, totalRows: 100, currentStep: "Completed" });
      return {
        url: `file:///tmp/result-${job.id}.xlsx`,
        size: 1024,
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        expires: new Date(Date.now() + 3600000).toISOString()
      };
    });

    // 1. Dispatch job
    const jobId = await jobsRepository.createJob({
      type: "TEST_SUCCESS_JOB",
      ownerId: userId,
      payload: JSON.stringify({ testParam: "value" }),
    });

    const jobBefore = await jobsRepository.getJobById(jobId);
    expect(jobBefore).toBeDefined();
    expect(jobBefore?.status).toBe("PENDING");

    // 2. Claim job
    const claimedJob = await jobsRepository.claimNextJob();
    expect(claimedJob).toBeDefined();
    expect(claimedJob.id).toBe(jobId);
    expect(claimedJob.status).toBe("RUNNING");
    expect(claimedJob.lastHeartbeatAt).toBeDefined();

    // 3. Execute
    const handler = jobsRegistry.getHandler(claimedJob.type);
    expect(handler).toBeDefined();

    const updateProgress = async (pct: number, details?: any) => {
      reportedProgress.push(pct);
      await jobsRepository.updateProgress(claimedJob.id, pct, details);
    };

    const result = await handler!(claimedJob, updateProgress);
    await jobsRepository.completeJob(claimedJob.id, result);

    // 4. Verify in DB
    const jobAfter = await jobsRepository.getJobById(jobId);
    expect(handlerExecuted).toBe(true);
    expect(jobAfter?.status).toBe("COMPLETED");
    expect(jobAfter?.progress).toBe(100);
    expect(jobAfter?.resultUrl).toBe(`file:///tmp/result-${jobId}.xlsx`);
    
    // Verify progressDetails JSON parse
    expect(jobAfter?.progressDetails).toBeDefined();
    const details = JSON.parse(jobAfter?.progressDetails || "{}");
    expect(details.processedRows).toBe(100);
    expect(details.currentStep).toBe("Completed");

    // Verify resultMetadata JSON parse
    expect(jobAfter?.resultMetadata).toBeDefined();
    const resultMeta = JSON.parse(jobAfter?.resultMetadata || "{}");
    expect(resultMeta.size).toBe(1024);
    expect(resultMeta.mime).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("should handle execution failures, increment retries with exponential backoff", async () => {
    let attempts = 0;

    jobsRegistry.register("TEST_FAIL_JOB", async () => {
      attempts++;
      throw new Error(`Execution Failed Attempt ${attempts}`);
    });

    const jobId = await jobsRepository.createJob({
      type: "TEST_FAIL_JOB",
      ownerId: userId,
    });

    const claimed1 = await jobsRepository.claimNextJob();
    expect(claimed1.id).toBe(jobId);

    try {
      const handler = jobsRegistry.getHandler(claimed1.type);
      await handler!(claimed1, async () => {});
    } catch (err: any) {
      await jobsRepository.failJob(claimed1.id, err.message, true, claimed1.retryCount);
    }

    const jobAfter1 = await jobsRepository.getJobById(jobId);
    expect(jobAfter1?.status).toBe("PENDING");
    expect(jobAfter1?.retryCount).toBe(1);
    expect(jobAfter1?.nextRetryAt).toBeDefined();
    // nextRetryAt should be set in the future (approx 30s)
    const timeDiff = new Date(jobAfter1!.nextRetryAt!).getTime() - Date.now();
    expect(timeDiff).toBeGreaterThan(20000); // at least 20 seconds delay
  });

  it("should recover stale running jobs that missed heartbeats", async () => {
    const jobId = await jobsRepository.createJob({
      type: "TEST_RECOVER_JOB",
      ownerId: userId,
    });

    // Claim the job to move it to RUNNING
    await jobsRepository.claimNextJob();

    // Force its lastHeartbeatAt back by 3 minutes to make it stale
    await db
      .update(coreJobs)
      .set({ lastHeartbeatAt: new Date(Date.now() - 180000) })
      .where(eq(coreJobs.id, jobId));

    // Run recovery
    const recoveredCount = await jobsRepository.recoverStaleJobs(120000); // 2 minutes threshold
    expect(recoveredCount).toBe(1);

    const jobAfter = await jobsRepository.getJobById(jobId);
    expect(jobAfter?.status).toBe("PENDING");
    expect(jobAfter?.retryCount).toBe(1);
    expect(jobAfter?.errorMessage).toContain("stalled");
  });
});
