import { describe, expect, it } from "vitest";
import { HeuristicGroupingProvider } from "../grouping/heuristic-grouping.js";
import { createStableImageId } from "./image-ids.js";
import { DocumentProcessingPipeline } from "./pipeline.js";
import { createSyntheticPixels, FixturePdfRenderer } from "./pdf-renderer.js";
import { HeuristicQualityAnalyzer } from "./quality-analyzer.js";

function fixtureBytes(pages: unknown) {
  return new TextEncoder().encode(JSON.stringify({ pages }));
}

describe("PR-006A-3 Document Processing", () => {
  it("assigns stable image ids across pages (A08)", async () => {
    const pipeline = new DocumentProcessingPipeline({
      renderer: new FixturePdfRenderer(),
    });
    const doc = await pipeline.process({
      document_id: "doc-proc-1",
      mime_type: "application/json",
      bytes: fixtureBytes([
        { width: 800, height: 1100, dpi: 150, gradient: true },
        { width: 800, height: 1100, dpi: 150, gradient: true },
        { width: 800, height: 1100, dpi: 72, blur: true },
      ]),
      extraction_attempt_id: "attempt_1",
    });

    expect(doc.page_count).toBe(3);
    expect(doc.images).toHaveLength(3);
    expect(doc.images[0]!.image_id).toBe(
      createStableImageId({ document_id: "doc-proc-1", page: 1, region_index: 1 }),
    );
    expect(doc.images[2]!.image_id).toBe("img:doc-proc-1:p3:r1");
    expect(doc.image_refs.every((r) => typeof r.image_id === "string")).toBe(true);
    expect(doc.provenance.pipeline_version).toBe("docproc_v1");
    expect(doc.images[0]!.provenance.renderer).toBe("fixture_pdf_renderer_v1");
  });

  it("scores per-image quality and keeps low scores visible (A09–A10)", async () => {
    const pipeline = new DocumentProcessingPipeline();
    const doc = await pipeline.process({
      document_id: "doc-q",
      mime_type: "application/json",
      bytes: fixtureBytes([
        { width: 1200, height: 1600, dpi: 200, gradient: true, noise: 1 },
        { width: 400, height: 400, dpi: 72, blur: true },
      ]),
    });
    const scores = doc.images.map((i) => i.quality.quality_score);
    expect(scores[0]!).toBeGreaterThan(scores[1]!);
    expect(scores.every((s) => s >= 0 && s <= 100)).toBe(true);
    expect(doc.images[1]!.quality.reasons.length).toBeGreaterThan(0);
  });

  it("applies preprocess profile for degraded images (A11–A12)", async () => {
    const pipeline = new DocumentProcessingPipeline();
    const doc = await pipeline.process({
      document_id: "doc-pre",
      mime_type: "application/json",
      bytes: fixtureBytes([{ width: 300, height: 300, dpi: 72, blur: true }]),
    });
    const img = doc.images[0]!;
    expect(img.preprocess_profile).toMatch(/preprocess_v1_/);
    expect(img.preprocess_ops.length).toBeGreaterThan(0);
    expect(img.provenance.preprocessor).toBe("profile_image_preprocessor_v1");
  });

  it("accepts pre-rendered pages without invoking PDF decode", async () => {
    const pipeline = new DocumentProcessingPipeline();
    const doc = await pipeline.process({
      document_id: "doc-prerender",
      mime_type: "application/pdf",
      bytes: new Uint8Array([0]),
      pre_rendered_pages: [
        {
          page: 1,
          width: 600,
          height: 800,
          dpi: 150,
          pixels: createSyntheticPixels({ width: 120, height: 160, gradient: true }),
        },
      ],
    });
    expect(doc.page_count).toBe(1);
    expect(doc.images[0]!.image_id).toContain("doc-prerender");
  });
});

describe("HeuristicQualityAnalyzer", () => {
  it("returns bounded scores", () => {
    const qa = new HeuristicQualityAnalyzer();
    const metrics = qa.analyze({
      image_id: "img:x:p1:r1",
      page: 1,
      region_index: 1,
      region_id: "p1-r1",
      source: "full_page",
      width: 800,
      height: 1100,
      dpi: 150,
      pixels: createSyntheticPixels({ width: 80, height: 110, gradient: true, noise: 2 }),
    });
    expect(metrics.quality_score).toBeGreaterThanOrEqual(0);
    expect(metrics.quality_score).toBeLessThanOrEqual(100);
  });
});

describe("HeuristicGroupingProvider (PR-006A-3)", () => {
  const grouping = new HeuristicGroupingProvider();

  it("groups one device across adjacent pages (A16)", async () => {
    const result = await grouping.group({
      document_type: "installation_report",
      images: [
        { page: 1, region_id: "p1-r1", image_id: "a", quality_score: 90 },
        { page: 2, region_id: "p2-r1", image_id: "b", quality_score: 88 },
      ],
      early_labels: [
        { page: 1, kind: "serial_number", value: "SN-1" },
        { page: 2, kind: "serial_number", value: "SN-1" },
      ],
    });
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0]!.images).toHaveLength(2);
    expect(result.devices[0]!.grouping_confidence).toBeGreaterThanOrEqual(90);
  });

  it("splits on conflicting serial labels and forces review (A17)", async () => {
    const result = await grouping.group({
      document_type: "installation_report",
      images: [
        { page: 1, region_id: "p1-r1", image_id: "a", quality_score: 90 },
        { page: 1, region_id: "p1-r2", image_id: "b", quality_score: 90 },
      ],
      early_labels: [
        { page: 1, region_id: "p1-r1", kind: "serial_number", value: "SN-A" },
        { page: 1, region_id: "p1-r2", kind: "serial_number", value: "SN-B" },
      ],
    });
    expect(result.devices.length).toBeGreaterThanOrEqual(2);
    expect(result.devices.every((d) => d.force_review || d.images.length === 1)).toBe(true);
  });

  it("creates three devices for three different SNs (A14)", async () => {
    const result = await grouping.group({
      document_type: "installation_report",
      images: [
        { page: 1, image_id: "1", quality_score: 90 },
        { page: 2, image_id: "2", quality_score: 90 },
        { page: 3, image_id: "3", quality_score: 90 },
      ],
      early_labels: [
        { page: 1, kind: "serial_number", value: "A" },
        { page: 2, kind: "serial_number", value: "B" },
        { page: 3, kind: "serial_number", value: "C" },
      ],
    });
    expect(result.devices).toHaveLength(3);
  });
});
