/**
 * PLATFORM-P0 — Fixture / mock extraction isolation.
 * Production runtime must never return fixture data.
 */

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isTestRuntime(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true" ||
    process.env.VITEST === "1"
  );
}

/**
 * Mock-by-filename is allowed ONLY in test runtime (or explicit MOCK_EXTRACTION outside production).
 */
export function shouldUseMockExtraction(fileName?: string): boolean {
  if (isProductionRuntime()) {
    return false;
  }

  if (process.env.MOCK_EXTRACTION === "true") {
    return true;
  }

  if (!isTestRuntime()) {
    return false;
  }

  const lower = (fileName || "").toLowerCase();
  return (
    lower.includes("device") ||
    lower.includes("single") ||
    lower.includes("double") ||
    lower.includes("triple") ||
    lower.includes("incomplete") ||
    lower.includes("missing")
  );
}
