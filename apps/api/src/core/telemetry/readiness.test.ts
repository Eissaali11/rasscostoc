import { describe, it, expect, beforeEach } from "vitest";
import { readinessManager } from "./readiness";

describe("ReadinessManager Unit Tests", () => {
  beforeEach(() => {
    // Reset status fields using private access or setters
    readinessManager.setDBConnected(false);
    readinessManager.setSubscribersRegistered(false);
    readinessManager.setOutboxWorkerStarted(false);
    readinessManager.setJobsWorkerStarted(false);
    readinessManager.setFeatureFlagsLoaded(false);
    readinessManager.setListening(false);
  });

  it("should not be ready by default", () => {
    expect(readinessManager.isReady()).toBe(false);
  });

  it("should become ready only when all conditions are true", () => {
    readinessManager.setDBConnected(true);
    expect(readinessManager.isReady()).toBe(false);

    readinessManager.setSubscribersRegistered(true);
    expect(readinessManager.isReady()).toBe(false);

    readinessManager.setOutboxWorkerStarted(true);
    expect(readinessManager.isReady()).toBe(false);

    readinessManager.setJobsWorkerStarted(true);
    expect(readinessManager.isReady()).toBe(false);

    readinessManager.setFeatureFlagsLoaded(true);
    expect(readinessManager.isReady()).toBe(false);

    readinessManager.setListening(true);
    expect(readinessManager.isReady()).toBe(true);
  });

  it("should return detailed status correctly", () => {
    readinessManager.setDBConnected(true);
    expect(readinessManager.getDetails()).toEqual({
      database: true,
      subscribers: false,
      outboxWorker: false,
      jobsWorker: false,
      featureFlags: false,
      listening: false,
    });
  });
});
