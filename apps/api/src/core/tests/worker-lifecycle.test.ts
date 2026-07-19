import { describe, expect, it } from "vitest";
import { JobsWorker } from "../jobs/jobs.worker";
import { OutboxWorker } from "../outbox/outbox.worker";

describe("Worker Lifecycle Drain Tests", () => {
  it("JobsWorker.drain should resolve immediately if no jobs are active", async () => {
    const worker = new JobsWorker();
    const startTime = Date.now();
    await worker.drain(1000);
    expect(Date.now() - startTime).toBeLessThan(100);
  });

  it("JobsWorker.drain should wait for active job count to become zero", async () => {
    const worker = new JobsWorker();
    (worker as any).activeJobsCount = 1;

    setTimeout(() => {
      (worker as any).activeJobsCount = 0;
    }, 150);

    const startTime = Date.now();
    await worker.drain(1000);
    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThanOrEqual(140);
    expect(duration).toBeLessThan(300);
  });

  it("JobsWorker.drain should resolve on timeout if jobs remain active", async () => {
    const worker = new JobsWorker();
    (worker as any).activeJobsCount = 1;

    const startTime = Date.now();
    await worker.drain(100);
    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThanOrEqual(100);
    expect(duration).toBeLessThan(200);
  });

  it("OutboxWorker.drain should resolve immediately if no batch is executing", async () => {
    const worker = new OutboxWorker();
    const startTime = Date.now();
    await worker.drain(1000);
    expect(Date.now() - startTime).toBeLessThan(100);
  });

  it("OutboxWorker.drain should wait for active currentRunPromise to resolve", async () => {
    const worker = new OutboxWorker();
    let resolvePromise: any;
    const runPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    (worker as any).currentRunPromise = runPromise;

    setTimeout(() => {
      resolvePromise();
      (worker as any).currentRunPromise = null;
    }, 150);

    const startTime = Date.now();
    await worker.drain(1000);
    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThanOrEqual(140);
    expect(duration).toBeLessThan(300);
  });
});
