/**
 * Manual contract-verification script for the courier PDF routes.
 *
 * Run against a local dev server: tsx scripts/test-pdf-uploads-api.ts
 *
 * This used to upload real PDF files from uploads/test-files/ and assert on
 * AI-extracted device counts via the legacy multipart upload endpoint. That
 * endpoint (POST /api/courier/pdf/upload) is now permanently decommissioned
 * (410 Gone) as part of the Zero Local Storage architecture — RASSCO never
 * accepts file bytes over HTTP anymore, only Google Drive metadata via
 * POST /api/courier/pdf/register-drive (JSON only).
 *
 * This script no longer needs any PDF file, tracked or otherwise, and no
 * longer touches the database: every assertion below is a rejection that
 * happens before auth or body parsing ever runs, so nothing here depends on
 * a real session or real file content. The dummy payload is generated
 * in-memory and never written to disk.
 */

const BASE_URL = process.env.RASSCO_BASE_URL || "http://localhost:3001";

function dummyMultipartBody(): { body: Buffer; contentType: string } {
  const boundary = "----GuardContractTestBoundary";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="file"; filename="dummy.pdf"\r\n`),
    Buffer.from(`Content-Type: application/pdf\r\n\r\n`),
    Buffer.from("%PDF-1.4 in-memory dummy content, never written to disk\n"),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function expectStatus(
  label: string,
  path: string,
  init: RequestInit,
  expectedStatus: number,
  expectedCode?: string,
): Promise<boolean> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const statusOk = res.status === expectedStatus;
  let codeOk = true;
  let body: any = null;
  try {
    body = await res.json();
    if (expectedCode) {
      codeOk = body?.code === expectedCode;
    }
  } catch {
    if (expectedCode) codeOk = false;
  }

  if (statusOk && codeOk) {
    console.log(`  PASS - ${label}: status=${res.status}${expectedCode ? ` code=${body?.code}` : ""}`);
    return true;
  }
  console.error(
    `  FAIL - ${label}: expected status=${expectedStatus}${expectedCode ? ` code=${expectedCode}` : ""}, got status=${res.status} body=${JSON.stringify(body)}`,
  );
  return false;
}

async function run() {
  console.log(`--- Courier PDF route contract verification (${BASE_URL}) ---\n`);
  const { body, contentType } = dummyMultipartBody();
  let allPassed = true;

  allPassed =
    (await expectStatus(
      "POST /api/courier/pdf/upload is decommissioned (410 Gone)",
      "/api/courier/pdf/upload",
      { method: "POST", headers: { "Content-Type": contentType }, body },
      410,
      "ENDPOINT_GONE",
    )) && allPassed;

  allPassed =
    (await expectStatus(
      "POST /api/courier/pdf/register-drive rejects multipart (415)",
      "/api/courier/pdf/register-drive",
      { method: "POST", headers: { "Content-Type": contentType }, body },
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    )) && allPassed;

  allPassed =
    (await expectStatus(
      "POST /api/courier/pdf/register-drive rejects unauthenticated JSON (401)",
      "/api/courier/pdf/register-drive",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drive_url: "https://drive.google.com/file/d/abc/view", file_name: "report.pdf" }),
      },
      401,
    )) && allPassed;

  console.log(`\n--- ${allPassed ? "ALL CONTRACT CHECKS PASSED" : "SOME CONTRACT CHECKS FAILED"} ---`);
  process.exitCode = allPassed ? 0 : 1;
}

run().catch((err) => {
  console.error("Script failed:", err);
  process.exitCode = 1;
});
