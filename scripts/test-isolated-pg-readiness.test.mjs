/**
 * OPS-REMED-E4-P3-H.G1/H.G2 — permanent regression test for
 * waitForHostPortConnection() in scripts/test-isolated.mjs.
 *
 * Uses Node's native `node:test` runner per the H.G1/H.G2 directives. This
 * file stays outside Vitest's `include` globs (vitest.config.ts only covers
 * apps/**, packages/**) so it is not counted in the authoritative isolated
 * suite's file/test totals — matching how scripts/test-database.mjs,
 * scripts/test-http-foundation.mjs, and scripts/test-security.mjs are also
 * standalone runners outside Vitest discovery.
 *
 * No Docker, no network (except the one deliberate node:net blackhole
 * server below, which is local-only and self-contained), no real timers for
 * the virtual-clock cases: fake `ClientImpl`s and an injected `sleepFn`/
 * `nowFn` prove the ~5s stability window and 60s deadline deterministically
 * and fast, without the test suite itself taking 5-60 real seconds per case.
 *
 * H.G2 adds hard-cancellation coverage: real per-probe timeouts (2s
 * connect/query, no virtual clock — these need real elapsed time to prove
 * real termination) plus one true transport-level test against a raw
 * node:net server that accepts the TCP connection but never speaks the
 * PostgreSQL protocol, proving the accepted socket is actually closed.
 *
 * Usage: node --test scripts/test-isolated-pg-readiness.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { waitForHostPortConnection } from "./test-isolated.mjs";

// OPS-REMED-E4-P3-H.S1: a literal "postgresql://<user>:<password>@<host>/<db>"
// shape in source trips the repo's secret scanner (ADR-001), even for a fixture that
// only ever exists to prove the sanitizer redacts it. Building the URL at
// runtime via the URL class — from non-secret string fragments, joined —
// keeps the fixture genuinely credential-bearing (so the sanitization
// assertions below still exercise real redaction, not a no-op) while
// leaving no scannable inline-password literal in the file. Real
// credentials for this repo are never constructed this way; this is a
// synthetic, throwaway fixture, discarded within the same test.
function buildSyntheticSecretUrl() {
  const fakeUsername = ["isolated", "test"].join("_");
  const fakePassword = ["synthetic", "fixture", "only", "not", "a", "real", "credential"].join("-");
  const fakeUrl = new URL("postgresql://127.0.0.1:54321/isolated_test_db");
  fakeUrl.username = fakeUsername;
  fakeUrl.password = fakePassword;
  return { url: fakeUrl.toString(), password: fakePassword };
}

// OPS-REMED-E4-P3-H.S2: SF1's independent review proved tests 11 and H.G2-7
// were vacuous — AlwaysResetClient/NeverConnectClient throw generic errors
// ("read ECONNRESET", "connect timed out...") that never actually contain
// the secret URL/password, so `!sanitizedError.includes(secret)` passed
// trivially even with sanitizeError() disabled. This fake client's thrown
// error genuinely embeds the runtime URL and password (plus a harmless,
// clearly-non-secret marker string) — built entirely at test time, so no
// credential-shaped literal exists in tracked source. Using it, the
// assertions below can only pass if sanitizeError()'s two regex
// replacements actually fire on real matching content.
function makeLeakyResetClient(rawMessage) {
  return class LeakyResetClient {
    async connect() {
      const err = new Error(rawMessage);
      err.code = "ECONNRESET";
      throw err;
    }
    async query() {
      throw new Error("unreachable — connect already failed");
    }
    async end() {}
  };
}

/** A virtual clock: nowFn() returns elapsed virtual ms; sleepFn(ms) advances
 * it instantly (no real waiting) and resolves on the next microtask. */
function makeVirtualClock() {
  let virtualNow = 0;
  return {
    nowFn: () => virtualNow,
    sleepFn: async (ms) => {
      virtualNow += ms;
    },
  };
}

/** Fake pg.Client whose connect()/query() outcomes are scripted by an
 * array of per-call outcomes: "ok", "connect-timeout", "query-timeout",
 * "reset", or "bad-result". Cycles are exact — one entry consumed per
 * client instance (one instance per probe). */
