/**
 * JWT Configuration — Single Source of Truth
 * All modules must import JWT_SECRET from here.
 */

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export const JWT_SECRET = process.env.JWT_SECRET;

export const JWT_ACCESS_EXPIRES_IN = "15m";
export const JWT_REFRESH_EXPIRES_DAYS = 7;
