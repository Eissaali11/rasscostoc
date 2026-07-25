import 'dotenv/config';
import { db } from "../apps/api/src/core/config/db";
import { warehouseTransfers, users } from "@shared/schema";
import { desc } from "drizzle-orm";

async function main() {
  console.log("=== Checking Users in DB ===");
  const allUsers = await db.select({ id: users.id, username: users.username, name: users.name, role: users.role }).from(users);
  console.log("Users count:", allUsers.length);
  console.log(allUsers);

  console.log("\n=== Checking Recent Warehouse Transfers in DB ===");
  const transfers = await db.select().from(warehouseTransfers).orderBy(desc(warehouseTransfers.createdAt)).limit(10);
  console.log("Recent Transfers count:", transfers.length);
  console.log(JSON.stringify(transfers, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
