import express from "express";
import { setupSession } from "@core/config/session";
import { idempotency } from "@core/middlewares/idempotency.middleware";
import { errorHandler } from "@core/errors/errorHandler";
import { log } from "@core/utils/vite";
import { correlationMiddleware } from "@core/telemetry/telemetry";
import { tracer } from "@core/telemetry/tracer";
import { configService } from "@core/config/config.service";
import { rateLimiter, securityHeaders, csrfProtection } from "@core/middlewares/security.middleware";

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
  
  // Safe origin validation: same-origin or *.stoc.fun
  const isAllowedOrigin = (orig: string): boolean => {
    try {
      const parsedUrl = new URL(orig);
      return parsedUrl.hostname === 'stoc.fun' || parsedUrl.hostname.endsWith('.stoc.fun');
    } catch {
      return false;
    }
  };

  if (configService.isDevelopment) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    if (origin) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else if (origin) {
    if (origin.includes(host) || isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
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

// Enable CSRF protection for cookie-authenticated sessions
app.use(csrfProtection);

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

  const sanitizeResponse = (obj: any): any => {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      return obj.map(sanitizeResponse);
    }
    const sanitized = { ...obj };
    const sensitiveKeys = ["token", "password", "refreshToken", "accessToken", "secret", "internalToken", "session", "cookie"];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof sanitized[key] === "object") {
        sanitized[key] = sanitizeResponse(sanitized[key]);
      }
    }
    return sanitized;
  };

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
        const sanitized = sanitizeResponse(capturedJsonResponse);
        logLine += ` :: ${JSON.stringify(sanitized)}`;
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
