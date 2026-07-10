import { bootstrapDefaultsContainer } from "@server/composition/bootstrap-defaults.container";
import { logger } from "@server/utils/logger";
import { hashPassword } from "@server/utils/password";

/**
 * Initialize default data on startup (moved out of routes index to keep file small)
 */
export async function initializeDefaults() {
  try {
    const result = await bootstrapDefaultsContainer.bootstrapDefaultsUseCase.execute(hashPassword);

    if (result.createdUsers) {
      logger.info("No users found. Creating default data...", { source: "init" });

      if (result.createdRegion) {
        logger.info("Created default region", { source: "init" });
      }

      logger.info("Created default users: admin, tech1, supervisor1", {
        source: "init",
      });
    }

    logger.info("Item types initialized", { source: "init" });
  } catch (error) {
    logger.error("Error initializing defaults", error, { source: "init" });
    console.error("Initialization error details:", error);
  }
}
