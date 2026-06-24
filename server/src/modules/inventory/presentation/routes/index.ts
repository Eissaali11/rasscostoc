/**
 * Main routes index - registers all route modules
 */

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "@modules/identity/presentation/routes/auth.routes";
import { initializeDefaults } from "./bootstrap";

/**
 * Initialize default data on startup
 */
// initializeDefaults moved to routes/bootstrap.ts to keep this file minimal

/**
 * Register all routes
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize default data on startup
  await initializeDefaults();

  const healthHandler = (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      service: "stockpro-api",
      timestamp: new Date().toISOString(),
    });
  };

  app.get("/api/health", healthHandler);
  app.get("/health", healthHandler);

  // Config endpoint for Flutter app dynamic base URL
  app.get("/api/config", (_req, res) => {
    res.json({
      baseUrl: `${_req.protocol}://${_req.get("host")}`,
    });
  });

  // Register new route modules
  registerAuthRoutes(app);
  
  // Register refactored route modules
  await (await import("./register-modules")).registerRefactoredRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
