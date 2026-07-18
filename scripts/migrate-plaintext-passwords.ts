/**
 * ERP-008-P1.3 — One-time migration: hash any non-bcrypt passwords in users.password.
 *
 * Dry-run (default):
 *   npx tsx scripts/migrate-plaintext-passwords.ts
 *
 * Apply:
 *   npx tsx scripts/migrate-plaintext-passwords.ts --apply
 *
 * WARNING: If a row already stores plaintext (e.g. "admin123"), this hashes that
 * exact string so login continues with the same known password until rotated.
 * Prefer rotating weak passwords after migration.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../apps/api/src/core/config/db";
import { users } from "../packages/shared-types/schema";
import { hashPassword, isBcryptHash } from "../apps/api/src/utils/password";

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await db
    .select({ id: users.id, username: users.username, password: users.password })
    .from(users);

  const legacy = rows.filter((row) => !isBcryptHash(row.password));

  console.log(`Users scanned: ${rows.length}`);
  console.log(`Legacy (non-bcrypt) passwords: ${legacy.length}`);

  if (legacy.length === 0) {
    console.log("Nothing to migrate.");
    process.exit(0);
  }

  for (const row of legacy) {
    console.log(` - ${row.username} (${row.id})`);
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to hash legacy passwords.");
    process.exit(0);
  }

  for (const row of legacy) {
    const hashed = await hashPassword(row.password);
    await db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, row.id));
    console.log(`Hashed password for ${row.username}`);
  }

  console.log("Migration complete. Rotate any known-weak passwords immediately.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
