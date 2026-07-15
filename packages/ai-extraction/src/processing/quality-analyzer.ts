import type { DetectedImageRegion, PixelBuffer, QualityMetrics } from "./types.js";

export interface QualityAnalyzer {
  readonly id: string;
  analyze(region: DetectedImageRegion): QualityMetrics;
}

function luminanceStats(pixels: PixelBuffer): { variance: number; edge: number } {
  const { width, height, channels, data } = pixels;
  const n = width * height;
  if (n === 0) return { variance: 0, edge: 0 };

  let sum = 0;
  const lum = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let y: number;
    if (channels === 1) {
      y = data[i]!;
    } else {
      const o = i * channels;
      y = 0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!;
    }
    lum[i] = y;
    sum += y;
  }
  const mean = sum / n;
  let varSum = 0;
  let edgeSum = 0;
  let edgeCount = 0;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = row * width + col;
      const d = lum[i]! - mean;
      varSum += d * d;
      if (col + 1 < width) {
        edgeSum += Math.abs(lum[i]! - lum[i + 1]!);
        edgeCount++;
      }
      if (row + 1 < height) {
        edgeSum += Math.abs(lum[i]! - lum[i + width]!);
        edgeCount++;
      }
    }
  }
  return {
    variance: varSum / n,
    edge: edgeCount ? edgeSum / edgeCount : 0,
  };
}

/**
 * Heuristic quality 0–100 from DPI + pixel statistics (no native image libs).
 * Blurry / flat buffers score low; structured gradients score higher.
 */
export class HeuristicQualityAnalyzer implements QualityAnalyzer {
  readonly id = "heuristic_quality_analyzer_v1";

  analyze(region: DetectedImageRegion): QualityMetrics {
    const reasons: string[] = [];
    const dpi = region.dpi;
    let dpiScore = 40;
    if (dpi >= 200) dpiScore = 95;
    else if (dpi >= 150) dpiScore = 85;
    else if (dpi >= 100) dpiScore = 65;
    else {
      dpiScore = 35;
      reasons.push("low_dpi");
    }

    let blur_score = 50;
    let noise_score = 50;
    let structureScore = 50;

    if (region.pixels) {
      const { variance, edge } = luminanceStats(region.pixels);
      // Flat image → low variance/edge → blurry/blank
      blur_score = Math.max(0, Math.min(100, Math.round(edge * 4)));
      noise_score = Math.max(0, Math.min(100, Math.round(100 - Math.min(variance / 20, 100))));
      structureScore = Math.max(0, Math.min(100, Math.round(variance / 15 + edge * 2)));
      if (blur_score < 25) reasons.push("low_edge_energy");
      if (variance < 50) reasons.push("low_contrast_or_blank");
      if (variance > 4000) reasons.push("high_noise");
    } else {
      reasons.push("no_pixel_data");
      structureScore = dpiScore;
    }

    const minDim = Math.min(region.width, region.height);
    if (minDim < 400) reasons.push("small_dimensions");

    const quality_score = Math.max(
      0,
      Math.min(
        100,
        Math.round(dpiScore * 0.35 + structureScore * 0.4 + blur_score * 0.15 + (100 - Math.abs(50 - noise_score)) * 0.1),
      ),
    );

    return {
      quality_score,
      blur_score,
      noise_score,
      rotation_deg_estimate: 0,
      dpi_estimate: dpi,
      reasons,
    };
  }
}
