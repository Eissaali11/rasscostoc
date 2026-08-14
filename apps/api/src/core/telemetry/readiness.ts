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
    // OPS-REMED-E4-P2: matches the existing binary started/not-started
    // precedent exactly (same as outboxWorker/jobsWorker above) —
    // deliberately no poll-level (last-success/last-failure/backlog)
    // tracking, per A.10 §2.
    courierProjectionWorker: false,
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

  setCourierProjectionWorkerStarted(val: boolean): void {
    this.status.courierProjectionWorker = val;
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
      // OPS-REMED-E4-P2: courierProjectionWorker is tracked (see
      // getDetails()/setCourierProjectionWorkerStarted below) but
      // deliberately NOT added to this gate — doing so would change
      // isReady()'s existing contract asserted by readiness.p3.test.ts
      // (a pre-existing file outside E4-P2's authorized manifest). The
      // worker's own started-state remains observable without widening
      // what /health/ready requires.
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
