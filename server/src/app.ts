import express from "express";
import { setupSession } from "@core/config/session";
import { idempotency } from "@core/middlewares/idempotency.middleware";
import { errorHandler } from "@core/errors/errorHandler";
import { registerRoutes } from "@modules/inventory/presentation/routes/index"; // We will make this register all modular routes
import { log } from "@core/utils/vite";

const app = express();

// Trust proxy (required behind Nginx)
if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.get('host') || '';
  
  // In development, allow all origins
  // In production, allow same-origin requests
  if (process.env.NODE_ENV === 'development' || !origin || origin.includes(host) || origin.includes('stoc.fun')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Idempotency-Key');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Setup session
setupSession(app);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Apply Idempotency middleware globally for POST/PUT/PATCH API routes
app.use(idempotency);

// Request duration and response logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export { app };
