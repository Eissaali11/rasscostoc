import 'dotenv/config';
import { app } from "./app";
import { initializeDatabase, getDatabase } from "@core/database/connection";
import { registerRoutes } from "@modules/inventory/presentation/routes/index";
import { setupVite, serveStatic, log } from "@core/utils/vite";
import { errorHandler } from "@core/errors/errorHandler";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function startServer() {
  try {
    // 1. Initialize database connection
    await initializeDatabase();

    // 2. Programmatically apply Drizzle migrations on startup
    log("⏳ Running database migrations...");
    const db = getDatabase();
    await migrate(db, { migrationsFolder: "./migrations" });
    log("✅ Database migrations completed successfully!");

    // 3. Register route modules
    const server = await registerRoutes(app);

    // 4. Global error handler middleware (must be registered after routes)
    app.use(errorHandler);

    // 5. Setup Vite development server or static file serving
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      await serveStatic(app);
    }

    // 6. Listen on specified PORT
    const port = parseInt(process.env.PORT || '5000', 10);

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
