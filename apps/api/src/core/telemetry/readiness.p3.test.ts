import { describe, expect, it, beforeEach } from "vitest";
import { readinessManager } from "./readiness";

/**
 * ERP-008 Phase 3 — readiness state transitions used by the lifecycle
 * coordinator: jobsWorker is now a tracked prerequisite (previously it
 * started without ever being reflected in isReady()), and shuttingDown
 * must independently force isReady() to false regardless of every other
 * flag, so /health/ready flips to 503 before the HTTP listener closes.
 */
describe("ERP-008 Phase 3 — ReadinessManager", () => {
  beforeEach(() => {
    readinessManager.setDBConnected(false);
    readinessManager.setSubscribersRegistered(false);
    readinessManager.setOutboxWorkerStarted(false);
    readinessManager.setJobsWorkerStarted(false);
    readinessManager.setFeatureFlagsLoaded(false);
    readinessManager.setShuttingDown(false);
  });

  it("is not ready until every tracked resource, including jobsWorker, is up", () => {
    readinessManager.setDBConnected(true);
    readinessManager.setSubscribersRegistered(true);
    readinessManager.setOutboxWorkerStarted(true);
    readinessManager.setFeatureFlagsLoaded(true);
    expect(readinessManager.isReady()).toBe(false); // jobsWorker still missing

    readinessManager.setJobsWorkerStarted(true);
    expect(readinessManager.isReady()).toBe(true);
  });

  it("setShuttingDown(true) forces isReady() to false even when every resource is up", () => {
    readinessManager.setDBConnected(true);
    readinessManager.setSubscribersRegistered(true);
    readinessManager.setOutboxWorkerStarted(true);
    readinessManager.setJobsWorkerStarted(true);
    readinessManager.setFeatureFlagsLoaded(true);
    expect(readinessManager.isReady()).toBe(true);

    readinessManager.setShuttingDown(true);
    expect(readinessManager.isReady()).toBe(false);
    expect(readinessManager.getDetails().shuttingDown).toBe(true);
  });
});
