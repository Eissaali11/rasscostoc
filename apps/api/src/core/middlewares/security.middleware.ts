import type { Request, Response, NextFunction } from "express";
import { logger } from "../telemetry/logger";

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (production systems would use Redis/MemoryCache)
const ipStore = new Map<string, RateLimitInfo>();

const LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 150; // 150 requests per minute

/**
 * Custom Rate Limiting middleware to prevent brute-force attacks and abuse.
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  // Bypass rate limiting in development mode
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  // Bypass rate limiting for health check endpoints
  const path = req.path;
  if (
    path === "/health" || path === "/health/live" || path === "/health/ready" ||
    path === "/api/health" || path === "/api/health/live" || path === "/api/health/ready"
  ) {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown-ip";
  const now = Date.now();
  
  let record = ipStore.get(ip);

  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + LIMIT_WINDOW_MS,
    };
  }

  record.count += 1;
  ipStore.set(ip, record);

  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - record.count);
  res.setHeader("X-RateLimit-Limit", MAX_REQUESTS_PER_WINDOW);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    logger.warn({
      message: `Rate limit exceeded for IP: ${ip}`,
      module: "security",
      action: "rateLimitExceeded",
      metadata: { ip, path, count: record.count }
    });
    
    res.status(429).json({
      error: "Too Many Requests",
      message: "لقد تجاوزت الحد المسموح به من الطلبات. يرجى المحاولة مرة أخرى لاحقاً.",
    });
    return;
  }

  next();
}

/**
 * Helmet-equivalent Security Headers middleware.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer Policy
  res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");

  // HSTS (HTTP Strict Transport Security) - active in production
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // Basic Content Security Policy (CSP)
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // OpenStreetMap / CartoCDN tiles for dashboard spread map
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.basemaps.cartocdn.com",
      "connect-src 'self'",
    ].join("; ")
  );

  next();
}

/**
 * CSRF protection middleware for cookie-authenticated sessions.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const mutatingMethods = ["POST", "PUT", "PATCH", "DELETE"];
  
  if (mutatingMethods.includes(req.method)) {
    const authHeader = req.headers.authorization;
    const hasBearer = authHeader && authHeader.startsWith("Bearer ");
    const hasTokenQuery = req.query.token;

    // If request uses Bearer token, CSRF is not possible (immune)
    if (hasBearer || hasTokenQuery) {
      return next();
    }

    // If session-cookie is present and active, enforce custom header presence
    const sessionObj = (req as any).session;
    if (sessionObj && sessionObj.user) {
      const csrfHeader = req.headers["x-requested-with"] || req.headers["x-csrf-token"];
      if (!csrfHeader) {
        res.status(403).json({
          error: "Forbidden",
          message: "طلب غير صالح (حماية CSRF). يرجى تضمين ترويسة X-Requested-With أو X-CSRF-Token.",
        });
        return;
      }
    }
  }
  next();
}
