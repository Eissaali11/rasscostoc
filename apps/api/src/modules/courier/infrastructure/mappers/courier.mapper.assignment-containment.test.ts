/**
 * OPS-PERM-S0-B1-C.I1A — CourierRequestMapper.toPersistence() mass-
 * assignment containment for assignedToUserId, the new canonical
 * field-assignment column.
 *
 * The application-layer client-facing insert-schema containment proof for
 * the same column lives separately in
 * application/courier-assignment-mass-assignment-containment.test.ts — that
 * file cannot import this mapper without violating the Clean Architecture
 * Dependency Rule (application must not depend on infrastructure), so this
 * second, independent containment layer is proven here instead, colocated
 * with the mapper it tests.
 */
import { describe, expect, it } from "vitest";
import { CourierRequestMapper } from "./courier.mapper";

describe("OPS-PERM-S0-B1-C.I1A — CourierRequestMapper.toPersistence mass-assignment containment", () => {
  it("1. toPersistence() never emits assignedToUserId even when present on the input domain object", () => {
    const persisted = CourierRequestMapper.toPersistence({
      customerName: "Test Customer",
      // Cast through `any` to simulate an attacker-influenced object that
      // somehow carries this property despite the insert schema already
      // stripping it — this is the second, independent containment layer.
      assignedToUserId: "attacker-controlled-user-id",
    } as any);
    expect(persisted).not.toHaveProperty("assignedToUserId");
  });

  it("2. toPersistence() with no assignedToUserId at all still never introduces the key (no accidental default)", () => {
    const persisted = CourierRequestMapper.toPersistence({ customerName: "Test Customer" } as any);
    expect(persisted).not.toHaveProperty("assignedToUserId");
  });
});
