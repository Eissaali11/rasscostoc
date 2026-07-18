import { describe, expect, it, afterEach } from "vitest";
import http from "http";
import { AddressInfo } from "net";
import { LifecycleCoordinator } from "./lifecycle.coordinator";

/**
 * ERP-008 Phase 3 — Runtime Safety & Graceful Lifecycle Remediation.
 *
 * These use a real http.Server and real timers (no mocked shutdown paths)
 * to prove the coordinator's actual behavior: resource stop ordering,
 * idempotency under duplicate signals, real in-flight-request draining via
 * http.Server#close, and a bounded timeout that forces a non-zero exit
 * instead of hanging forever.
 */
describe("ERP-008 Phase 3 — LifecycleCoordinator", () => {
  afterEach(() => {
    // Some tests deliberately drive the timeout path, which sets
    // process.exitCode — reset it so it doesn't leak into the test runner's
    // own exit status.
    process.exitCode = undefined;
  });

  it("stops registered resources in the reverse of their registration order", async () => {
    const coordinator = new LifecycleCoordinator({ shutdownTimeoutMs: 5000 });
    const stopOrder: string[] = [];

    coordinator.register("db-pool", async () => {
      stopOrder.push("db-pool");
    });
    coordinator.register("jobs-worker", async () => {
      stopOrder.push("jobs-worker");
    });
    coordinator.register("outbox-worker", async () => {
      stopOrder.push("outbox-worker");
    });

    await coordinator.shutdown("test");

    expect(stopOrder).toEqual(["outbox-worker", "jobs-worker", "db-pool"]);
    expect(process.exitCode).toBe(0);
  });

  it("is idempotent: duplicate shutdown calls only stop resources once", async () => {
    const coordinator = new LifecycleCoordinator({ shutdownTimeoutMs: 5000 });
    let stopCallCount = 0;
    coordinator.register("resource", async () => {
      stopCallCount++;
    });

    await Promise.all([
      coordinator.shutdown("SIGTERM"),
      coordinator.shutdown("SIGINT"),
      coordinator.shutdown("SIGTERM-retry"),
    ]);

    expect(stopCallCount).toBe(1);
  });

  it("runs setBeforeShutdown synchronously before any resource is stopped", async () => {
    const coordinator = new LifecycleCoordinator({ shutdownTimeoutMs: 5000 });
    const events: string[] = [];

    coordinator.setBeforeShutdown(() => events.push("readiness-false"));
    coordinator.register("resource", async () => {
      events.push("resource-stopped");
    });

    await coordinator.shutdown("test");

    expect(events).toEqual(["readiness-false", "resource-stopped"]);
  });

  it("closes a real HTTP server: stops accepting new connections and drains an in-flight request", async () => {
    let markRequestReachedHandler: () => void;
    const inFlightRequestSeen = new Promise<void>((resolve) => {
      markRequestReachedHandler = resolve;
    });

    const server = http.createServer((_req, res) => {
      markRequestReachedHandler();
      // Simulate real work in progress; the response is only sent after
      // shutdown() has already been called, proving it still completes.
      setTimeout(() => {
        res.end("ok");
      }, 150);
    });

    await new Promise<void>((resolveListen) => server.listen(0, resolveListen));
    const port = (server.address() as AddressInfo).port;

    const coordinator = new LifecycleCoordinator({ shutdownTimeoutMs: 5000 });
    coordinator.registerHttpServer(server);

    // Kick off an in-flight request but do not await it yet.
    const inFlightResponse = new Promise<string>((resolveReq, reject) => {
      http.get(`http://127.0.0.1:${port}/`, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolveReq(body));
      }).on("error", reject);
    });

    await inFlightRequestSeen; // the request has actually reached the handler
    const shutdownPromise = coordinator.shutdown("test");

    // A new connection attempted after shutdown began must be refused.
    const newConnectionResult = await new Promise<string>((resolveConn) => {
      http.get(`http://127.0.0.1:${port}/`, () => resolveConn("unexpected-success"))
        .on("error", (err: NodeJS.ErrnoException) => resolveConn(err.code || "error"));
    });
    expect(["ECONNREFUSED", "ECONNRESET"]).toContain(newConnectionResult);

    // The in-flight request must still complete successfully.
    await expect(inFlightResponse).resolves.toBe("ok");
    await shutdownPromise;
    expect(process.exitCode).toBe(0);
  });

  it("forces a non-zero exit code when a resource's stop() exceeds the shutdown timeout, instead of hanging", async () => {
    const coordinator = new LifecycleCoordinator({ shutdownTimeoutMs: 200 });
    coordinator.register("stuck-resource", () => new Promise(() => {
      /* never resolves — simulates a hung shutdown */
    }));

    const start = Date.now();
    await coordinator.shutdown("test");
    const elapsedMs = Date.now() - start;

    expect(elapsedMs).toBeLessThan(1000);
    expect(process.exitCode).toBe(1);
  });
});
