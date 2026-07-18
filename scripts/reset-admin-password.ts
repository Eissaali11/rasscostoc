/**
 * Reset / create a single admin password — ERP-008 P1.1 (no default password).
 *
 * Required:
 *   ADMIN_PASSWORD  (min 12 chars, not a known default like admin123)
 *
 * Optional:
 *   ADMIN_USERNAME (default: admin)
 *   ADMIN_EMAIL
 *   ADMIN_FULL_NAME
 *   ADMIN_CITY
 *
 * Run: npx tsx scripts/reset-admin-password.ts
 */

import "dotenv/config";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../server/utils/password";
import { assertSafeBootstrapPassword } from "../apps/api/src/core/bootstrap/use-cases/BootstrapDefaults.use-case";

async function resetAdminPassword() {
  try {
    console.log("Resetting admin password (secure bootstrap rules)...\n");

    const username = process.env.ADMIN_USERNAME ?? "admin";
    const newPassword = assertSafeBootstrapPassword(
      process.env.ADMIN_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD,
    );
    const email = process.env.ADMIN_EMAIL ?? `${username}@company.com`;
    const fullName = process.env.ADMIN_FULL_NAME ?? "System Administrator";
    const city = process.env.ADMIN_CITY ?? "Riyadh";

    const hashedPassword = await hashPassword(newPassword);

    const result = await db
      .update(users)
      .set({
        password: hashedPassword,
        role: "admin",
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.username, username))
      .returning({ id: users.id, username: users.username });

    if (result.length > 0) {
      console.log("Password reset successful.");
      console.log(`  User: ${result[0].username}`);
      console.log("  Password: (set from ADMIN_PASSWORD env — not printed)");
    } else {
      console.log("Admin user not found. Creating new admin user...");

      const [newUser] = await db
        .insert(users)
        .values({
          username,
          email,
          password: hashedPassword,
          fullName,
          city,
          role: "admin",
          isActive: true,
        })
        .returning({ id: users.id, username: users.username });

      console.log("Admin user created.");
      console.log(`  Username: ${newUser.username}`);
      console.log("  Password: (set from ADMIN_PASSWORD env — not printed)");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

resetAdminPassword();
