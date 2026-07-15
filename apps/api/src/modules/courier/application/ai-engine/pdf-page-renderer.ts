/**
 * Server-side PDF → PNG page images for Vision extraction.
 * Uses pdfjs-dist + @napi-rs/canvas (already pulled in via pdf-parse).
 */
import { createRequire } from "module";
import { pathToFileURL } from "url";

const require = createRequire(import.meta.url);

export type RenderPdfPagesOptions = {
  maxPages?: number;
  scale?: number;
};

async function loadPdfJs(): Promise<any> {
  try {
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch {
    // @ts-expect-error - dynamic import
    return await import("pdfjs-dist/build/pdf.mjs");
  }
}

function resolveWorkerSrc(): string {
  try {
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    return pathToFileURL(workerPath).href;
  } catch {
    try {
      const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.mjs");
      return pathToFileURL(workerPath).href;
    } catch {
      return "";
    }
  }
}

function loadCanvas(): {
  createCanvas: (w: number, h: number) => any;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@napi-rs/canvas");
}

/**
 * Rasterize the first N pages of a PDF into PNG buffers.
 * Returns [] on failure (caller falls back to OCR-only / manual).
 */
export async function renderPdfPagesToPng(
  buffer: Buffer,
  opts: RenderPdfPagesOptions = {},
): Promise<Buffer[]> {
  // Keep pages/scale modest to stay within free-tier Vision token limits.
  const maxPages = opts.maxPages ?? 3;
  const scale = opts.scale ?? 1.25;

  if (!buffer?.length || buffer.slice(0, 4).toString() !== "%PDF") {
    return [];
  }

  try {
    const pdfjs = await loadPdfJs();
    const { createCanvas } = loadCanvas();
    const workerSrc = resolveWorkerSrc();
    if (pdfjs.GlobalWorkerOptions && workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    }

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;
    const pageCount = Math.min(doc.numPages || 0, maxPages);
    const images: Buffer[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      images.push(canvas.toBuffer("image/png"));
    }

    try {
      await doc.destroy?.();
    } catch {
      /* ignore */
    }

    return images;
  } catch (err) {
    console.error("[pdf-render] Failed to rasterize PDF pages:", err);
    return [];
  }
}

/** Detect whether buffer is an image (non-PDF) suitable for Vision. */
export function isImageBuffer(buffer: Buffer): boolean {
  if (!buffer?.length) return false;
  const hex = buffer.slice(0, 4).toString("hex");
  if (hex.startsWith("89504e47")) return true; // PNG
  if (hex.startsWith("ffd8")) return true; // JPEG
  if (buffer.slice(8, 12).toString() === "WEBP") return true;
  return false;
}

export function imageMimeType(buffer: Buffer): "image/png" | "image/jpeg" | "image/webp" {
  const hex = buffer.slice(0, 4).toString("hex");
  if (hex.startsWith("89504e47")) return "image/png";
  if (hex.startsWith("ffd8")) return "image/jpeg";
  if (buffer.slice(8, 12).toString() === "WEBP") return "image/webp";
  return "image/png";
}

/** Collect page/image buffers for Vision from upload bytes. */
export async function collectVisionImages(buffer: Buffer): Promise<
  Array<{ mime_type: "image/png" | "image/jpeg" | "image/webp"; base64: string }>
> {
  if (isImageBuffer(buffer)) {
    return [
      {
        mime_type: imageMimeType(buffer),
        base64: buffer.toString("base64"),
      },
    ];
  }

  const pages = await renderPdfPagesToPng(buffer, { maxPages: 3, scale: 1.25 });
  return pages.map((png) => ({
    mime_type: "image/png" as const,
    base64: png.toString("base64"),
  }));
}
