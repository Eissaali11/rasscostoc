import { describe, expect, it } from "vitest";
import { createDemoReviewFixture } from "./fixtures/demo-workspace.js";
import { confidenceBandLabel, confidenceTone } from "./model/confidence.js";
import {
  commitManualCorrection,
  createInitialState,
  selectDevice,
  selectField,
  selectImage,
  setDraftField,
  setPage,
  zoomBy,
} from "./model/workspace-state.js";

describe("PR-006A-7 AI Review Workspace state", () => {
  it("loads fixture with multi-device and sessions", () => {
    const fx = createDemoReviewFixture();
    expect(fx.devices.length).toBeGreaterThanOrEqual(2);
    expect(fx.sessions[0]?.attempts.length).toBeGreaterThanOrEqual(1);
    expect(fx.candidates_by_device["device-2"]?.length).toBeGreaterThanOrEqual(2);
    expect(fx.graph_nodes.some((n) => n.kind === "device")).toBe(true);
    expect(fx.graph_edges.some((e) => e.type === "conflicts_with")).toBe(true);
  });

  it("selecting a device highlights all linked images", () => {
    let state = createInitialState(createDemoReviewFixture());
    state = selectDevice(state, "device-1");
    expect(state.highlightedImageIds).toEqual([
      "img:doc-demo-001:p1:r1",
      "img:doc-demo-001:p2:r1",
    ]);
    expect(state.pageIndex).toBe(0);
  });

  it("selecting an image selects the owning device", () => {
    let state = createInitialState(createDemoReviewFixture());
    state = selectImage(state, "img:doc-demo-001:p3:r1");
    expect(state.selectedDeviceId).toBe("device-2");
    expect(state.highlightedImageIds).toEqual(["img:doc-demo-001:p3:r1"]);
    expect(state.pageIndex).toBe(2);
  });

  it("selects field with image highlight and bbox when present", () => {
    let state = createInitialState(createDemoReviewFixture());
    state = selectDevice(state, "device-1");
    state = selectField(state, "serial_number");
    expect(state.highlightedImageIds[0]).toBe("img:doc-demo-001:p1:r1");
    expect(state.highlightBBox).toEqual({ x: 0.12, y: 0.18, w: 0.55, h: 0.08 });
  });

  it("supports viewer zoom and page navigation bounds", () => {
    let state = createInitialState(createDemoReviewFixture());
    state = zoomBy(state, 0.5);
    expect(state.zoom).toBe(1.5);
    state = setPage(state, 99);
    expect(state.pageIndex).toBe(state.fixture.pages.length - 1);
  });

  it("commits versioned local corrections without courier persistence", () => {
    let state = createInitialState(createDemoReviewFixture());
    state = selectDevice(state, "device-1");
    state = setDraftField(state, "tid", "TID-FIXED");
    state = commitManualCorrection(state, "tester", "fix tid");
    expect(state.reviewHistory.at(-1)?.review_version).toBeGreaterThan(1);
    expect(state.reviewHistory.at(-1)?.field_diffs[0]?.after).toBe("TID-FIXED");
    const device = state.fixture.devices.find((d) => d.device_id === "device-1");
    expect(device?.tid).toBe("TID-FIXED");
  });

  it("maps confidence tones and band labels", () => {
    expect(confidenceTone(96)).toBe("high");
    expect(confidenceTone(60)).toBe("mid");
    expect(confidenceTone(20)).toBe("low");
    expect(confidenceBandLabel(96)).toBe("مرتفع");
    expect(confidenceBandLabel(60)).toBe("متوسط");
    expect(confidenceBandLabel(20)).toBe("منخفض");
  });
});
