import fs from "fs";
import path from "path";

async function run() {
  const filePath = path.resolve(process.cwd(), "uploads", "pdf", "1784024562342-500533262.pdf");
  const buffer = fs.readFileSync(filePath);
  
  const pdfParseModule = await import("pdf-parse");
  const PDFParseCtor =
    (pdfParseModule as any).PDFParse ||
    (pdfParseModule as any).default?.PDFParse ||
    (pdfParseModule as any).default;

  const parser = new PDFParseCtor({ data: buffer });
  const result = await parser.getText();
  console.log("PDF TEXT LAYER:");
  console.log(result?.text || "");
  await parser.destroy?.();
}

run().catch(console.error);
