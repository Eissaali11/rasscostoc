import { randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { AuthenticationError, AuthorizationError } from "@core/errors/AppError";
import { readCookie, ACCESS_COOKIE } from "@core/config/auth-cookies";
import { ROLES, hasRoleOrAbove } from "@shared/roles";
import * as jwt from "@server/utils/jwt";
import { JWT_SECRET } from "@core/config/jwt.config";
import { getDatabase } from "@core/database/connection";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { telemetryContextStore } from "@core/telemetry/telemetry";

// Extend Express Request type to include full user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        username: string;
        regionId: string | null;
        employeeCode: string | null;
        technicianCode: string | null;
        permissions: string[];
      };
    }
  }
}

// Session store interface
interface SessionStore {
  get(token: string): Promise<SessionData | null>;
  set(token: string, data: SessionData, expiry: number): Promise<void>;
  delete(token: string): Promise<void>;
}

export interface SessionData {
  userId: string;
  role: string;
  username: string;
  regionId: string | null;
  expiry: number;
}

// PostgreSQL-backed session store for Bearer tokens
import { pool } from "@core/config/db";

type AuthUser = {
  id: string;
  role: string;
  username: string;
  regionId: string | null;
  employeeCode: string | null;
  technicianCode: string | null;
  permissions: string[];
};

/**
 * Fetch fresh user data from DB via Drizzle Repository (no raw SQL)
 */
async function getFreshAuthUser(userId: string): Promise<AuthUser | null> {
  try {
    const db = getDatabase();
    const [row] = await db
      .select({
        id: users.id,
        role: users.role,
        username: users.username,
        regionId: users.regionId,
        employeeCode: users.employeeCode,
        technicianCode: users.technicianCode,
        permissions: users.permissions,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      role: row.role,
      username: row.username,
      regionId: row.regionId ?? null,
      employeeCode: row.employeeCode ?? null,
      technicianCode: row.technicianCode ?? null,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
    };
  } catch (error) {
    console.error("Auth user refresh error:", error);
    return null;
  }
}

class PostgresSessionStore implements SessionStore {
  async get(token: string): Promise<SessionData | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT user_id AS "userId", role, username, region_id AS "regionId", expiry FROM bearer_sessions WHERE token = $1`,
        [token]
      );
      
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        const now = Date.now();
        
        // Check if session has expired
        if (Number(row.expiry) < now) {
          await this.delete(token);
          return null;
        }
        
        return {
          userId: row.userId,
          role: row.role,
          username: row.username,
          regionId: row.regionId,
          expiry: Number(row.expiry)
        };
      }
      return null;
    } catch (error) {
      console.error("Session get error:", error);
      return null;
    } finally {
      client.release();
    }
  }

  async set(token: string, data: SessionData, expiry: number): Promise<void> {
    const client = await pool.connect();
    try {
      // Table is managed by Drizzle schema (bearer_sessions in auth.schema.ts)
      await client.query(
        `INSERT INTO bearer_sessions (token, user_id, role, username, region_id, expiry)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (token) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           role = EXCLUDED.role,
           username = EXCLUDED.username,
           region_id = EXCLUDED.region_id,
           expiry = EXCLUDED.expiry`,
         [token, data.userId, data.role, data.username, data.regionId, expiry]
       );
    } catch (error) {
      console.error("Session set error:", error);
    } finally {
      client.release();
    }
  }

  async delete(token: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM bearer_sessions WHERE token = $1`, [token]);
    } catch (error) {
      console.error("Session delete error:", error);
    } finally {
      client.release();
    }
  }
}

// Export PostgreSQL-backed session store instance
export const sessionStore: SessionStore = new PostgresSessionStore();

function updateTelemetryContext(user: AuthUser): void {
  const store = telemetryContextStore.getStore();
  if (store) {
    store.userId = user.id;
    store.username = user.username;
  }
}

