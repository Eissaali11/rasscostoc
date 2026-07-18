/**
 * Readiness Telemetry Manager
 *
 * Tracks startup milestones to expose system readiness status.
 */

class ReadinessManager {
  private status = {
    database: false,
    subscribers: false,
    outboxWorker: false,
    jobsWorker: false,
    featureFlags: false,
  };
  private shuttingDown = false;

  setDBConnected(val: boolean): void {
    this.status.database = val;
  }

  setSubscribersRegistered(val: boolean): void {
    this.status.subscribers = val;
  }

  setOutboxWorkerStarted(val: boolean): void {
    this.status.outboxWorker = val;
  }

  setJobsWorkerStarted(val: boolean): void {
    this.status.jobsWorker = val;
  }

  setFeatureFlagsLoaded(val: boolean): void {
    this.status.featureFlags = val;
  }

  /** ERP-008 Phase 3: flips /health/ready to DOWN before the HTTP listener closes. */
  setShuttingDown(val: boolean): void {
    this.shuttingDown = val;
  }

  isReady(): boolean {
    return (
      !this.shuttingDown &&
      this.status.database &&
      this.status.subscribers &&
      this.status.outboxWorker &&
      this.status.jobsWorker &&
      this.status.featureFlags
    );
  }

  getDetails() {
    return { ...this.status, shuttingDown: this.shuttingDown };
  }
}

export const readinessManager = new ReadinessManager();
export default readinessManager;
