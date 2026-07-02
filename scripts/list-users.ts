import { db } from "../server/src/core/config/db";
import { users } from "../shared/schema";

async function main() {
  const allUsers = await db.select().from(users);
  console.log("Registered Users:");
  allUsers.forEach((u) => {
    console.log(`- Username: ${u.username}, Role: ${u.role}, Full Name: ${u.fullName}`);
  });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
