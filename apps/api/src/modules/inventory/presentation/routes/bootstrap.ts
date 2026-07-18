import { bootstrapDefaultsContainer } from "@server/composition/bootstrap-defaults.container";
import { BootstrapAdminRequiredError } from "@core/bootstrap/use-cases/BootstrapDefaults.use-case";
import { logger } from "@server/utils/logger";
import { hashPassword } from "@server/utils/password";

/**
 * Initialize default data on startup (moved out of routes index to keep file small)
 * ERP-008 P1.1: never creates admin/admin123; empty DB requires BOOTSTRAP_ADMIN_PASSWORD.
 */
export async function initializeDefaults() {
  try {
    const result = await bootstrapDefaultsContainer.bootstrapDefaultsUseCase.execute(hashPassword);

    if (result.createdUsers) {
      logger.info("Empty users table — created first admin via secure bootstrap env", {
        source: "init",
      });

      if (result.createdRegion) {
        logger.info("Created default region", { source: "init" });
      }
    }

    logger.info("Bootstrap defaults check complete", { source: "init" });
  } catch (error) {
    if (error instanceof BootstrapAdminRequiredError) {
      logger.error(error.message, error, { source: "init", code: error.code });
      throw error;
    }
    logger.error("Error initializing defaults", error, { source: "init" });
    console.error("Initialization error details:", error);
    throw error;
  }
}
