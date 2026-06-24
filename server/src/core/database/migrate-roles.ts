import { db } from "@core/config/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function migrateRoles() {
  try {
    console.log("Starting role migration...");
    
    const result = await db
      .update(users)
      .set({ role: "technician" })
      .where(eq(users.role, "employee"));
    
    console.log("✅ Role migration completed successfully!");
    console.log("All 'employee' roles have been converted to 'technician'");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during migration:", error);
    process.exit(1);
  }
}

migrateRoles();