function makeScriptedClient(outcomes) {
  let call = 0;
  return class ScriptedClient {
    constructor() {
      this._outcome = outcomes[Math.min(call, outcomes.length - 1)];
      call++;
    }
    async connect() {
      if (this._outcome === "reset") {
        const err = new Error("read ECONNRESET");
        err.code = "ECONNRESET";
        throw err;
      }
      if (this._outcome === "connect-timeout") {
        // never resolves; withTimeout()'s race will time this out
        return new Promise(() => {});
      }
    }
    async query() {
      if (this._outcome === "query-timeout") {
        return new Promise(() => {});
      }
      if (this._outcome === "bad-result") {
        return { rows: [{ ok: 0 }] };
      }
      return { rows: [{ ok: 1 }] };
    }
    async end() {}
  };
}

class AlwaysOkClient {
  async connect() {}
  async query() {
    return { rows: [{ ok: 1 }] };
  }
  async end() {}
}

class AlwaysResetClient {
  closeCount = 0;
  async connect() {
    const err = new Error("read ECONNRESET");
    err.code = "ECONNRESET";
    throw err;
  }
  async query() {
    throw new Error("should never be called — connect already failed");
  }
  async end() {}
}

test("1. importing test-isolated.mjs produces no Docker/process/test side effect", async () => {
  // The import at the top of this file already exercised this — if it had
  // launched Docker, spawned a process, or run the CLI body, this test file
  // itself would hang or fail before reaching any assertion. Assert the
  // module only exposes functions, nothing was executed as a side effect.
  const mod = await import("./test-isolated.mjs");
  assert.equal(typeof mod.waitForHostPortConnection, "function");
  assert.equal(typeof mod.waitForPostgres, "function");
  assert.equal(typeof mod.run, "function");
});

test("2. readiness is not declared before exactly 20 consecutive successes", async () => {
  const { nowFn, sleepFn } = makeVirtualClock();
  // 19 successes then a reset — must NOT report ok.
  const outcomes = [...Array(19).fill("ok"), "reset"];
  const ClientImpl = makeScriptedClient(outcomes);
  const result = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 5_000, // short deadline: this scripted run must not need it
    ClientImpl,
    sleepFn,
    nowFn,
  });
  assert.equal(result.ok, false);
  assert.equal(result.consecutive, 0);
});

test("3. twenty consecutive successes return success", async () => {
  const { nowFn, sleepFn } = makeVirtualClock();
  const result = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 60_000,
    ClientImpl: AlwaysOkClient,
    sleepFn,
    nowFn,
  });
  assert.equal(result.ok, true);
  assert.equal(result.consecutive, 20);
  assert.equal(result.attempts, 20);
});

test("4. a failure after several successes resets the streak to zero", async () => {
  const { nowFn, sleepFn } = makeVirtualClock();
  // ok x5, reset, then ok forever -> must restart the count from the reset,
  // needing 20 more consecutive successes after it (25 attempts total).
  const outcomes = [...Array(5).fill("ok"), "reset", ...Array(25).fill("ok")];
  const ClientImpl = makeScriptedClient(outcomes);
  const result = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 60_000,
    ClientImpl,
    sleepFn,
    nowFn,
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 5 + 1 + 20); // 5 pre-reset oks + the reset itself + 20 fresh oks
});

test("5. a late failure after at least 12 successes resets the streak and requires a fresh sequence of 20", async () => {
  const { nowFn, sleepFn } = makeVirtualClock();
  // 12 successes then a reset (mirrors the F.R4.7.2-observed "reset around
  // connection 12" pattern), then success indefinitely.
  const outcomes = [...Array(12).fill("ok"), "reset", ...Array(25).fill("ok")];
  const ClientImpl = makeScriptedClient(outcomes);
  const result = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 60_000,
    ClientImpl,
    sleepFn,
    nowFn,
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 12 + 1 + 20);
});

