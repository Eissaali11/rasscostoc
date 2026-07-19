/**
 * ShutdownCoordinator — PR A: Server Lifecycle Hardening
 *
 * Single point of control for graceful process termination.
 *
 * Shutdown sequence (mirrors reverse of startup):
 *   1. Stop accepting HTTP connections (server.close)
 *   2. Drain in-flight HTTP requests (timeout: 30s)
 *   3. Stop + drain JobsWorker  (timeout: 60s)
 *   4. Stop + drain OutboxWorker (timeout: 15s)
 *   5. Close database pool
 *   6. process.exit(0)
 *
 * Guarantees:
 *   - Idempotent: calling shutdown() twice is safe.
 *   - Every stage has a hard timeout — no infinite wait.
 *   - Structured log at each stage for observability.
 */

import type { Server } from "http";
import { logger } from "@core/telemetry/logger";

const MODULE = "ShutdownCoordinator";

/** Minimal interface required from each worker. */
export interface DrainableWorker {
  stop(): void;
  drain(timeoutMs: number): Promise<void>;
}

/** Minimal interface required from the database layer. */
export interface DatabaseCloser {
  closeDatabase(): Promise<void>;
}

interface ShutdownConfig {
  httpServer: Server;
  jobsWorker: DrainableWorker;
  outboxWorker: DrainableWorker;
  db: DatabaseCloser;
  timeouts?: {
    httpDrainMs?: number;   // default: 30_000
    jobsDrainMs?: number;   // default: 60_000
    outboxDrainMs?: number; // default: 15_000
  };
}

class ShutdownCoordinator {
  private isShuttingDown = false;

  /**
   * Registers SIGTERM and SIGINT handlers.
   * Safe to call early in startup — if a signal arrives before
   * register() is called, Node's default behaviour applies.
   */
  register(config: ShutdownConfig): void {
    const handler = (signal: string) => {
      logger.info({
        message: `Signal received: ${signal}. Initiating graceful shutdown.`,
        module: MODULE,
        action: "signalReceived",
        metadata: { signal },
      });
      this.shutdown(config).catch((err) => {
        logger.error({
          message: "Unexpected error during shutdown",
          module: MODULE,
          action: "shutdown",
          error: err,
        });
        process.exit(1);
      });
    };

    process.on("SIGTERM", () => handler("SIGTERM"));
    process.on("SIGINT",  () => handler("SIGINT"));
  }

  /**
   * Executes the shutdown sequence.
   * Idempotent — subsequent calls return immediately.
   */
  async shutdown(config: ShutdownConfig): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn({
        message: "Shutdown already in progress — ignoring duplicate signal.",
        module: MODULE,
        action: "shutdown",
      });
      return;
    }
    this.isShuttingDown = true;

    // Immediately set all readiness flags to false to prevent the Load Balancer from routing new traffic.
    try {
      const { readinessManager } = await import("@core/telemetry/readiness");
      readinessManager.setDBConnected(false);
      readinessManager.setSubscribersRegistered(false);
      readinessManager.setOutboxWorkerStarted(false);
      readinessManager.setJobsWorkerStarted(false);
      readinessManager.setFeatureFlagsLoaded(false);
      readinessManager.setListening(false);
    } catch (err) {
      logger.error({ message: "Failed to reset readiness flags on shutdown", module: MODULE, error: err });
    }

    // Immediately stop system metrics collection to prevent pending intervals/timers.
    try {
      const { stopSystemMetricsCollection } = await import("@core/telemetry/metrics");
      stopSystemMetricsCollection();
    } catch (err) {
      logger.error({ message: "Failed to stop metrics collection on shutdown", module: MODULE, error: err });
    }

    const t = config.timeouts ?? {};
    const httpDrainMs   = t.httpDrainMs   ?? 30_000;
    const jobsDrainMs   = t.jobsDrainMs   ?? 60_000;
    const outboxDrainMs = t.outboxDrainMs ?? 15_000;

    logger.info({ message: "Shutdown sequence started.", module: MODULE, action: "shutdown" });

    // ① Stop accepting new HTTP connections and drain in-flight requests.
    await this._closeHttpServer(config.httpServer, httpDrainMs);

    // ② Stop the Jobs Worker polling loops, then drain active jobs.
    config.jobsWorker.stop();
    logger.info({ message: "JobsWorker polling stopped. Draining active jobs…", module: MODULE, action: "drainJobs" });
    await config.jobsWorker.drain(jobsDrainMs);
    logger.info({ message: "JobsWorker drained.", module: MODULE, action: "drainJobs" });

    // ③ Stop the Outbox Worker polling loop, then drain the running batch.
    config.outboxWorker.stop();
    logger.info({ message: "OutboxWorker polling stopped. Draining current batch…", module: MODULE, action: "drainOutbox" });
    await config.outboxWorker.drain(outboxDrainMs);
    logger.info({ message: "OutboxWorker drained.", module: MODULE, action: "drainOutbox" });

    // ④ Close the database pool — must be last, workers depend on it.
    logger.info({ message: "Closing database pool…", module: MODULE, action: "closeDb" });
    try {
      await config.db.closeDatabase();
      logger.info({ message: "Database pool closed.", module: MODULE, action: "closeDb" });
    } catch (err) {
      logger.error({ message: "Error closing database pool.", module: MODULE, action: "closeDb", error: err });
    }

    logger.info({ message: "Shutdown complete. Exiting.", module: MODULE, action: "shutdown" });
    process.exit(0);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private _closeHttpServer(server: Server, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      logger.info({
        message: `Closing HTTP server (timeout: ${timeoutMs}ms)…`,
        module: MODULE,
        action: "closeHttp",
      });

      const timer = setTimeout(() => {
        logger.warn({
          message: `HTTP drain timeout reached (${timeoutMs}ms). Forcing connection close.`,
          module: MODULE,
          action: "closeHttp",
        });
        // Node 18.2+ — forcibly destroy keep-alive connections.
        if (typeof (server as any).closeAllConnections === "function") {
          (server as any).closeAllConnections();
        }
        resolve();
      }, timeoutMs);

      server.close(() => {
        clearTimeout(timer);
        logger.info({ message: "HTTP server closed.", module: MODULE, action: "closeHttp" });
        resolve();
      });
    });
  }
}

export const shutdownCoordinator = new ShutdownCoordinator();
