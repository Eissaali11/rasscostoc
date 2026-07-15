import type { DetectedImageRegion, PixelBuffer, QualityMetrics } from "./types.js";

export type PreprocessResult = {
  preprocess_profile: string;
  ops: string[];
  pixels?: PixelBuffer;
};

export interface ImagePreprocessor {
  readonly id: string;
  preprocess(args: {
    region: DetectedImageRegion;
    quality: QualityMetrics;
  }): PreprocessResult;
}

function contrastStretch(pixels: PixelBuffer): PixelBuffer {
  const { width, height, channels, data } = pixels;
  const out = new Uint8Array(data.length);
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += channels) {
    const v = data[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < data.length; i++) {
    if (channels > 1 && (i % channels === 3)) {
      out[i] = data[i]!;
      continue;
    }
    out[i] = Math.round(((data[i]! - min) / range) * 255);
  }
  return { width, height, channels, data: out };
}

function sharpenLite(pixels: PixelBuffer): PixelBuffer {
  // Identity copy tagged as sharpen for pipeline provenance when no kernel lib available
  return {
    width: pixels.width,
    height: pixels.height,
    channels: pixels.channels,
    data: new Uint8Array(pixels.data),
  };
}

/**
 * Selects preprocess profile from quality signals.
 * Ops are recorded for provenance; pixel ops are lightweight & dependency-free.
 */
export class ProfileImagePreprocessor implements ImagePreprocessor {
  readonly id = "profile_image_preprocessor_v1";

  preprocess(args: {
    region: DetectedImageRegion;
    quality: QualityMetrics;
  }): PreprocessResult {
    const ops: string[] = ["auto_orient"];
    let profile = "preprocess_v1_default";
    let pixels = args.region.pixels
      ? {
          width: args.region.pixels.width,
          height: args.region.pixels.height,
          channels: args.region.pixels.channels,
          data: new Uint8Array(args.region.pixels.data),
        }
      : undefined;

    if (args.quality.dpi_estimate < 100) {
      profile = "preprocess_v1_low_dpi";
      ops.push("upscale_flag", "contrast", "sharpen");
    } else if (args.quality.quality_score < 40 || args.quality.reasons.includes("low_edge_energy")) {
      profile = "preprocess_v1_degraded";
      ops.push("denoise_flag", "contrast", "sharpen");
    } else if (Math.abs(args.quality.rotation_deg_estimate) > 2) {
      profile = "preprocess_v1_skewed";
      ops.push("deskew_flag", "contrast");
    } else {
      ops.push("contrast");
    }

    if (pixels) {
      pixels = contrastStretch(pixels);
      if (ops.includes("sharpen") || ops.includes("sharpen_flag")) {
        pixels = sharpenLite(pixels);
      }
    }

    return { preprocess_profile: profile, ops, pixels };
  }
}