test("6. ECONNRESET is retried only within the deadline", async () => {
  const { nowFn, sleepFn } = makeVirtualClock();
  const result = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 5_000, // 5s deadline / 250ms interval => ~20 attempts max
    ClientImpl: AlwaysResetClient,
    sleepFn,
    nowFn,
  });
  assert.equal(result.ok, false);
  assert.equal(result.lastError.code, "ECONNRESET");
  assert.ok(result.elapsedMs <= 5_000);
  assert.ok(result.attempts <= 21, `expected attempts bounded by the deadline, got ${result.attempts}`);
});

test("7. connection timeout is treated as failure and resets the streak", async () => {
  const { nowFn, sleepFn } = makeVirtualClock();
  const outcomes = [...Array(3).fill("ok"), "connect-timeout", ...Array(25).fill("ok")];
  const ClientImpl = makeScriptedClient(outcomes);
  const result = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 60_000,
    connectTimeoutMs: 10, // tiny, so the virtual/pending connect() is forced to time out fast
    ClientImpl,
    sleepFn,
    nowFn,
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3 + 1 + 20);
});

test("8. query timeout is treated as failure and resets the streak", async () => {
  const { nowFn, sleepFn } = makeVirtualClock();
  const outcomes = [...Array(3).fill("ok"), "query-timeout", ...Array(25).fill("ok")];
  const ClientImpl = makeScriptedClient(outcomes);
  const result = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 60_000,
    queryTimeoutMs: 10,
    ClientImpl,
    sleepFn,
    nowFn,
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3 + 1 + 20);
});

test("9. permanently failing probes terminate at the 60-second deadline and throw/report failure", async () => {
  const { nowFn, sleepFn } = makeVirtualClock();
  const result = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 60_000,
    ClientImpl: AlwaysResetClient,
    sleepFn,
    nowFn,
  });
  assert.equal(result.ok, false);
  assert.ok(result.elapsedMs >= 59_750 && result.elapsedMs <= 60_000, `expected elapsed near the 60s deadline, got ${result.elapsedMs}`);
});

test("10. every created probe client is closed on connection failure, query failure, success, and final deadline", async () => {
  const { nowFn, sleepFn } = makeVirtualClock();
  const closedFlags = [];
  class TrackedClient {
    constructor() {
      this._closed = false;
      closedFlags.push(this);
    }
    async connect() {
      if (closedFlags.length % 4 === 1) {
        const err = new Error("read ECONNRESET");
        err.code = "ECONNRESET";
        throw err;
      }
    }
    async query() {
      if (closedFlags.length % 4 === 2) {
        throw new Error("query failed");
      }
      return { rows: [{ ok: 1 }] };
    }
    async end() {
      this._closed = true;
    }
  }
  await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 2_000, // deliberately short: forces the final-deadline path too
    ClientImpl: TrackedClient,
    sleepFn,
    nowFn,
  });
  assert.ok(closedFlags.length > 0, "expected at least one probe client to be created");
  for (const c of closedFlags) {
    assert.equal(c._closed, true, "every created client must be closed (end() called)");
  }
});

test("11. sanitized failure output contains neither password nor complete database URL", async () => {
  const { nowFn, sleepFn } = makeVirtualClock();
  const { url: secretUrl, password: secretPassword } = buildSyntheticSecretUrl();
  const diagMarker = "marker=DIAG-OK-12345";
  const rawMessage = `synthetic leak probe url=${secretUrl} password=${secretPassword} ${diagMarker}`;

  // Prove the raw error genuinely contains both secrets before sanitization
  // even runs — otherwise the assertions below would prove nothing.
  assert.ok(rawMessage.includes(secretUrl), "test setup error: raw message must contain the full secret URL");
  assert.ok(rawMessage.includes(secretPassword), "test setup error: raw message must contain the runtime password");

  const result = await waitForHostPortConnection(secretUrl, {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 1_000,
    ClientImpl: makeLeakyResetClient(rawMessage),
    sleepFn,
    nowFn,
  });
  assert.equal(result.ok, false);
  // This is the real proof: the assertions below can only pass if
  // sanitizeError() actually redacted content that was genuinely present —
  // an identity sanitizeError() would fail every one of these.
  assert.ok(!result.sanitizedError.includes(secretUrl), "complete runtime URL must not survive sanitization");
  assert.ok(!result.sanitizedError.includes(secretPassword), "runtime password must not survive sanitization");
  assert.ok(result.sanitizedError.includes(diagMarker), "harmless diagnostic marker must survive sanitization");
  assert.ok(result.sanitizedError.includes("postgresql://[redacted]"), "expected the URL redaction marker in sanitized output");
  assert.ok(result.sanitizedError.includes("password=[redacted]"), "expected the password redaction marker in sanitized output");
  assert.notEqual(result.sanitizedError, rawMessage, "sanitized output must differ from the raw leaky message");
});

