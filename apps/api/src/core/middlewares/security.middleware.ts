import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "../config/db";
import { logger } from "../telemetry/logger";

const LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 150; // 150 requests per minute

/**
 * ERP-008 Phase 4: the counter used to live in a process-local `Map`, so
 * under multi-process/PM2-cluster operation each process enforced its own
 * independent limit -- a client could bypass the aggregate limit just by
 * landing on a different process. This single statement is the only place
 * the count changes: INSERT ... ON CONFLICT DO UPDATE is atomic in
 * Postgres, so concurrent callers (same process or different processes)
 * serialize on the row and never lose an increment. The CASE expressions
 * roll the window over (reset to 1) when the previous reset_at has passed,
 * matching the prior in-memory "expired record" behavior.
 */
async function incrementRateLimitCounter(
  key: string,
  windowMs: number
): Promise<{ count: number; resetAt: number }> {
  const newResetAt = new Date(Date.now() + windowMs);
  const result = await db.execute(sql`
    INSERT INTO rate_limit_counters (key, count, reset_at)
    VALUES (${key}, 1, ${newResetAt})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit_counters.reset_at <= now() THEN 1 ELSE rate_limit_counters.count + 1 END,
      reset_at = CASE WHEN rate_limit_counters.reset_at <= now() THEN ${newResetAt} ELSE rate_limit_counters.reset_at END
    RETURNING count, reset_at
  `);
  const row = result.rows[0] as { count: number; reset_at: string };
  return { count: Number(row.count), resetAt: new Date(row.reset_at).getTime() };
}

/**
 * Custom Rate Limiting middleware to prevent brute-force attacks and abuse.
 */
export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
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

  let count: number;
  let resetAt: number;
  try {
    ({ count, resetAt } = await incrementRateLimitCounter(ip, LIMIT_WINDOW_MS));
  } catch (err) {
    // Fail-open: every other component on this request path (sessions,
    // readiness) already hard-depends on the same database, so a DB outage
    // already degrades the API elsewhere. Rate limiting is a defense against
    // abuse under normal operation, not a resource the API must remain
    // available without -- refusing all traffic here would turn a rate-limit
    // storage hiccup into a full outage, which is a worse outcome.
    logger.error({
      message: "Rate limiter storage error - failing open",
      module: "security",
      action: "rateLimiterStorageError",
      metadata: { ip, path, error: (err as Error).message },
    });
    return next();
  }

  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - count);
  res.setHeader("X-RateLimit-Limit", MAX_REQUESTS_PER_WINDOW);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(resetAt / 1000));

  if (count > MAX_REQUESTS_PER_WINDOW) {
    logger.warn({
      message: `Rate limit exceeded for IP: ${ip}`,
      module: "security",
      action: "rateLimitExceeded",
      metadata: { ip, path, count }
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
