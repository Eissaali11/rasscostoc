import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { db } from "../config/db";
import { coreJobs, users } from "@shared/schema";
import { jobsRepository } from "./jobs.repository";
import { jobsRegistry } from "./jobs.registry";
import { JobsWorker } from "./jobs.worker";
import { eq } from "drizzle-orm";

/**
 * ERP-008 Phase 3 — proves JobsWorker.stop() actually drains a job that's
 * already executing (claimed via the real poll loop) instead of abandoning
 * it mid-run, using the real jobs table and a real running worker instance
 * (no mocks).
 */
describe("ERP-008 Phase 3 — JobsWorker graceful stop drains in-flight jobs", () => {
  let userId: string;

  beforeEach(async () => {
    await db.delete(coreJobs);
    const [existingUser] = await db.select().from(users).limit(1);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const testUserId = "test-job-owner-drain";
      await db.insert(users).values({
        id: testUserId,
        username: "testjobownerdrain",
        fullName: "Job Drain Test User",
        email: "jobdraintest@example.com",
        role: "admin",
        password: "mock-hash",
      });
      userId = testUserId;
    }
  });

  afterEach(async () => {
    await db.delete(coreJobs).where(eq(coreJobs.ownerId, userId));
  });

  it("stop() waits for an already-claimed job to finish instead of abandoning it", async () => {
    let handlerStarted = false;
    let handlerFinishedBeforeStopResolved = false;

    jobsRegistry.register("TEST_DRAIN_JOB", async () => {
      handlerStarted = true;
      await new Promise((resolve) => setTimeout(resolve, 300));
      handlerFinishedBeforeStopResolved = true;
      return "done";
    });

    const jobId = await jobsRepository.createJob({
      type: "TEST_DRAIN_JOB",
      ownerId: userId,
    });

    const worker = new JobsWorker({ intervalMs: 100 });
    worker.start();

    // Wait until the poll loop has actually claimed and started the job.
    const pollStart = Date.now();
    while (!handlerStarted && Date.now() - pollStart < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(handlerStarted).toBe(true);

    // Shutdown begins while the job is still executing.
    await worker.stop(5000);

    expect(handlerFinishedBeforeStopResolved).toBe(true);

    const job = await jobsRepository.getJobById(jobId);
    expect(job?.status).toBe("COMPLETED");
  });

  it("stop() respects its drain timeout instead of hanging forever on a stuck job", async () => {
    jobsRegistry.register("TEST_STUCK_JOB", async () => {
      await new Promise(() => {
        /* never resolves */
      });
      return "unreachable";
    });

    const jobId = await jobsRepository.createJob({
      type: "TEST_STUCK_JOB",
      ownerId: userId,
    });

    const worker = new JobsWorker({ intervalMs: 100 });
    worker.start();

    // Wait until the worker's own poll loop has claimed it (status flips
    // PENDING -> RUNNING); do not claim it ourselves, that would steal it
    // from the worker and defeat the point of this test.
    const pollStart = Date.now();
    let running = false;
    while (!running && Date.now() - pollStart < 3000) {
      const job = await jobsRepository.getJobById(jobId);
      running = job?.status === "RUNNING";
      if (!running) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(running).toBe(true);

    const start = Date.now();
    await worker.stop(500);
    const elapsedMs = Date.now() - start;

    expect(elapsedMs).toBeLessThan(1500);
    expect(elapsedMs).toBeGreaterThanOrEqual(450);
  });
});
