import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from "./app";
import { initializeDatabase, getDatabase } from "@core/database/connection";
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

    // Start Asynchronous Job Worker
    const { jobsWorker } = await import("@core/jobs/jobs.worker");
    jobsWorker.start();

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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Startup failed: ${message}`);
    process.exit(1);
  }
}

startServer();
