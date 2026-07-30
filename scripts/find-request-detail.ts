import { db } from "../apps/api/src/core/config/db";
import { courierRequests, courierExecutions } from "@shared/schema";
import { eq, or, sql } from "drizzle-orm";

async function run() {
  const target = "15810780";
  console.log(`Checking DB for ${target}...`);

  const reqs = await db
    .select()
    .from(courierRequests)
    .where(
      or(
        eq(courierRequests.tid, target),
        eq(courierRequests.terminalId, target),
        eq(courierRequests.incidentNumber, target)
      )
    );

  console.log("Found requests:", JSON.stringify(reqs, null, 2));

  for (const r of reqs) {
    const execs = await db
      .select()
      .from(courierExecutions)
      .where(eq(courierExecutions.requestId, r.id));
    console.log(`Executions for request ${r.id}:`, JSON.stringify(execs, null, 2));
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
