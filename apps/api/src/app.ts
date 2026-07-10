import express from "express";
import { setupSession } from "@core/config/session";
import { idempotency } from "@core/middlewares/idempotency.middleware";
import { errorHandler } from "@core/errors/errorHandler";
import { log } from "@core/utils/vite";
import { correlationMiddleware } from "@core/telemetry/telemetry";
import { tracer } from "@core/telemetry/tracer";
import { configService } from "@core/config/config.service";
import { rateLimiter, securityHeaders } from "@core/middlewares/security.middleware";

const app = express();

// Trust proxy (required behind Nginx)
if (configService.trustProxy || configService.isProduction) {
  app.set('trust proxy', true);
}

// 1. Enable Correlation and Tracing context
app.use(correlationMiddleware);

// 2. Enable Security Headers & Rate Limiting
app.use(securityHeaders);
app.use(rateLimiter);

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.get('host') || '';
  
  // In development, allow all origins
  // In production, allow same-origin requests
  if (configService.isDevelopment || !origin || origin.includes(host) || origin.includes('stoc.fun')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Idempotency-Key, X-Correlation-ID, X-Trace-ID');
  
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

// API Versioning rewrite middleware
app.use((req, res, next) => {
  if (req.url.startsWith("/api/v1/")) {
    (req as any).apiVersion = "v1";
    // Rewrite /api/v1/... to /api/...
    req.url = "/api/" + req.url.slice(8);
  }
  next();
});

// Apply Idempotency middleware globally for POST/PUT/PATCH API routes
app.use(idempotency);

// Request duration and response logging with Tracing Spans
app.use((req, res, next) => {
  const path = req.path;
  
  const span = tracer.startSpan(`API:${req.method} ${path}`, {
    method: req.method,
    url: req.originalUrl,
  });

  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    span.end();
    const duration = span.duration || 0;
    
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 119) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export { app };
