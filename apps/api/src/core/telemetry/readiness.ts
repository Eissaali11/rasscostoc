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
    listening: false,
  };

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

  setListening(val: boolean): void {
    this.status.listening = val;
  }

  isReady(): boolean {
    return (
      this.status.database &&
      this.status.subscribers &&
      this.status.outboxWorker &&
      this.status.jobsWorker &&
      this.status.featureFlags &&
      this.status.listening
    );
  }

  getDetails() {
    return { ...this.status };
  }
}

export const readinessManager = new ReadinessManager();
export default readinessManager;
