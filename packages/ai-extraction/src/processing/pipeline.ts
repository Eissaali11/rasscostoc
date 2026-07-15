import { nowIso } from "../domain/ids.js";
import type { ImageRef } from "../domain/types.js";
import { FullPageImageDetector, type ImageDetector } from "./image-detection.js";
import { ContiguousPageSplitter, type PageSplitter } from "./page-splitter.js";
import { FixturePdfRenderer, type PdfRenderer } from "./pdf-renderer.js";
import { ProfileImagePreprocessor, type ImagePreprocessor } from "./preprocessor.js";
import { HeuristicQualityAnalyzer, type QualityAnalyzer } from "./quality-analyzer.js";
import {
  DOC_PROC_PIPELINE_VERSION,
  type DocumentProcessingInput,
  type ProcessedDocument,
  type ProcessedImage,
} from "./types.js";

export type DocumentProcessingDeps = {
  renderer?: PdfRenderer;
  pageSplitter?: PageSplitter;
  imageDetector?: ImageDetector;
  qualityAnalyzer?: QualityAnalyzer;
  preprocessor?: ImagePreprocessor;
};

export class DocumentProcessingPipeline {
  private readonly renderer: PdfRenderer;
  private readonly pageSplitter: PageSplitter;
  private readonly imageDetector: ImageDetector;
  private readonly qualityAnalyzer: QualityAnalyzer;
  private readonly preprocessor: ImagePreprocessor;

  constructor(deps: DocumentProcessingDeps = {}) {
    this.renderer = deps.renderer ?? new FixturePdfRenderer();
    this.pageSplitter = deps.pageSplitter ?? new ContiguousPageSplitter();
    this.imageDetector = deps.imageDetector ?? new FullPageImageDetector();
    this.qualityAnalyzer = deps.qualityAnalyzer ?? new HeuristicQualityAnalyzer();
    this.preprocessor = deps.preprocessor ?? new ProfileImagePreprocessor();
  }

  async process(input: DocumentProcessingInput): Promise<ProcessedDocument> {
    const rendered =
      input.pre_rendered_pages?.length
        ? input.pre_rendered_pages
        : await this.renderer.render({
            document_id: input.document_id,
            bytes: input.bytes,
            mime_type: input.mime_type,
          });

    const pages = this.pageSplitter.split(rendered);
    const regions = this.imageDetector.detect({
      document_id: input.document_id,
      pages,
    });

    const processed_at = nowIso();
    const images: ProcessedImage[] = regions.map((region) => {
      const quality = this.qualityAnalyzer.analyze(region);
      const pre = this.preprocessor.preprocess({ region, quality });
      return {
        image_id: region.image_id,
        page: region.page,
        region_id: region.region_id,
        width: region.width,
        height: region.height,
        quality,
        preprocess_profile: pre.preprocess_profile,
        preprocess_ops: pre.ops,
        pixels: pre.pixels,
        provenance: {
          pipeline_version: DOC_PROC_PIPELINE_VERSION,
          document_id: input.document_id,
          extraction_attempt_id: input.extraction_attempt_id,
          renderer: this.renderer.id,
          quality_analyzer: this.qualityAnalyzer.id,
          preprocessor: this.preprocessor.id,
          source_page: region.page,
          region_index: region.region_index,
          image_id: region.image_id,
          processed_at,
        },
      };
    });

    const image_refs: ImageRef[] = images.map((img) => ({
      page: img.page,
      region_id: img.region_id,
      image_id: img.image_id,
      quality_score: img.quality.quality_score,
      preprocess_profile: img.preprocess_profile,
      width: img.width,
      height: img.height,
    }));

    return {
      document_id: input.document_id,
      page_count: pages.length,
      pages,
      images,
      image_refs,
      provenance: {
        pipeline_version: DOC_PROC_PIPELINE_VERSION,
        document_id: input.document_id,
        extraction_attempt_id: input.extraction_attempt_id,
        renderer: this.renderer.id,
        page_splitter: this.pageSplitter.id,
        image_detector: this.imageDetector.id,
        quality_analyzer: this.qualityAnalyzer.id,
        preprocessor: this.preprocessor.id,
        page_count: pages.length,
        image_count: images.length,
        processed_at,
      },
    };
  }
}

export function toImageRefs(doc: ProcessedDocument): ImageRef[] {
  return doc.image_refs.map((r) => ({ ...r }));
}
