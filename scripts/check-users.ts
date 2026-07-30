import 'dotenv/config';
import { db, pool } from "../apps/api/src/core/config/db";
import { users } from "../packages/shared-types/schemas/organization.schema";

async function main() {
  const allUsers = await db.select({
    id: users.id,
    fullName: users.fullName,
    email: users.email,
    profileImage: users.profileImage,
  }).from(users).limit(20);
  console.log("USERS IN DB:", JSON.stringify(allUsers, null, 2));
  await pool.end();
}

main();
