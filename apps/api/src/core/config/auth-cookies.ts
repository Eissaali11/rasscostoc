/**
 * httpOnly auth cookie helpers — ERP security Phase 1 (staged groundwork).
 *
 * These issue the JWT access token and the rotating refresh token as
 * httpOnly cookies so that, going forward, the browser can authenticate
 * without exposing tokens to JavaScript (localStorage). This is additive:
 * the existing Authorization: Bearer flow is untouched, and the frontend is
 * migrated off localStorage in a later change.
 *
 * SameSite=Lax is deliberate. It lets top-level GET navigations — the
 * `window.open(...export...)` download links and the SSO redirect — carry
 * the cookie, while withholding it on cross-site POST/PUT/DELETE, which is
 * the primary CSRF vector. csrfProtection adds a defense-in-depth custom
 * header check for the cookie path (see security.middleware.ts).
 */

import type { Request, Response } from "express";
import { JWT_REFRESH_EXPIRES_DAYS } from "./jwt.config";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const isProd = process.env.NODE_ENV === "production";

// Mirrors JWT_ACCESS_EXPIRES_IN ("15m"). If the cookie ever outlives the JWT,
// verification simply fails and the caller falls back / re-auths — not harmful.
const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_MAX_AGE_MS = JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

function baseOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { token: string; refreshToken: string }
): void {
  res.cookie(ACCESS_COOKIE, tokens.token, {
    ...baseOptions(),
    path: "/",
    maxAge: ACCESS_MAX_AGE_MS,
  });
  // Refresh cookie is scoped to the auth endpoints only (login/refresh/logout
  // all live under /api/auth), so it is not sent on ordinary API traffic.
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    path: "/api/auth",
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: "/api/auth" });
}

/**
 * Read a single cookie value from the raw Cookie header.
 * Kept dependency-free (no cookie-parser) so the middleware chain is unchanged.
 */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}
