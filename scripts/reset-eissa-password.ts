import { db } from "../apps/api/src/core/config/db";
import { users } from "../packages/shared-types/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  const hashedPassword = await bcrypt.hash("tech123", 10);
  await db.update(users).set({ password: hashedPassword }).where(eq(users.username, "eissa"));
  console.log("Password for eissa reset successfully to tech123");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
