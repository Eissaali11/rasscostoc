/**
 * ERP-008 P1.1 — This script previously mass-reset accounts to admin123/tech123/super123.
 * That path is permanently disabled.
 *
 * Use instead:
 *   BOOTSTRAP_ADMIN_PASSWORD=... npx tsx scripts/bootstrap-first-admin.ts
 *   ADMIN_PASSWORD=... npx tsx scripts/reset-admin-password.ts
 */
console.error(
  "ERP-008: scripts/reset-local-passwords.ts is disabled. " +
    "Default credential mass-reset (admin123/tech123/super123) is forbidden. " +
    "Use scripts/bootstrap-first-admin.ts or scripts/reset-admin-password.ts with an explicit strong password env var.",
);
process.exit(2);
