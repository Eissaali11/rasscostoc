/**
 * JWT Configuration — Single Source of Truth
 * All modules must import JWT_SECRET from here.
 */

export const JWT_SECRET =
  process.env.JWT_SECRET || "default-stockpro-secret-development-key-12345";

export const JWT_ACCESS_EXPIRES_IN = "15m";
export const JWT_REFRESH_EXPIRES_DAYS = 7;
