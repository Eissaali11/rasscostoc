/**
 * ERP-008-P1.4 — Explicit CORS origin whitelist (no wildcards with credentials).
 */

export const DEFAULT_PRODUCTION_ORIGINS = [
  "https://stc1.fun",
  "https://www.stc1.fun",
  "https://stoc.fun",
  "https://www.stoc.fun",
] as const;

export const DEFAULT_DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5173",
] as const;

export function parseCorsAllowedOrigins(
  envValue: string | undefined,
): string[] {
  if (!envValue?.trim()) return [];
  return envValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function resolveCorsAllowedOrigins(input: {
  isDevelopment: boolean;
  envOrigins?: string;
}): ReadonlySet<string> {
  const fromEnv = parseCorsAllowedOrigins(input.envOrigins);
  if (fromEnv.length > 0) {
    return new Set(fromEnv);
  }
  if (input.isDevelopment) {
    return new Set<string>([
      ...DEFAULT_DEVELOPMENT_ORIGINS,
      ...DEFAULT_PRODUCTION_ORIGINS,
    ]);
  }
  return new Set<string>(DEFAULT_PRODUCTION_ORIGINS);
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowed: ReadonlySet<string>,
): boolean {
  if (!origin) return false;
  return allowed.has(origin);
}
