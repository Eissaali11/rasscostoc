/**
 * Transactions routes
 */

import type { Express } from "express";
import { transactionsController } from "../controllers/transactions.controller";
import { requireAuth } from "@core/middlewares/auth.middleware";

export function registerTransactionsRoutes(app: Express): void {
  // Get transactions
  app.get("/api/transactions", requireAuth, transactionsController.getAll);

  // Get transaction statistics
  app.get(
    "/api/transactions/statistics",
    requireAuth,
    transactionsController.getStatistics
  );
}
