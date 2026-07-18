/**
 * ERP-008 P1.1 — Explicit first-admin bootstrap (no default credentials).
 *
 * Usage:
 *   set BOOTSTRAP_ADMIN_PASSWORD=YourStrongPass!   # PowerShell: $env:BOOTSTRAP_ADMIN_PASSWORD='...'
 *   npx tsx scripts/bootstrap-first-admin.ts
 *
 * Optional env:
 *   BOOTSTRAP_ADMIN_USERNAME
 *   BOOTSTRAP_ADMIN_EMAIL
 *   BOOTSTRAP_ADMIN_FULL_NAME
 */
import { initializeDefaults } from "../apps/api/src/modules/inventory/presentation/routes/bootstrap";
import { BootstrapAdminRequiredError } from "../apps/api/src/core/bootstrap/use-cases/BootstrapDefaults.use-case";

async function main() {
  try {
    await initializeDefaults();
    console.log("Bootstrap defaults check finished.");
    process.exit(0);
  } catch (error) {
    if (error instanceof BootstrapAdminRequiredError) {
      console.error(error.message);
      process.exit(2);
    }
    console.error("Bootstrap failed:", error);
    process.exit(1);
  }
}

void main();