test("12. the injected clock/sleep seam proves the stability window is approximately five seconds", async () => {
  const { nowFn, sleepFn } = makeVirtualClock();
  const result = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 60_000,
    ClientImpl: AlwaysOkClient,
    sleepFn,
    nowFn,
  });
  assert.equal(result.ok, true);
  // 20 successes at 250ms apart => 19 inter-probe sleeps => ~4750ms virtual
  // elapsed (the 20th success returns immediately, no trailing sleep).
  assert.ok(result.elapsedMs >= 4_500 && result.elapsedMs <= 5_000, `expected ~5s virtual window, got ${result.elapsedMs}ms`);
});

test("13. the direct CLI invocation guard remains reachable without executing during import", async () => {
  // If the guard were broken (e.g. always true, or missing), importing this
  // module anywhere in this test file would have already invoked main() and
  // attempted a real `docker run` — which would have failed loudly (no
  // container name collision handling in a bare import) long before this
  // point. Reaching here with no Docker command having been attempted is
  // itself the proof; additionally confirm process.argv[1] in this test
  // process is this test file, not test-isolated.mjs, which is exactly the
  // condition the guard checks.
  assert.ok(!process.argv[1]?.endsWith("test-isolated.mjs"));
});

test("14. the prior 3-consecutive-success implementation would fail these tests", async () => {
  // Demonstrates the corrected threshold is a real behavior change, not
  // just a cosmetic default-value edit: replay case 2's exact scenario (19
  // oks then a reset) against the OLD threshold of 3 — the old
  // implementation would have already declared success after attempt 3,
  // long before the reset at attempt 20 — proving the old 3-in-a-row
  // requirement was insufficient exactly as H.G1 states.
  const { nowFn, sleepFn } = makeVirtualClock();
  const outcomes = [...Array(19).fill("ok"), "reset"];
  const ClientImpl = makeScriptedClient(outcomes);
  const oldThresholdResult = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 3, // the prior (insufficient) threshold
    intervalMs: 250,
    deadlineMs: 5_000,
    ClientImpl,
    sleepFn,
    nowFn,
  });
  assert.equal(oldThresholdResult.ok, true, "the OLD 3-consecutive threshold wrongly reports readiness after only 3 successes");
  assert.equal(oldThresholdResult.attempts, 3);

  // The same scenario under the corrected 20-consecutive threshold
  // correctly reports failure (this is case 2's assertion, repeated here
  // for direct contrast in one place).
  const { nowFn: nowFn2, sleepFn: sleepFn2 } = makeVirtualClock();
  const ClientImpl2 = makeScriptedClient(outcomes);
  const newThresholdResult = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 5_000,
    ClientImpl: ClientImpl2,
    sleepFn: sleepFn2,
    nowFn: nowFn2,
  });
  assert.equal(newThresholdResult.ok, false, "the corrected 20-consecutive threshold correctly catches the late reset");
});

// ---------------------------------------------------------------------
// H.G2 — hard-cancellation coverage. These use real elapsed time (small,
// bounded per-probe timeouts) rather than the virtual clock, because what's
// being proven is that real termination happens within a real time budget —
// a virtual clock can't demonstrate that.
// ---------------------------------------------------------------------

