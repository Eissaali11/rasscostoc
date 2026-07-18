import type { Server } from "http";
import { logger } from "@server/shared/utils/logger";

/**
 * ERP-008 Phase 3 — central owner of application startup/shutdown ordering.
 *
 * Resources register a name + async stop() here. shutdown() is idempotent,
 * closes the HTTP listener first (stop accepting new traffic, drain
 * in-flight requests), then stops registered resources in the reverse of
 * their registration order, bounded by a single timeout across the whole
 * sequence. If the timeout is exceeded, the process exits non-zero rather
 * than hanging forever.
 */

export type ShutdownHandler = () => Promise<void>;

interface RegisteredResource {
  name: string;
  stop: ShutdownHandler;
}

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

export class LifecycleCoordinator {
  private resources: RegisteredResource[] = [];
  private httpServer: Server | null = null;
  private shuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  private readonly shutdownTimeoutMs: number;
  private beforeShutdown?: () => void;

  constructor(options?: { shutdownTimeoutMs?: number }) {
    this.shutdownTimeoutMs = options?.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
  }

  registerHttpServer(server: Server): void {
    this.httpServer = server;
  }

  register(name: string, stop: ShutdownHandler): void {
    this.resources.push({ name, stop });
  }

  /** Runs synchronously before anything else on shutdown (e.g. flip readiness to false). */
  setBeforeShutdown(fn: () => void): void {
    this.beforeShutdown = fn;
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  /**
   * Idempotent: a second/third call (e.g. duplicate SIGTERM) returns the
   * same in-flight promise instead of re-running shutdown.
   */
  async shutdown(reason: string): Promise<void> {
    if (this.shutdownPromise) {
      logger.info(`[Lifecycle] Shutdown already in progress, ignoring duplicate signal (${reason})`);
      return this.shutdownPromise;
    }

    this.shuttingDown = true;
    this.beforeShutdown?.();
    logger.info(`[Lifecycle] Shutdown initiated (${reason})`);

    this.shutdownPromise = this.runShutdown();
    return this.shutdownPromise;
  }

  private async runShutdown(): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Graceful shutdown timeout exceeded")), this.shutdownTimeoutMs);
    });

    try {
      await Promise.race([this.closeEverything(), timeoutPromise]);
      logger.info("[Lifecycle] Shutdown complete, exiting 0");
      process.exitCode = 0;
    } catch (error) {
      logger.error("[Lifecycle] Shutdown failed or timed out, forcing non-zero exit", error as Error);
      process.exitCode = 1;
    }
  }

  private async closeEverything(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info("[Lifecycle] HTTP server closed (no longer accepting traffic, in-flight requests drained)");
    }

    for (const resource of [...this.resources].reverse()) {
      try {
        await resource.stop();
        logger.info(`[Lifecycle] Stopped resource: ${resource.name}`);
      } catch (error) {
        logger.error(`[Lifecycle] Failed to stop resource: ${resource.name}`, error as Error);
      }
    }
  }
}

export const lifecycleCoordinator = new LifecycleCoordinator({
  shutdownTimeoutMs: process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS
    ? Number(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS)
    : DEFAULT_SHUTDOWN_TIMEOUT_MS,
});
