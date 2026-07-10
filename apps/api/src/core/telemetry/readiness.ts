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
    featureFlags: false,
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

  setFeatureFlagsLoaded(val: boolean): void {
    this.status.featureFlags = val;
  }

  isReady(): boolean {
    return this.status.database && this.status.subscribers && this.status.outboxWorker && this.status.featureFlags;
  }

  getDetails() {
    return { ...this.status };
  }
}

export const readinessManager = new ReadinessManager();
export default readinessManager;
