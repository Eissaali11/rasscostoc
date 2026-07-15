import { describe, expect, it } from "vitest";
import { createUxScenarioFixture, parseUxScenarioId } from "./fixtures/ux-scenarios.js";

describe("UX scenario fixtures", () => {
  it("parses scenario ids", () => {
    expect(parseUxScenarioId("UX-3")).toBe("UX-3");
    expect(parseUxScenarioId("ux-1")).toBe("UX-1");
    expect(parseUxScenarioId("nope")).toBeNull();
  });

  it("builds scale scenarios", () => {
    expect(createUxScenarioFixture("UX-1").devices).toHaveLength(1);
    expect(createUxScenarioFixture("UX-2").devices).toHaveLength(10);
    expect(createUxScenarioFixture("UX-3").devices).toHaveLength(100);
    expect(createUxScenarioFixture("UX-3").pages).toHaveLength(50);
    expect(createUxScenarioFixture("UX-4").pages.every((p) => p.quality_score < 40)).toBe(true);
    expect(createUxScenarioFixture("UX-5").candidates_by_device["device-1"]).toHaveLength(2);
    expect(
      createUxScenarioFixture("UX-5").graph_edges.some((e) => e.type === "conflicts_with"),
    ).toBe(true);
    expect(createUxScenarioFixture("UX-1").graph_nodes.some((n) => n.kind === "sn")).toBe(true);
  });
});
