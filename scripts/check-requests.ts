import { db } from "../apps/api/src/core/config/db";
import { courierRequests } from "@shared/schema";

async function run() {
  console.log("Fetching requests from DB using select...");
  const reqs = await db.select().from(courierRequests).limit(10);
  console.log("Requests found:", JSON.stringify(reqs, null, 2));
}

run().catch(console.error);