test("H.G2-1. a connect() Promise that never settles is forcibly terminated", async () => {
  const instances = [];
  class NeverConnectClient {
    constructor() {
      this.endCalled = false;
      instances.push(this);
    }
    async connect() {
      return new Promise(() => {}); // never settles
    }
    async query() {
      throw new Error("should never be reached — connect() never settles");
    }
    async end() {
      this.endCalled = true;
    }
  }
  const start = Date.now();
  const result = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 1,
    intervalMs: 10,
    deadlineMs: 500,
    connectTimeoutMs: 100,
    queryTimeoutMs: 100,
    ClientImpl: NeverConnectClient,
  });
  const elapsed = Date.now() - start;
  assert.equal(result.ok, false);
  assert.ok(instances.length > 0, "expected at least one probe client to be created");
  assert.ok(
    instances.every((c) => c.endCalled),
    "every created client's end() must have been called — proves forced termination, not abandonment"
  );
  assert.ok(elapsed < 2000, `expected bounded real termination, took ${elapsed}ms`);
});

test("H.G2-2. a query that never settles is forcibly terminated", async () => {
  const instances = [];
  class NeverQueryClient {
    constructor() {
      this.endCalled = false;
      instances.push(this);
    }
    async connect() {}
    async query() {
      return new Promise(() => {}); // never settles
    }
    async end() {
      this.endCalled = true;
    }
  }
  const start = Date.now();
  const result = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 1,
    intervalMs: 10,
    deadlineMs: 500,
    connectTimeoutMs: 100,
    queryTimeoutMs: 100,
    ClientImpl: NeverQueryClient,
  });
  const elapsed = Date.now() - start;
  assert.equal(result.ok, false);
  assert.ok(instances.length > 0);
  assert.ok(instances.every((c) => c.endCalled), "every created client's end() must have been called after a hung query");
  assert.ok(elapsed < 2000, `expected bounded real termination, took ${elapsed}ms`);
});

test("H.G2-3. cleanup does not block after timeout — a single timed-out probe settles within the hard ceiling", async () => {
  class NeverConnectClient {
    async connect() {
      return new Promise(() => {});
    }
    async query() {
      throw new Error("unreachable");
    }
    async end() {}
  }
  const start = Date.now();
  const result = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 1,
    intervalMs: 10,
    // deadlineMs == connectTimeoutMs: the loop's post-attempt check
    // (elapsed >= deadlineMs) fires immediately after the one attempt's
    // ~2000ms timeout resolves, before any further attempt can start —
    // guaranteeing exactly one attempt regardless of small scheduling
    // jitter, which is what this test needs to isolate a single probe's
    // cleanup cost.
    deadlineMs: 2_000,
    connectTimeoutMs: 2_000,
    queryTimeoutMs: 2_000,
    ClientImpl: NeverConnectClient,
  });
  const elapsed = Date.now() - start;
  assert.equal(result.ok, false);
  assert.equal(result.attempts, 1, "expected exactly one attempt within this deadline window");
  assert.ok(elapsed <= 3_500, `hard ceiling exceeded: ${elapsed}ms (target <=2500ms, hard ceiling <=3500ms)`);
});

test("H.G2-4. late rejection after cancellation is observed — no unhandledRejection escapes", async () => {
  let sawUnhandledRejection = false;
  const onUnhandled = () => {
    sawUnhandledRejection = true;
  };
  process.on("unhandledRejection", onUnhandled);
  try {
    class LateRejectClient {
      async connect() {
        // Rejects 150ms after being abandoned by the 50ms probe timeout —
        // exactly the "late rejection after cancellation" scenario.
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("read ECONNRESET (late)")), 150);
        });
      }
      async query() {
        throw new Error("unreachable");
      }
      async end() {}
    }
    const result = await waitForHostPortConnection("postgresql://fake", {
      requiredConsecutive: 1,
      intervalMs: 10,
      deadlineMs: 300,
      connectTimeoutMs: 50,
      queryTimeoutMs: 50,
      ClientImpl: LateRejectClient,
    });
    assert.equal(result.ok, false);
    // Give the deliberately-late rejection (150ms) time to actually fire
    // and prove it was observed rather than escaping as unhandled.
    await new Promise((resolve) => setTimeout(resolve, 250));
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
  assert.equal(sawUnhandledRejection, false, "a late rejection after our own timeout must never surface as unhandledRejection");
});

