/**
 * PHASE B1.1 — Backend Test Foundation.
 *
 * Builds a minimal, isolated Express app for HTTP-layer route tests,
 * following the same shape every existing route-test file already hand-rolls
 * (see serialized-items.routes.test.ts, devices.routes.test.ts): a bare
 * express() instance with only the routes under test registered, plus the
 * real errorHandler. This factory exists to stop that boilerplate from being
 * copy-pasted per file and to give every HTTP test the same error-handling
 * behavior as production.
 *
 * Deliberately does NOT import apps/api/src/app.ts (the full production
 * singleton) — that app wires session stores, CORS, the outbox/jobs workers,
 * and a live DB pool at import time, which is wrong for a fast, isolated
 * route test. Full end-to-end boot-the-real-app tests belong in
 * test:integration (B1.1 smoke test covers this distinction explicitly).
 */
import express, { type Express } from "express";
import { errorHandler } from "../../errors/errorHandler";

export interface TestAppOptions {
  /** Registers one or more route modules onto the app, e.g. registerCourierRoutes. */
  registerRoutes: (app: Express) => void;
}

/** A fresh, isolated Express app: json body-parsing + the given routes + the real error handler. */
export function createTestApp({ registerRoutes }: TestAppOptions): Express {
  const app = express();
  app.use(express.json());
  registerRoutes(app);
  app.use(errorHandler);
  return app;
}
