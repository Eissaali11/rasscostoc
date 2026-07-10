import { db } from "../apps/api/src/core/config/db";
import { warehouses } from "../packages/shared-types/schema";

async function main() {
  console.log("Listing all warehouses in database...");
  const list = await db.select().from(warehouses);
  console.log("Warehouses count:", list.length);
  for (const wh of list) {
    console.log(`- ID: ${wh.id}, Name: ${wh.name}, Location: ${wh.location}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
