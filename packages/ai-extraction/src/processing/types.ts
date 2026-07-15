import type { ImageRef } from "../domain/types.js";

export const DOC_PROC_PIPELINE_VERSION = "docproc_v1" as const;

export type PixelBuffer = {
  width: number;
  height: number;
  channels: 1 | 3 | 4;
  /** Row-major interleaved samples 0–255 */
  data: Uint8Array;
};

export type RenderedPage = {
  page: number;
  width: number;
  height: number;
  dpi: number;
  pixels?: PixelBuffer;
};

export type DetectedImageRegion = {
  image_id: string;
  page: number;
  region_index: number;
  region_id: string;
  bbox?: { x: number; y: number; w: number; h: number };
  pixels?: PixelBuffer;
  source: "full_page" | "embedded_region";
  width: number;
  height: number;
  dpi: number;
};

export type QualityMetrics = {
  quality_score: number;
  blur_score: number;
  noise_score: number;
  rotation_deg_estimate: number;
  dpi_estimate: number;
  reasons: string[];
};

export type ImageProcessingProvenance = {
  pipeline_version: typeof DOC_PROC_PIPELINE_VERSION;
  document_id: string;
  extraction_attempt_id?: string;
  renderer: string;
  quality_analyzer: string;
  preprocessor: string;
  source_page: number;
  region_index: number;
  image_id: string;
  processed_at: string;
};

export type ProcessedImage = {
  image_id: string;
  page: number;
  region_id: string;
  width: number;
  height: number;
  quality: QualityMetrics;
  preprocess_profile: string;
  preprocess_ops: string[];
  pixels?: PixelBuffer;
  provenance: ImageProcessingProvenance;
};

export type DocumentProcessingProvenance = {
  pipeline_version: typeof DOC_PROC_PIPELINE_VERSION;
  document_id: string;
  extraction_attempt_id?: string;
  renderer: string;
  page_splitter: string;
  image_detector: string;
  quality_analyzer: string;
  preprocessor: string;
  page_count: number;
  image_count: number;
  processed_at: string;
};

export type ProcessedDocument = {
  document_id: string;
  page_count: number;
  pages: RenderedPage[];
  images: ProcessedImage[];
  /** Ready for Grouping / Vision ports */
  image_refs: ImageRef[];
  provenance: DocumentProcessingProvenance;
};

export type DocumentProcessingInput = {
  document_id: string;
  mime_type: string;
  bytes: Uint8Array;
  extraction_attempt_id?: string;
  /** When set, skip PDF render and use these pages (fixtures / pre-rasterized). */
  pre_rendered_pages?: RenderedPage[];
};
