/**
 * PHASE B1.1 — Deterministic time for tests.
 *
 * Prior code-quality audit flagged 157 direct `new Date()`/`Date.now()`
 * calls scattered through business logic (not refactored here — forbidden,
 * this phase changes test infra only). Where a test needs a fixed clock, use
 * vitest's own fake timers via these two thin wrappers so every suite uses
 * the same convention instead of each file reinventing `vi.setSystemTime`.
 */
import { vi } from "vitest";

/** Freezes Date.now()/new Date() at the given instant for the duration of a test. */
export function useFakeClock(fixedIso: string = "2026-01-01T00:00:00.000Z"): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(fixedIso));
}

/** Restores real time. Call in afterEach if useFakeClock() was used in beforeEach. */
export function restoreRealClock(): void {
  vi.useRealTimers();
}
