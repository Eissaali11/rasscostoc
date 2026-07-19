import fs from "fs";
import path from "path";
import { db } from "../apps/api/src/core/config/db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function uploadFile(fileName: string, filePath: string, token: string) {
  const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  const fileBuffer = fs.readFileSync(filePath);
  
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`),
    Buffer.from(`Content-Type: application/pdf\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const res = await fetch("http://localhost:3001/api/courier/pdf/upload", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`
    },
    body: body as any
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed for ${fileName}: ${res.status} - ${text}`);
  }

  return res.json();
}

async function run() {
  console.log("Locating admin user...");
  const [adminUser] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  if (!adminUser) {
    console.error("Admin user not found in database!");
    process.exit(1);
  }
  console.log(`Found admin user: ${adminUser.username} (ID: ${adminUser.id})`);

  const testToken = "test-token-validation-99999";
  const expiry = Date.now() + 3600 * 1000; // 1 hour from now

  console.log("Inserting session token directly into bearer_sessions...");
  await db.execute(sql`
    INSERT INTO bearer_sessions (token, user_id, role, username, region_id, expiry)
    VALUES (${testToken}, ${adminUser.id}, ${adminUser.role}, ${adminUser.username}, ${adminUser.regionId}, ${expiry.toString()})
    ON CONFLICT (token) DO UPDATE SET expiry = ${expiry.toString()}
  `);
  console.log("Session inserted successfully.");

  const testDir = path.resolve(process.cwd(), "uploads", "test-files");
  const scenarios = [
    { name: "single-device.pdf", expectedDevices: 1, expectedRequest: 144, expectedStatus: "pending" },
    { name: "double-devices.pdf", expectedDevices: 2, expectedRequest: 145, expectedStatus: "pending" },
    { name: "triple-devices.pdf", expectedDevices: 3, expectedRequest: 146, expectedStatus: "pending" },
    { name: "incomplete-report.pdf", expectedDevices: 1, expectedRequest: null, expectedStatus: "manual_review" }
  ];

  console.log("\n--- STARTING API EXTRACTION VALIDATION ---");

  for (const s of scenarios) {
    const filePath = path.join(testDir, s.name);
    console.log(`\nUploading scenario file: ${s.name}...`);
    try {
      const startTime = Date.now();
      const result = await uploadFile(s.name, filePath, testToken);
      const duration = Date.now() - startTime;
      
      console.log(`[Result for ${s.name}] (took ${duration}ms):`);
      console.log(`  Report ID: ${result.id}`);
      console.log(`  Overall Confidence: ${result.overallConfidence}%`);
      console.log(`  Status: "${result.status}"`);
      console.log(`  Linked Request ID: ${result.fields.request_number?.value || "None"}`);
      console.log(`  Devices Extracted: ${result.devices?.length || 0}`);
      
      if (result.devices && result.devices.length > 0) {
        result.devices.forEach((d: any) => {
          console.log(`    - Device Card ${d.device_index}: SN=${d.sn}, SIM=${d.sim_serial}, TID=${d.tid}`);
        });
      }

      // Assertions
      const deviceCountMatch = (result.devices?.length || 0) === s.expectedDevices;
      const statusMatch = result.status === s.expectedStatus;
      
      if (deviceCountMatch && statusMatch) {
        console.log(`  ✅ ASSERTION SUCCESS for ${s.name}`);
      } else {
        console.error(`  ❌ ASSERTION FAILURE for ${s.name}:`);
        console.error(`     Expected: devices=${s.expectedDevices}, status="${s.expectedStatus}"`);
        console.error(`     Received: devices=${result.devices?.length || 0}, status="${result.status}"`);
      }
    } catch (err) {
      console.error(`  ❌ Failed to execute scenario ${s.name}:`, err);
    }
  }

  // Clean up session
  console.log("\nCleaning up session token...");
  await db.execute(sql`DELETE FROM bearer_sessions WHERE token = ${testToken}`);
  console.log("Cleaned up.");

  console.log("\n--- VALIDATION RUN COMPLETE ---");
}

run().catch(console.error);
