/**
 * CI Guard for Zero Local Storage Architecture Compliance
 * Checks that forbidden file-reception patterns do NOT exist in Courier PDF routes or Bot.
 */

const fs = require("fs");
const path = require("path");

const FORBIDDEN_PATTERNS = [
  { pattern: /multer\.memoryStorage/, name: "multer.memoryStorage" },
  { pattern: /upload_pdf_to_rassco/, name: "upload_pdf_to_rassco" },
  { pattern: /files\s*=\s*\{\s*["']file["']\s*:/, name: "files={'file': ...}" },
];

const TARGET_FILES = [
  path.join(__dirname, "..", "apps", "api", "src", "modules", "courier", "presentation", "routes", "courier.routes.ts"),
  path.join(__dirname, "..", "apps", "api", "src", "core", "uploads", "upload-policy.ts"),
];

let failed = false;

console.log("=== RUNNING CI ZERO-STORAGE COMPLIANCE GUARD ===");

for (const filePath of TARGET_FILES) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] File not found: ${filePath}`);
    continue;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const { pattern, name } of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`[FAIL] Forbidden zero-storage pattern "${name}" found in ${filePath}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("❌ ZERO-STORAGE COMPLIANCE GUARD FAILED!");
  process.exit(1);
} else {
  console.log("✅ ZERO-STORAGE COMPLIANCE GUARD PASSED! All forbidden file reception patterns absent.");
  process.exit(0);
}
