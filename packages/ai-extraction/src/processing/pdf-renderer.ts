import type { RenderedPage, PixelBuffer } from "./types.js";

export interface PdfRenderer {
  readonly id: string;
  render(input: {
    document_id: string;
    bytes: Uint8Array;
    mime_type: string;
  }): Promise<RenderedPage[]>;
}

/** Build a simple solid/noisy grayscale buffer for fixtures & unit tests. */
export function createSyntheticPixels(args: {
  width: number;
  height: number;
  /** 0 = flat gray, higher = more high-frequency noise */
  noise?: number;
  /** Soft horizontal gradient — proxy for “sharp” structure */
  gradient?: boolean;
}): PixelBuffer {
  const channels = 1 as const;
  const data = new Uint8Array(args.width * args.height);
  const noise = args.noise ?? 0;
  for (let y = 0; y < args.height; y++) {
    for (let x = 0; x < args.width; x++) {
      let v = args.gradient ? Math.floor((x / args.width) * 200) + 20 : 128;
      if (noise > 0) {
        v = Math.max(0, Math.min(255, v + ((x * 17 + y * 31) % (noise * 2 + 1)) - noise));
      }
      data[y * args.width + x] = v;
    }
  }
  return { width: args.width, height: args.height, channels, data };
}

/**
 * Fixture / test renderer — no native PDF dependency.
 * Encoding (UTF-8 JSON in bytes):
 * `{ "pages": [ { "width": 800, "height": 1100, "dpi": 150, "noise": 2, "gradient": true }, ... ] }`
 * Also accepts `image/png` / `image/jpeg` as a single synthetic page (metadata only unless pages JSON).
 */
export class FixturePdfRenderer implements PdfRenderer {
  readonly id = "fixture_pdf_renderer_v1";

  async render(input: {
    document_id: string;
    bytes: Uint8Array;
    mime_type: string;
  }): Promise<RenderedPage[]> {
    void input.document_id;
    if (input.mime_type === "application/json" || looksLikeJson(input.bytes)) {
      return pagesFromJson(input.bytes);
    }
    if (input.mime_type.startsWith("image/")) {
      return [
        {
          page: 1,
          width: 800,
          height: 1100,
          dpi: 150,
          pixels: createSyntheticPixels({ width: 800, height: 1100, gradient: true, noise: 1 }),
        },
      ];
    }
    // PDF bytes without a raster engine: one placeholder page (explicit limitation of PR-006A-3 fixture path)
    return [
      {
        page: 1,
        width: 794,
        height: 1123,
        dpi: 96,
        pixels: createSyntheticPixels({ width: 200, height: 280, gradient: true }),
      },
    ];
  }
}

function looksLikeJson(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.slice(0, 1)).trim();
  return head === "{";
}

function pagesFromJson(bytes: Uint8Array): RenderedPage[] {
  const text = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(text) as {
    pages?: Array<{
      width?: number;
      height?: number;
      dpi?: number;
      noise?: number;
      gradient?: boolean;
      blur?: boolean;
    }>;
  };
  const defs = parsed.pages?.length
    ? parsed.pages
    : [{ width: 800, height: 1100, dpi: 150, gradient: true }];
  return defs.map((p, i) => {
    const width = p.width ?? 800;
    const height = p.height ?? 1100;
    const dpi = p.dpi ?? 150;
    const pixels = createSyntheticPixels({
      width: Math.min(width, 400),
      height: Math.min(height, 560),
      noise: p.blur ? 40 : (p.noise ?? 2),
      gradient: p.blur ? false : p.gradient !== false,
    });
    return { page: i + 1, width, height, dpi, pixels };
  });
}

/** Pass-through when caller already rasterized pages. */
export class PassthroughPageRenderer implements PdfRenderer {
  readonly id = "passthrough_page_renderer_v1";

  constructor(private readonly pages: RenderedPage[]) {}

  async render(): Promise<RenderedPage[]> {
    return this.pages.map((p) => ({ ...p }));
  }
}
