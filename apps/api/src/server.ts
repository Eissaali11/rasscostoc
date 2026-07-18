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
import { readinessManager } from "@core/telemetry/readiness";
import { configService } from "@core/config/config.service";
import { featureFlagService } from "@core/services/feature-flags.service";
import { closeSessionStore } from "@core/config/session";
import { lifecycleCoordinator } from "@core/lifecycle/lifecycle.coordinator";

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

    // Start Outbox Worker
    const { outboxWorker } = await import("@core/outbox/outbox.worker");
    outboxWorker.start();
    readinessManager.setOutboxWorkerStarted(true);
    lifecycleCoordinator.register("outboxWorker", () => outboxWorker.stop());

    // Start Asynchronous Job Worker
    const { jobsWorker } = await import("@core/jobs/jobs.worker");
    jobsWorker.start();
    readinessManager.setJobsWorkerStarted(true);
    lifecycleCoordinator.register("jobsWorker", () => jobsWorker.stop());

    lifecycleCoordinator.register("sessionStore", () => closeSessionStore());
    lifecycleCoordinator.register("databasePool", () => closeDatabase());

    // 2. Programmatically apply Drizzle migrations on startup
    // migrations/ lives at monorepo root, two levels above apps/api/src
    const migrationsFolder = path.resolve(__dirname, "../../../migrations");
    log(`⏳ Running database migrations from: ${migrationsFolder}`);
    const db = getDatabase();
    try {
      await migrate(db, { migrationsFolder });
      log("✅ Database migrations completed successfully!");
    } catch (migError) {
      log(`⚠️ Database migrations warning: ${migError instanceof Error ? migError.message : String(migError)}`);
      log("Continuing server startup assuming database schema is already applied.");
    }


    // 3. Register route modules
    const server = await registerRoutes(app);

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

      lifecycleCoordinator.registerHttpServer(server);
      lifecycleCoordinator.setBeforeShutdown(() => readinessManager.setShuttingDown(true));

      // All critical resources are up and the listener is accepting
      // connections — only now is it safe to tell PM2 (wait_ready: true in
      // ecosystem.config.cjs) that this instance is actually ready.
      process.send?.("ready");
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Startup failed: ${message}`);
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  lifecycleCoordinator.shutdown("SIGTERM").then(() => process.exit(process.exitCode ?? 0));
});
process.on("SIGINT", () => {
  lifecycleCoordinator.shutdown("SIGINT").then(() => process.exit(process.exitCode ?? 0));
});

startServer();
