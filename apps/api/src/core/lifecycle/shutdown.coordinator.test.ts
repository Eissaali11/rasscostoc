import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { shutdownCoordinator } from "./shutdown.coordinator";

describe("ShutdownCoordinator Unit Tests", () => {
  let mockServer: any;
  let mockJobsWorker: any;
  let mockOutboxWorker: any;
  let mockDb: any;
  let exitMock: any;

  beforeEach(() => {
    mockServer = {
      close: vi.fn((callback) => {
        if (callback) callback();
      }),
      closeAllConnections: vi.fn(),
    };
    mockJobsWorker = {
      stop: vi.fn(),
      drain: vi.fn(() => Promise.resolve()),
    };
    mockOutboxWorker = {
      stop: vi.fn(),
      drain: vi.fn(() => Promise.resolve()),
    };
    mockDb = {
      closeDatabase: vi.fn(() => Promise.resolve()),
    };
    exitMock = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    // Reset private shutdown state of coordinator
    (shutdownCoordinator as any).isShuttingDown = false;
  });

  afterEach(() => {
    exitMock.mockRestore();
  });

  it("should shutdown components in correct sequence and call process.exit(0)", async () => {
    const callOrder: string[] = [];

    mockServer.close.mockImplementation((callback: any) => {
      callOrder.push("http");
      if (callback) callback();
    });

    mockJobsWorker.stop.mockImplementation(() => {
      callOrder.push("jobs-stop");
    });
    mockJobsWorker.drain.mockImplementation(() => {
      callOrder.push("jobs-drain");
      return Promise.resolve();
    });

    mockOutboxWorker.stop.mockImplementation(() => {
      callOrder.push("outbox-stop");
    });
    mockOutboxWorker.drain.mockImplementation(() => {
      callOrder.push("outbox-drain");
      return Promise.resolve();
    });

    mockDb.closeDatabase.mockImplementation(() => {
      callOrder.push("db");
      return Promise.resolve();
    });

    await shutdownCoordinator.shutdown({
      httpServer: mockServer as any,
      jobsWorker: mockJobsWorker as any,
      outboxWorker: mockOutboxWorker as any,
      db: mockDb as any,
    });

    expect(callOrder).toEqual([
      "http",
      "jobs-stop",
      "jobs-drain",
      "outbox-stop",
      "outbox-drain",
      "db",
    ]);
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("should be idempotent (ignoring second shutdown request)", async () => {
    const config = {
      httpServer: mockServer as any,
      jobsWorker: mockJobsWorker as any,
      outboxWorker: mockOutboxWorker as any,
      db: mockDb as any,
    };

    const firstPromise = shutdownCoordinator.shutdown(config);
    const secondPromise = shutdownCoordinator.shutdown(config);

    await Promise.all([firstPromise, secondPromise]);

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(mockJobsWorker.stop).toHaveBeenCalledTimes(1);
    expect(mockOutboxWorker.stop).toHaveBeenCalledTimes(1);
    expect(mockDb.closeDatabase).toHaveBeenCalledTimes(1);
  });

  it("should trigger HTTP force close on timeout", async () => {
    // Delay server close callback indefinitely to force timeout
    mockServer.close.mockImplementation(() => {});

    await shutdownCoordinator.shutdown({
      httpServer: mockServer as any,
      jobsWorker: mockJobsWorker as any,
      outboxWorker: mockOutboxWorker as any,
      db: mockDb as any,
      timeouts: {
        httpDrainMs: 50,
        jobsDrainMs: 10,
        outboxDrainMs: 10,
      },
    });

    expect(mockServer.closeAllConnections).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);
  });
});
