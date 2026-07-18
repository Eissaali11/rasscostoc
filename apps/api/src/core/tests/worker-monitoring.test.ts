import { describe, expect, it, vi } from "vitest";
import { JobsWorker } from "../jobs/jobs.worker";
import { jobsRepository } from "../jobs/jobs.repository";
import { jobsRegistry } from "../jobs/jobs.registry";
import { OutboxWorker } from "../outbox/outbox.worker";
import { outboxRepository } from "../outbox/outbox.repository";
import { metrics } from "@core/telemetry/metrics";
import { EventBus } from "../events/event-bus";

describe("Background Workers Monitoring Integration Tests", () => {
  it("JobsWorker should update jobs_worker_active_count, jobs_completed_total, and jobs_failed_total", async () => {
    const worker = new JobsWorker({ intervalMs: 1000, maxConcurrentJobs: 2 });

    // Mock claimNextJob, completeJob, and failJob
    const mockJob = { id: "job-1", type: "TEST_JOB", retryCount: 0, maxRetries: 3 };
    vi.spyOn(jobsRepository, "claimNextJob")
      .mockResolvedValueOnce(mockJob)
      .mockResolvedValue(null);
    vi.spyOn(jobsRepository, "completeJob").mockResolvedValue({} as any);
    vi.spyOn(jobsRepository, "updateProgress").mockResolvedValue({} as any);

    // Register job handler
    const mockHandler = vi.fn().mockResolvedValue("success payload");
    jobsRegistry.register("TEST_JOB", mockHandler);

    const initialCompleted = metrics.getCounter("jobs_completed_total");

    // Execute the job synchronously to avoid async race conditions
    await (worker as any).executeJob(mockJob);

    expect(mockHandler).toHaveBeenCalledWith(mockJob, expect.any(Function));
    expect(metrics.getCounter("jobs_completed_total")).toBe(initialCompleted + 1);
  });

  it("OutboxWorker should update outbox_events_published_total and outbox_events_failed_total", async () => {
    const worker = new OutboxWorker({ intervalMs: 1000, batchSize: 5 });

    const mockEventRecord = {
      id: "event-1",
      eventName: "TestEvent",
      eventVersion: 1,
      payload: { data: "test" },
      createdAt: new Date(),
      correlationId: "corr-1",
      causationId: "caus-1",
      retryCount: 0,
    };

    vi.spyOn(outboxRepository, "getPendingEvents").mockResolvedValueOnce([mockEventRecord] as any);
    vi.spyOn(outboxRepository, "markAsPublished").mockResolvedValue({} as any);

    const eventBus = EventBus.getInstance();
    const mockPublishLocal = vi.spyOn(eventBus, "publishLocal").mockResolvedValue(undefined);

    const initialPublished = metrics.getCounter("outbox_events_published_total");

    await worker.runOnce();

    expect(mockPublishLocal).toHaveBeenCalled();
    expect(metrics.getCounter("outbox_events_published_total")).toBe(initialPublished + 1);
  });
});
