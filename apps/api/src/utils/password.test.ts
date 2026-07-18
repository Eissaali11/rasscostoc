import { describe, expect, it } from "vitest";
import { hashPassword, isBcryptHash, verifyPassword } from "./password";

describe("password utils (ERP-008-P1.3)", () => {
  it("detects bcrypt hashes only", () => {
    expect(isBcryptHash("$2a$10$abcdefghijklmnopqrstuu")).toBe(true);
    expect(isBcryptHash("$2b$10$abcdefghijklmnopqrstuu")).toBe(true);
    expect(isBcryptHash("admin123")).toBe(false);
    expect(isBcryptHash("")).toBe(false);
    expect(isBcryptHash(null)).toBe(false);
  });

  it("verifies bcrypt hashes and rejects plaintext stored values", async () => {
    const hash = await hashPassword("Str0ng-Secret!");
    expect(await verifyPassword("Str0ng-Secret!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("admin123", "admin123")).toBe(false);
    expect(await verifyPassword("admin123", "not-a-hash")).toBe(false);
  });
});
