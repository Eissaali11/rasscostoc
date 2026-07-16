import fs from "fs";
import path from "path";

async function run() {
  const source = path.resolve(process.cwd(), "uploads", "pdf", "1784024562342-500533262.pdf");
  const targetDir = path.resolve(process.cwd(), "uploads", "test-files");
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const files = [
    "single-device.pdf",
    "double-devices.pdf",
    "triple-devices.pdf",
    "incomplete-report.pdf"
  ];

  for (const file of files) {
    const dest = path.join(targetDir, file);
    fs.copyFileSync(source, dest);
    console.log(`Copied ${source} -> ${dest}`);
  }
}

run().catch(console.error);
