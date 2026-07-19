import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("utils/logger delegates to the canonical structured logger", () => {
  it("emits the canonical JSON shape and maps source -> module", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("hello", { source: "mod-x", metadata: { a: 1 } });

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.message).toBe("hello");
    expect(payload.module).toBe("mod-x");
    // `service` is emitted only by the canonical logger — proves delegation.
    expect(payload.service).toBe("stockpro-api");
    expect(payload.metadata).toEqual({ a: 1 });
  });

  it("routes errors through console.error with the error attached", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("boom", new Error("bad"), { source: "mod-y" });

    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.level).toBe("ERROR");
    expect(payload.module).toBe("mod-y");
    expect(payload.error.message).toBe("bad");
  });
});
