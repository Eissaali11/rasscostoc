import { describe, expect, it } from "vitest";
import {
  assertLastActiveAdminSurvives,
  LastActiveAdminError,
  wouldRemoveLastActiveAdmin,
  wouldBatchLeaveZeroActiveAdmins,
} from "./last-active-admin.guard";

describe("OPS-PERM-S1-F4 — last active admin protection", () => {
  it("removing the last active admin (zero others) is blocked", () => {
    expect(
      wouldRemoveLastActiveAdmin({ targetIsCurrentlyActiveAdmin: true, otherActiveAdminCount: 0, targetWillBeActiveAdminAfter: false })
    ).toBe(true);
  });

  it("removing an admin while another active admin remains is allowed", () => {
    expect(
      wouldRemoveLastActiveAdmin({ targetIsCurrentlyActiveAdmin: true, otherActiveAdminCount: 1, targetWillBeActiveAdminAfter: false })
    ).toBe(false);
  });

  it("a transition that keeps the target an active admin is always safe, even with zero others", () => {
    expect(
      wouldRemoveLastActiveAdmin({ targetIsCurrentlyActiveAdmin: true, otherActiveAdminCount: 0, targetWillBeActiveAdminAfter: true })
    ).toBe(false);
  });

  it("a transition on a non-admin target is never blocked by this rule", () => {
    expect(
      wouldRemoveLastActiveAdmin({ targetIsCurrentlyActiveAdmin: false, otherActiveAdminCount: 0, targetWillBeActiveAdminAfter: false })
    ).toBe(false);
  });

  it("assertLastActiveAdminSurvives throws a typed, Arabic-messaged error exactly when the predicate is true", () => {
    expect(() =>
      assertLastActiveAdminSurvives({ targetIsCurrentlyActiveAdmin: true, otherActiveAdminCount: 0, targetWillBeActiveAdminAfter: false })
    ).toThrow(LastActiveAdminError);
    expect(() =>
      assertLastActiveAdminSurvives({ targetIsCurrentlyActiveAdmin: true, otherActiveAdminCount: 2, targetWillBeActiveAdminAfter: false })
    ).not.toThrow();
  });
});

describe("OPS-PERM-S1-F4-R3 — wouldBatchLeaveZeroActiveAdmins (SET-aware, backup-restore motivating case)", () => {
  it("the exact spec example: 2 active admins, restore demotes BOTH → zero → true", () => {
    const current = new Set(["A", "B"]);
    const proposed = new Map([
      ["A", false],
      ["B", false],
    ]);
    expect(wouldBatchLeaveZeroActiveAdmins(current, proposed)).toBe(true);
  });

  it("2 active admins, restore demotes only one, the other untouched → false (allowed)", () => {
    const current = new Set(["A", "B"]);
    const proposed = new Map([["B", false]]);
    expect(wouldBatchLeaveZeroActiveAdmins(current, proposed)).toBe(false);
  });

  it("3 active admins (A,B,C), restore demotes A and B, C untouched → false (allowed, C remains)", () => {
    const current = new Set(["A", "B", "C"]);
    const proposed = new Map([
      ["A", false],
      ["B", false],
    ]);
    expect(wouldBatchLeaveZeroActiveAdmins(current, proposed)).toBe(false);
  });

  it("every current admin demoted, but a different user is promoted TO admin in the same batch → false (allowed) — the case row-at-a-time checking could wrongly reject", () => {
    const current = new Set(["A", "B", "C"]);
    const proposed = new Map([
      ["A", false],
      ["B", false],
      ["C", false],
      ["D", true], // D was not a current admin — promoted by this same restore
    ]);
    expect(wouldBatchLeaveZeroActiveAdmins(current, proposed)).toBe(false);
  });

  it("restore proposes a role change for a non-admin user only — never touches the admin set → false", () => {
    const current = new Set(["A"]);
    const proposed = new Map([["X", false]]); // X was never an active admin
    expect(wouldBatchLeaveZeroActiveAdmins(current, proposed)).toBe(false);
  });

  it("empty current admin set with no promotions proposed → true (already zero, stays zero)", () => {
    const current = new Set<string>();
    const proposed = new Map<string, boolean>();
    expect(wouldBatchLeaveZeroActiveAdmins(current, proposed)).toBe(true);
  });

  it("no proposed changes at all → matches current state exactly (non-empty stays non-empty)", () => {
    const current = new Set(["A", "B"]);
    const proposed = new Map<string, boolean>();
    expect(wouldBatchLeaveZeroActiveAdmins(current, proposed)).toBe(false);
  });
});
