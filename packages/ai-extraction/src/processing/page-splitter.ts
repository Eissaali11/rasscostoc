import type { RenderedPage } from "./types.js";

export interface PageSplitter {
  readonly id: string;
  split(pages: RenderedPage[]): RenderedPage[];
}

/** Ensures 1-based contiguous page indices after render. */
export class ContiguousPageSplitter implements PageSplitter {
  readonly id = "contiguous_page_splitter_v1";

  split(pages: RenderedPage[]): RenderedPage[] {
    return pages
      .slice()
      .sort((a, b) => a.page - b.page)
      .map((p, i) => ({ ...p, page: i + 1 }));
  }
}
