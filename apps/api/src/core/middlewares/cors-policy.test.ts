import { describe, expect, it } from "vitest";
import {
  isCorsOriginAllowed,
  parseCorsAllowedOrigins,
  resolveCorsAllowedOrigins,
} from "./cors-policy";

describe("cors-policy (ERP-008-P1.4)", () => {
  it("parses CSV env whitelist", () => {
    expect(parseCorsAllowedOrigins(" https://a.test ,https://b.test ")).toEqual([
      "https://a.test",
      "https://b.test",
    ]);
  });

  it("uses explicit env over defaults", () => {
    const allowed = resolveCorsAllowedOrigins({
      isDevelopment: false,
      envOrigins: "https://portal.example.com",
    });
    expect(allowed.has("https://portal.example.com")).toBe(true);
    expect(allowed.has("https://stc1.fun")).toBe(false);
  });

  it("production defaults include stc1.fun and stoc.fun", () => {
    const allowed = resolveCorsAllowedOrigins({ isDevelopment: false });
    expect(allowed.has("https://stc1.fun")).toBe(true);
    expect(allowed.has("https://www.stc1.fun")).toBe(true);
    expect(allowed.has("https://stoc.fun")).toBe(true);
  });

  it("development allows localhost without wildcard *", () => {
    const allowed = resolveCorsAllowedOrigins({ isDevelopment: true });
    expect(allowed.has("http://localhost:5173")).toBe(true);
    expect(isCorsOriginAllowed("*", allowed)).toBe(false);
    expect(isCorsOriginAllowed(undefined, allowed)).toBe(false);
  });

  it("rejects unlisted origins", () => {
    const allowed = resolveCorsAllowedOrigins({ isDevelopment: false });
    expect(isCorsOriginAllowed("https://evil.example", allowed)).toBe(false);
  });
});
