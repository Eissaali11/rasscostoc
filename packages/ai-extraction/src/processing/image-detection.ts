import { createRegionId, createStableImageId } from "./image-ids.js";
import type { DetectedImageRegion, RenderedPage } from "./types.js";

export interface ImageDetector {
  readonly id: string;
  detect(args: { document_id: string; pages: RenderedPage[] }): DetectedImageRegion[];
}

/**
 * v1: each rendered page is one full-page image region.
 * Future: embedded photo detection / multi-device table crops.
 */
export class FullPageImageDetector implements ImageDetector {
  readonly id = "full_page_image_detector_v1";

  detect(args: { document_id: string; pages: RenderedPage[] }): DetectedImageRegion[] {
    return args.pages.map((page) => {
      const region_index = 1;
      return {
        image_id: createStableImageId({
          document_id: args.document_id,
          page: page.page,
          region_index,
        }),
        page: page.page,
        region_index,
        region_id: createRegionId(page.page, region_index),
        bbox: { x: 0, y: 0, w: page.width, h: page.height },
        pixels: page.pixels,
        source: "full_page" as const,
        width: page.width,
        height: page.height,
        dpi: page.dpi,
      };
    });
  }
}
