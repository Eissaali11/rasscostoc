import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from "./app";
import { initializeDatabase, getDatabase, closeDatabase } from "@core/database/connection";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "@core/utils/vite";
import { errorHandler } from "@core/errors/errorHandler";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { initializeEventSubscribers } from "./composition/events";
// ERP-006A: composition/index.ts registers the cross-module port adapters
// (identity<->inventory, identity<->accounting, inventory<->accounting -
// see composition/inventory-identity.adapter.ts / accounting-cross-module.adapter.ts).
// This side-effect import is what actually runs those registrations at
// startup; without it, nothing in the real app ever reached composition/index.ts.
import "./composition";
import { readinessManager } from "@core/telemetry/readiness";
import { configService } from "@core/config/config.service";
import { featureFlagService } from "@core/services/feature-flags.service";
import { logger } from "@core/telemetry/logger";
import { startSystemMetricsCollection } from "@core/telemetry/metrics";
import { shutdownCoordinator } from "@core/lifecycle/shutdown.coordinator";

// Register global error and promise rejection handlers
process.on("uncaughtException", (error) => {
  logger.error({
    message: "CRITICAL: Uncaught Exception detected, shutting down server process...",
    module: "Server",
    action: "uncaughtException",
    error,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({
    message: "CRITICAL: Unhandled Promise Rejection detected",
    module: "Server",
    action: "unhandledRejection",
    error: reason instanceof Error ? reason : new Error(String(reason)),
  });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  try {
    // 0. Load Feature Flags
    log("⏳ Loading Feature Flags...");
    await featureFlagService.refresh();
    readinessManager.setFeatureFlagsLoaded(true);
    log("✅ Feature Flags loaded!");

    // 1. Register Event Subscribers
    initializeEventSubscribers();
    readinessManager.setSubscribersRegistered(true);

    // 1. Initialize database connection
    await initializeDatabase();
    readinessManager.setDBConnected(true);

    // 2. Programmatically apply Drizzle migrations on startup
    // migrations/ lives at monorepo root, two levels above apps/api/src
    const migrationsFolder = path.resolve(__dirname, "../../../migrations");
    log(`⏳ Running database migrations from: ${migrationsFolder}`);
    const db = getDatabase();
    try {
      await migrate(db, { migrationsFolder });
      log("✅ Database migrations completed successfully!");
    } catch (migError) {
      // Fail-fast: a schema mismatch is more dangerous than a restart.
      // The outer catch will log the error and call process.exit(1).
      logger.error({
        message: "CRITICAL: Database migration failed — aborting startup to prevent schema mismatch.",
        module: "Server",
        action: "migrate",
        error: migError,
      });
      throw migError;
    }

    // Start Outbox Worker AFTER migrations run successfully
    const { outboxWorker } = await import("@core/outbox/outbox.worker");
    outboxWorker.start();
    readinessManager.setOutboxWorkerStarted(true);

    // Start Asynchronous Job Worker AFTER migrations run successfully
    const { jobsWorker } = await import("@core/jobs/jobs.worker");
    jobsWorker.start();
    readinessManager.setJobsWorkerStarted(true);

    // 3. Register route modules
    const server = await registerRoutes(app);

    // Wire shutdown coordinator immediately after HTTP server is created
    shutdownCoordinator.register({
      httpServer: server,
      jobsWorker,
      outboxWorker,
      db: { closeDatabase },
    });

    // 4. Global error handler middleware (must be registered after routes)
    app.use(errorHandler);

    // 5. Setup Vite development server or static file serving
    if (configService.isDevelopment) {
      await setupVite(app, server);
    } else {
      await serveStatic(app);
    }

    // 6. Listen on specified PORT
    const port = configService.port;

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        log(`Port ${port} is already in use. Stop the other process or run with another port.`);
        process.exit(1);
      }
      log(`Server failed to start: ${error.message}`);
      process.exit(1);
    });

    server.listen(port, () => {
      log(`Server is serving on port ${port}`);
      // Start system metrics polling (CPU & Memory)
      startSystemMetricsCollection();
      readinessManager.setListening(true);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Startup failed: ${message}`);

    // Cleanup resources on startup failure
    try {
      const { outboxWorker } = await import("@core/outbox/outbox.worker");
      if (outboxWorker) outboxWorker.stop();
    } catch (_) {}

    try {
      const { jobsWorker } = await import("@core/jobs/jobs.worker");
      if (jobsWorker) jobsWorker.stop();
    } catch (_) {}

    try {
      await closeDatabase();
      log("Database connection pool closed during startup failure cleanup.");
    } catch (closeDbError) {
      log(`Failed to close database pool during startup failure cleanup: ${closeDbError}`);
    }

    process.exit(1);
  }
}

startServer();