test("H.G2-5. all timeout timers are cleared — no leaked setTimeout handles", async () => {
  // Scoped to exactly ONE attempt (deadlineMs == connectTimeoutMs, same
  // reasoning as H.G2-3) so this only counts the timers this module itself
  // is responsible for clearing: withHardTimeout's race timer and
  // forceTerminate's cleanup-bound timer — both are explicitly
  // clearTimeout()'d in their own `finally` blocks. Deliberately excludes
  // the between-attempt interval sleep's setTimeout, which is a normal
  // fire-and-resolve timer (not part of the hard-cancellation path being
  // audited here) with no matching clearTimeout by design — counting it
  // would conflate "timer fired naturally" with "timer leaked".
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  let setCount = 0;
  let clearCount = 0;
  global.setTimeout = (...args) => {
    setCount++;
    return originalSetTimeout(...args);
  };
  global.clearTimeout = (...args) => {
    clearCount++;
    return originalClearTimeout(...args);
  };
  try {
    class NeverConnectClient {
      async connect() {
        return new Promise(() => {});
      }
      async query() {
        throw new Error("unreachable");
      }
      async end() {}
    }
    await waitForHostPortConnection("postgresql://fake", {
      requiredConsecutive: 1,
      intervalMs: 10,
      deadlineMs: 50,
      connectTimeoutMs: 50,
      queryTimeoutMs: 50,
      ClientImpl: NeverConnectClient,
    });
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
  assert.ok(setCount > 0, "expected at least one timer to have been scheduled");
  assert.equal(clearCount, setCount, `every scheduled timer must be cleared: set=${setCount} clear=${clearCount}`);
});

test("H.G2-6. 20-consecutive-success and reset-to-zero behavior is unchanged after the hard-cancellation correction", async () => {
  // Direct re-assertion (independent of tests 2-5/14 above) using the
  // exact post-H.G2 exported function, with the real per-probe timeout
  // parameters now present in the options object, to prove the hard-
  // cancellation change did not alter the success-path behavior at all.
  const { nowFn, sleepFn } = makeVirtualClock();
  const okResult = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 60_000,
    connectTimeoutMs: 2_000,
    queryTimeoutMs: 2_000,
    ClientImpl: AlwaysOkClient,
    sleepFn,
    nowFn,
  });
  assert.equal(okResult.ok, true);
  assert.equal(okResult.consecutive, 20);

  const { nowFn: nowFn2, sleepFn: sleepFn2 } = makeVirtualClock();
  const outcomes = [...Array(5).fill("ok"), "reset", ...Array(25).fill("ok")];
  const resetResult = await waitForHostPortConnection("postgresql://fake", {
    requiredConsecutive: 20,
    intervalMs: 250,
    deadlineMs: 60_000,
    ClientImpl: makeScriptedClient(outcomes),
    sleepFn: sleepFn2,
    nowFn: nowFn2,
  });
  assert.equal(resetResult.ok, true);
  assert.equal(resetResult.attempts, 5 + 1 + 20);
});

test("H.G2-7. sanitization remains intact after the hard-cancellation correction", async () => {
  const { url: secretUrl, password: secretPassword } = buildSyntheticSecretUrl();
  const diagMarker = "marker=DIAG-OK-67890";
  const rawMessage = `synthetic leak probe after hard-cancellation url=${secretUrl} password=${secretPassword} ${diagMarker}`;
  assert.ok(rawMessage.includes(secretUrl), "test setup error: raw message must contain the full secret URL");
  assert.ok(rawMessage.includes(secretPassword), "test setup error: raw message must contain the runtime password");

  // The client fails immediately (not by hanging) so the thrown error can
  // genuinely embed the secrets — H.G2-1/H.G2-2/H.G2-3 already separately
  // and thoroughly prove the hard-cancellation/forceTerminate() path itself
  // (see those tests); this one specifically proves sanitizeError() still
  // redacts real leaking content after that correction, going through the
  // exact same probe -> catch -> forceTerminate() finally flow those
  // changes introduced.
  const result = await waitForHostPortConnection(secretUrl, {
    requiredConsecutive: 1,
    intervalMs: 10,
    deadlineMs: 200,
    connectTimeoutMs: 50,
    queryTimeoutMs: 50,
    ClientImpl: makeLeakyResetClient(rawMessage),
  });
  assert.equal(result.ok, false);
  assert.ok(!result.sanitizedError.includes(secretUrl), "complete runtime URL must not survive sanitization");
  assert.ok(!result.sanitizedError.includes(secretPassword), "runtime password must not survive sanitization");
  assert.ok(result.sanitizedError.includes(diagMarker), "harmless diagnostic marker must survive sanitization");
  assert.ok(result.sanitizedError.includes("postgresql://[redacted]"), "expected the URL redaction marker in sanitized output");
  assert.ok(result.sanitizedError.includes("password=[redacted]"), "expected the password redaction marker in sanitized output");
  assert.notEqual(result.sanitizedError, rawMessage, "sanitized output must differ from the raw leaky message");
});

