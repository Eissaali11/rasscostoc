/**
 * Dedicated brute-force protection for the login endpoint.
 *
 * The generic rateLimiter (150 req/min, bypassed outside production) is not
 * sufficient against credential-stuffing/brute-force on /api/auth/login. This
 * middleware tracks FAILED login attempts per client IP and locks the endpoint
 * for that IP after a threshold — and it is active in ALL environments (the
 * login endpoint must never be left unprotected by a misconfigured NODE_ENV).
 *
 * In-memory + per-process (like the generic limiter); a multi-instance
 * deployment should back this with a shared store (Redis). Cleared on a
 * successful login.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../telemetry/logger";

interface LoginAttempts {
  failures: number;
  firstFailureAt: number;
  lockedUntil?: number;
}

const attempts = new Map<string, LoginAttempts>();

const MAX_FAILURES = 10; // failed attempts within the window before lockout
const WINDOW_MS = 15 * 60 * 1000; // rolling window for counting failures
const LOCKOUT_MS = 15 * 60 * 1000; // how long the IP stays locked out

function keyFor(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown-ip";
}

/** Reject the request if this client is currently locked out. */
export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = keyFor(req);
  const rec = attempts.get(key);
  const now = Date.now();

  if (rec?.lockedUntil && rec.lockedUntil > now) {
    const retryAfterSec = Math.ceil((rec.lockedUntil - now) / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    logger.warn({
      message: "Login blocked: too many failed attempts",
      module: "security",
      action: "loginLockout",
      metadata: { key, retryAfterSec },
    });
    res.status(429).json({
      success: false,
      message: "تم حظر محاولات الدخول مؤقتاً بسبب كثرة المحاولات الفاشلة. يرجى المحاولة لاحقاً.",
    });
    return;
  }

  next();
}

/** Record a failed login for this client; lock out once the threshold is hit. */
export function recordLoginFailure(req: Request): void {
  const key = keyFor(req);
  const now = Date.now();
  let rec = attempts.get(key);

  if (!rec || now - rec.firstFailureAt > WINDOW_MS) {
    rec = { failures: 0, firstFailureAt: now };
  }
  rec.failures += 1;
  if (rec.failures >= MAX_FAILURES) {
    rec.lockedUntil = now + LOCKOUT_MS;
  }
  attempts.set(key, rec);
}

/** Clear the failure counter for this client after a successful login. */
export function recordLoginSuccess(req: Request): void {
  attempts.delete(keyFor(req));
}
