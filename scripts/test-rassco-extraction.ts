import fs from "fs";
import path from "path";
import { runAiEngineExtraction } from "../apps/api/src/modules/courier/application/ai-engine/courier-pdf-extraction.adapter";

async function run() {
  const filePath = path.resolve(process.cwd(), "uploads", "pdf", "1784024562342-500533262.pdf");
  console.log("Loading file from:", filePath);
  if (!fs.existsSync(filePath)) {
    console.error("File does not exist!");
    process.exit(1);
  }
  const buffer = fs.readFileSync(filePath);
  console.log("File loaded. Running extraction with filename: 3device-report.pdf");
  
  const startTime = Date.now();
  const result = await runAiEngineExtraction(buffer, "3device-report.pdf");
  const latency = Date.now() - startTime;
  
  console.log("\n--- Extraction Result ---");
  console.log("Latency:", latency, "ms");
  console.log("Status:", result.ok ? "Success" : "Failed");
  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
