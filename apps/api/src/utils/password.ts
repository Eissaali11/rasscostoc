/**
 * Password hashing and verification utilities
 */

import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/** bcrypt prefixes: $2a$ / $2b$ / $2y$ */
export function isBcryptHash(value: string | null | undefined): boolean {
  return typeof value === "string" && /^\$2[aby]\$/.test(value);
}

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash.
 * ERP-008-P1.3: plaintext / non-bcrypt stored values are never accepted.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!isBcryptHash(hash)) {
    return false;
  }
  return bcrypt.compare(password, hash);
}