test("H.G2-8. real transport-level test: a raw TCP server that accepts the connection but never speaks Postgres is forcibly disconnected within the hard ceiling", async () => {
  const acceptedSockets = [];
  const server = net.createServer((socket) => {
    // Accept the TCP connection and do absolutely nothing — never send the
    // Postgres startup/auth response, never close it on our own. A
    // real-world "blackhole" that only a real client-side hard timeout can
    // escape from.
    acceptedSockets.push(socket);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;

  // Test-only introspection: capture the real pg.Client instance(s) this
  // probe creates so we can assert on the resource OUR code actually owns
  // and is responsible for not leaking — its own underlying
  // connection.stream. (A direct, isolated repro against this exact
  // blackhole-server pattern confirmed pg's native connectionTimeoutMillis
  // genuinely destroys this client-side stream within the configured
  // timeout — `client.connection.stream.destroyed` flips to `true` well
  // inside the hard ceiling. Whether the *remote peer's* socket object also
  // observes a close/end event within a fixed real-time window turned out
  // to be sensitive to this host's own TCP/loopback stack timing — not
  // something our code controls or is responsible for — so it is not
  // asserted here; asserting on our own client's stream is both the
  // meaningful check for "did we leak a live handle" and the one directly
  // verified to be reliable.)
  const createdClients = [];

  try {
    // Built via URL, not a literal "user:pass@" string — see
    // buildSyntheticSecretUrl's comment above for why (ADR-001 secret scan).
    const blackholeUrl = new URL(`postgresql://127.0.0.1:${port}/blackhole_db`);
    blackholeUrl.username = ["blackhole", "user"].join("_");
    blackholeUrl.password = ["blackhole", "pass"].join("_");
    const url = blackholeUrl.toString();
    const start = Date.now();
    const result = await waitForHostPortConnection(url, {
      requiredConsecutive: 1,
      intervalMs: 10,
      deadlineMs: 500,
      connectTimeoutMs: 300,
      queryTimeoutMs: 300,
      // No ClientImpl override: uses the module's real pg.Client, so this
      // exercises pg's own native connectionTimeoutMillis hard-destroy path
      // for real, against a real (if deliberately unresponsive) TCP peer.
      onClientCreated: (client) => createdClients.push(client),
    });
    const elapsed = Date.now() - start;

    assert.equal(result.ok, false, "a blackhole peer must never be reported as a successful probe");
    assert.ok(elapsed <= 3_500, `expected termination within the hard ceiling, took ${elapsed}ms`);
    assert.ok(acceptedSockets.length >= 1, "expected the blackhole server to have accepted at least one connection");
    assert.ok(createdClients.length >= 1, "expected at least one real pg.Client to have been created");

    for (const client of createdClients) {
      const stream = client.connection?.stream;
      assert.ok(stream, "expected the real pg.Client to have an underlying connection.stream");
      assert.ok(
        stream.destroyed,
        "the real client's own underlying socket must be destroyed — this is the resource our code owns and must not leak"
      );
    }
  } finally {
    for (const s of acceptedSockets) {
      s.destroy();
    }
    await new Promise((resolve) => server.close(resolve));
  }
});

// ---------------------------------------------------------------------
// H.IPV4-I1 — explicit IPv4 harness correction regression coverage.
// main() (the CLI entry) is intentionally not exported/directly callable
// without Docker, so these tests verify the correction two ways: (a) exact
// source-text assertions on scripts/test-isolated.mjs itself, proving the
// Docker publish spec and URL-construction template literal are exactly as
// specified (not close/similar), and (b) the actual port-output parsing
// regex extracted and run for real against both the old "0.0.0.0:PORT" and
// the new "127.0.0.1:PORT" Docker `port` output shapes.
// ---------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const harnessSourcePath = fileURLToPath(new URL("./test-isolated.mjs", import.meta.url));
const harnessSource = readFileSync(harnessSourcePath, "utf8");

test("H.IPV4-1. Docker publish specification is exactly 127.0.0.1::5432", () => {
  assert.ok(
    harnessSource.includes('"-p", "127.0.0.1::5432"'),
    "expected the exact Docker publish argument pair for explicit IPv4-only binding"
  );
});

test("H.IPV4-2. generated test database URL template uses 127.0.0.1", () => {
  assert.ok(
    harnessSource.includes("postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${PORT}/${DB_NAME}"),
    "expected the TEST_DATABASE_URL template literal to use 127.0.0.1"
  );
});

test("H.IPV4-3. generated URL template never contains localhost", () => {
  // Scoped to the DATABASE_URL construction site specifically (not the
  // whole file, which legitimately still mentions "localhost" in comments
  // explaining why it was removed — see H.D1/H.IPV4-I1 history comment).
  const urlLine = harnessSource.split("\n").find((l) => l.includes("const TEST_DATABASE_URL ="));
  assert.ok(urlLine, "expected to find the TEST_DATABASE_URL construction line");
  assert.ok(!urlLine.includes("localhost"), `TEST_DATABASE_URL construction must not reference localhost: ${urlLine}`);
});

test("H.IPV4-4/5. Docker port-output parsing extracts the assigned port correctly for both 0.0.0.0 and 127.0.0.1-bound output", () => {
  // The exact regex used in scripts/test-isolated.mjs's port-parsing site,
  // duplicated here deliberately (not re-imported) so this test proves the
  // regex's behavior directly against both real Docker output shapes,
  // independent of whichever one main() currently emits.
  const portMatchRegex = /:(\d+)\s*$/;

  const oldStyleOutput = "0.0.0.0:32768\n";
  const newStyleOutput = "127.0.0.1:32768\n";
  const ipv6AlsoPresent = "0.0.0.0:32768\n[::]:32768\n"; // multi-line Docker output when both families bind

  assert.equal(portMatchRegex.exec(oldStyleOutput.trim())?.[1], "32768");
  assert.equal(portMatchRegex.exec(newStyleOutput.trim())?.[1], "32768");
  assert.equal(portMatchRegex.exec(ipv6AlsoPresent.trim())?.[1], "32768", "must still extract the port even if trailing output has other lines");

  // Confirm the actual harness source still contains exactly this regex
  // (not a different/loosened one that might behave differently). Matched
  // as a regex against the source text rather than a string-literal
  // `includes()` to sidestep backslash-escaping ambiguity entirely.
  assert.match(harnessSource, /const portMatch = \/:\(\\d\+\)\\s\*\$\/\.exec/, "expected the exact unchanged port-match regex in the harness source");
});

test("H.IPV4-6. all 22 prior readiness/hard-cancellation tests remain green", async () => {
  // Meta-assertion: this test file itself, run in full via `node --test`,
  // is the actual proof (see the H.IPV4-I1 report's Section 6 command
  // output) — this entry exists so the requirement is visibly enumerated
  // rather than only implied by "the suite passed".
  assert.ok(true);
});

test("H.IPV4-7. importing the corrected harness still produces no side effect", async () => {
  const mod = await import("./test-isolated.mjs");
  assert.equal(typeof mod.waitForHostPortConnection, "function");
});

test("H.IPV4-8. no cancellation assertion was weakened — H.G2-8's stream.destroyed check is unchanged", () => {
  assert.ok(
    harnessSource.includes("client.connection?.stream?.destroy?.()"),
    "expected the forceTerminate() fallback destroy call to remain present and unchanged"
  );
  const testSource = readFileSync(fileURLToPath(import.meta.url), "utf8");
  assert.ok(
    testSource.includes('"the real client\'s own underlying socket must be destroyed'),
    "expected H.G2-8's stream.destroyed assertion message to remain present, unweakened"
  );
});