/**
 * Middleware to require authentication
 * Checks Bearer token first (Frontend primary method), then Express Session
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Check Bearer token FIRST (Frontend primary method), then the
    //    httpOnly access cookie, then the legacy query param.
    const authHeader = req.headers.authorization;
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) {
      token = readCookie(req, ACCESS_COOKIE);
    }
    if (!token && req.query.token) {
      token = String(req.query.token);
    }

    if (token) {
      try {
        // Attempt JWT verification first
        const decoded = jwt.verify(token, JWT_SECRET);
        const fallbackUser: AuthUser = {
          id: decoded.userId,
          role: decoded.role,
          username: decoded.username,
          regionId: decoded.regionId ?? null,
          employeeCode: decoded.employeeCode ?? null,
          technicianCode: decoded.technicianCode ?? null,
          permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
        };

        const freshUser = await getFreshAuthUser(decoded.userId);
        req.user = freshUser || fallbackUser;
        updateTelemetryContext(req.user);

        return next();
      } catch (jwtError) {
        // Fallback to legacy database-backed session token lookup
        const session = await sessionStore.get(token);
        if (session) {
          const fallbackUser: AuthUser = {
            id: session.userId,
            role: session.role,
            username: session.username,
            regionId: session.regionId ?? null,
            employeeCode: null,
            technicianCode: null,
            permissions: [],
          };

          const freshUser = await getFreshAuthUser(session.userId);
          req.user = freshUser || fallbackUser;
          updateTelemetryContext(req.user);

          if (
            freshUser &&
            (freshUser.role !== session.role ||
              freshUser.username !== session.username ||
              freshUser.regionId !== session.regionId)
          ) {
            await sessionStore.set(
              token,
              {
                userId: freshUser.id,
                role: freshUser.role,
                username: freshUser.username,
                regionId: freshUser.regionId,
                expiry: session.expiry,
              },
              session.expiry
            );
          }

          return next();
        }
      }
    }

    // 2. Fallback to Express Session (PostgreSQL-backed cookie)
    const sessionObj = (req as any).session;
    if (sessionObj && sessionObj.user) {
      const sessionUser = sessionObj.user as AuthUser;
      const freshUser = sessionUser?.id ? await getFreshAuthUser(sessionUser.id) : null;
      req.user = freshUser || sessionUser;
      updateTelemetryContext(req.user);

      if (req.user) {
        sessionObj.user = req.user;
      }

      return next();
    }

    throw new AuthenticationError("Session expired");
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require admin role (System Manager only)
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(new AuthenticationError("Authentication required"));
  }

  if (req.user.role !== ROLES.ADMIN) {
    return next(new AuthorizationError("يجب أن تكون مدير نظام للوصول إلى هذه الصفحة"));
  }

  next();
}

/**
 * PLATFORM-P0 — Admin session OR internal service key (X-Internal-Service-Key).
 */
export async function requireAdminOrInternal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const expected = process.env.INTERNAL_SERVICE_KEY;
    const provided = req.header("x-internal-service-key");
    if (expected && provided && provided === expected) {
      return next();
    }

    await new Promise<void>((resolve, reject) => {
      void requireAuth(req, res, (err?: unknown) => (err ? reject(err) : resolve()));
    });

    if (!req.user) {
      throw new AuthenticationError("Authentication required");
    }
    if (req.user.role !== ROLES.ADMIN) {
      throw new AuthorizationError("يجب أن تكون مدير نظام أو خدمة داخلية للوصول");
    }
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require supervisor role or above
 */
export function requireSupervisor(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(new AuthenticationError("Authentication required"));
  }

  if (!hasRoleOrAbove(req.user.role, ROLES.SUPERVISOR)) {
    return next(new AuthorizationError("يجب أن تكون مشرف أو أعلى للوصول إلى هذه الصفحة"));
  }

  next();
}

/**
 * Middleware to require supervisor role only (exclude admin)
 */
export function requireSupervisorOnly(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(new AuthenticationError("Authentication required"));
  }

  if (req.user.role !== ROLES.SUPERVISOR) {
    return next(new AuthorizationError("هذه العملية متاحة للمشرف فقط"));
  }

  next();
}

/**
 * Middleware factory to require a specific role or above
 */
export function requireRole(minRole: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError("Authentication required"));
    }

    if (!hasRoleOrAbove(req.user.role, minRole)) {
      return next(new AuthorizationError("ليس لديك الصلاحيات الكافية"));
    }

    next();
  };
}

/**
 * Generate a cryptographically secure, unpredictable session token.
 * Uses crypto.randomBytes (CSPRNG) — never Math.random, whose output is
 * predictable and unsafe for anything security-sensitive.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}
