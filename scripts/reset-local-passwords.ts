import { db } from "../apps/api/src/core/config/db";
import { users } from "../packages/shared-types/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

async function main() {
  console.log("🔐 Generating bcrypt hashes...");
  const adminHash = await bcrypt.hash("admin123", 10);
  const supervisorHash = await bcrypt.hash("super123", 10);
  const techHash = await bcrypt.hash("tech123", 10);

  console.log("🔄 Resetting local passwords in bulk...");

  // Update all admins
  const adminsResult = await db
    .update(users)
    .set({ password: adminHash })
    .where(eq(users.role, "admin"))
    .returning({ username: users.username });

  console.log(`✅ Updated ${adminsResult.length} admin accounts to password 'admin123'`);

  // Update all supervisors
  const supervisorsResult = await db
    .update(users)
    .set({ password: supervisorHash })
    .where(eq(users.role, "supervisor"))
    .returning({ username: users.username });

  console.log(`✅ Updated ${supervisorsResult.length} supervisor accounts to password 'super123'`);

  // Update all technicians
  const techsResult = await db
    .update(users)
    .set({ password: techHash })
    .where(eq(users.role, "technician"))
    .returning({ username: users.username });

  console.log(`✅ Updated ${techsResult.length} technician accounts to password 'tech123'`);

  // Also ensure default 'admin' exists if it doesn't already
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.username, "admin"));

  if (existingAdmin.length === 0) {
    console.log("➕ Creating default 'admin' user...");
    // Get default region to associate
    const regions = await db.query.regions.findMany();
    const defaultRegionId = regions[0]?.id;

    await db.insert(users).values({
      username: "admin",
      email: "admin@company.com",
      password: adminHash,
      fullName: "System Administrator",
      city: "Riyadh",
      role: "admin",
      regionId: defaultRegionId,
      isActive: true,
    });
    console.log("✅ Created 'admin' user with password 'admin123'");
  }

  console.log("\n🚀 All passwords reset successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error resetting passwords:", err);
  process.exit(1);
});
