import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import {
  setAuthCookies,
  clearAuthCookies,
  readCookie,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from "./auth-cookies";

function mockRes() {
  const cookie = vi.fn();
  const clearCookie = vi.fn();
  return { cookie, clearCookie } as unknown as Response & {
    cookie: ReturnType<typeof vi.fn>;
    clearCookie: ReturnType<typeof vi.fn>;
  };
}

function reqWithCookieHeader(header?: string): Request {
  return { headers: { cookie: header } } as unknown as Request;
}

describe("readCookie", () => {
  it("returns the value for a matching cookie", () => {
    const req = reqWithCookieHeader("access_token=abc123; other=x");
    expect(readCookie(req, ACCESS_COOKIE)).toBe("abc123");
  });

  it("finds a cookie that is not first in the header", () => {
    const req = reqWithCookieHeader("foo=1; refresh_token=r-9; bar=2");
    expect(readCookie(req, REFRESH_COOKIE)).toBe("r-9");
  });

  it("url-decodes the value", () => {
    const req = reqWithCookieHeader("access_token=a%20b%3Dc");
    expect(readCookie(req, ACCESS_COOKIE)).toBe("a b=c");
  });

  it("returns null when the cookie is absent", () => {
    expect(readCookie(reqWithCookieHeader("other=x"), ACCESS_COOKIE)).toBeNull();
  });

  it("returns null when there is no Cookie header", () => {
    expect(readCookie(reqWithCookieHeader(undefined), ACCESS_COOKIE)).toBeNull();
  });

  it("does not partial-match a similarly named cookie", () => {
    const req = reqWithCookieHeader("xaccess_token=nope");
    expect(readCookie(req, ACCESS_COOKIE)).toBeNull();
  });
});

describe("setAuthCookies", () => {
  it("sets httpOnly, SameSite=Lax access + refresh cookies with correct scoping", () => {
    const res = mockRes();
    setAuthCookies(res, { token: "jwt-tok", refreshToken: "refresh-tok" });

    expect(res.cookie).toHaveBeenCalledTimes(2);

    const [accessName, accessValue, accessOpts] = res.cookie.mock.calls[0];
    expect(accessName).toBe(ACCESS_COOKIE);
    expect(accessValue).toBe("jwt-tok");
    expect(accessOpts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(accessOpts.maxAge).toBeGreaterThan(0);

    const [refreshName, refreshValue, refreshOpts] = res.cookie.mock.calls[1];
    expect(refreshName).toBe(REFRESH_COOKIE);
    expect(refreshValue).toBe("refresh-tok");
    // Refresh cookie is scoped to the auth endpoints only.
    expect(refreshOpts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/api/auth" });
  });
});

describe("clearAuthCookies", () => {
  it("clears both auth cookies on their respective paths", () => {
    const res = mockRes();
    clearAuthCookies(res);
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
    expect(res.clearCookie.mock.calls[0][0]).toBe(ACCESS_COOKIE);
    expect(res.clearCookie.mock.calls[1][0]).toBe(REFRESH_COOKIE);
    expect(res.clearCookie.mock.calls[1][1]).toMatchObject({ path: "/api/auth" });
  });
});
