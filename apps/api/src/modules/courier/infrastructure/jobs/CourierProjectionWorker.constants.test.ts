/**
 * OPS-REMED-E4-P2 — CourierProjectionWorker backoff formula unit test.
 * No database — pure function.
 */
import { describe, expect, it } from "vitest";
import { computeBackoff } from "./CourierProjectionWorker";

describe("OPS-REMED-E4-P2 — CourierProjectionWorker backoff formula", () => {
  it("1. retry delay follows the frozen exponential formula (within jitter bounds)", () => {
    // attempt 0: base = 5000 * 2^0 = 5000, jitter +/-10% => [4500, 5500]
    const d0 = computeBackoff(0);
    expect(d0).toBeGreaterThanOrEqual(4500);
    expect(d0).toBeLessThanOrEqual(5500);

    // attempt 3: base = 5000 * 8 = 40000, jitter => [36000, 44000]
    const d3 = computeBackoff(3);
    expect(d3).toBeGreaterThanOrEqual(36_000);
    expect(d3).toBeLessThanOrEqual(44_000);
  });

  it("2. retry interval never exceeds the frozen maximum (30 minutes)", () => {
    for (const attempt of [10, 20, 50, 100]) {
      const delay = computeBackoff(attempt);
      expect(delay).toBeLessThanOrEqual(1_800_000);
    }
  });

  it("3. backoff is monotonically non-decreasing until the cap is reached", () => {
    let prev = 0;
    for (let a = 0; a < 15; a++) {
      const d = computeBackoff(a);
      expect(d).toBeGreaterThanOrEqual(prev * 0.85); // allow for jitter noise
      prev = d;
    }
  });
});
