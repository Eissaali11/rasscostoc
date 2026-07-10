/**
 * CompletionGuard — Guard Orchestrator
 *
 * The single entry point for the Guard Validation Layer.
 * Runs all guards in the correct order before any DB write.
 *
 * Order:
 *   1. ExecutionGuard  — structural completeness
 *   2. TechnicianGuard — technician identity resolution
 *   3. CustodyGuard    — custody ownership + IN_TRANSIT_CUSTODY
 *
 * If any guard throws, the entire operation is rejected.
 * No execution data is written to the database on failure.
 *
 * Usage:
 *   const techUser = await CompletionGuard.run(ctx);
 *   // proceed to write execution...
 */

import { ExecutionGuard } from "./ExecutionGuard";
import { TechnicianGuard } from "./TechnicianGuard";
import { CustodyGuard } from "./CustodyGuard";
import type { GuardContext, TechUser } from "./guard.types";

export { GuardValidationError, isCompletedStatus } from "./guard.types";
export type { GuardContext, TechUser } from "./guard.types";

export class CompletionGuard {
  /**
   * Run all guards for an execution save operation.
   *
   * @returns Resolved TechUser if status is completed, null otherwise.
   * @throws GuardValidationError if any guard fails.
   */
  static async run(ctx: GuardContext): Promise<TechUser | null> {
    // 1. Structural validation (sync — no DB)
    ExecutionGuard.validate(ctx);

    // 2. Technician identity resolution (async — DB lookup)
    const techUser = await TechnicianGuard.resolve(ctx);

    // 3. Custody validation (async — DB lookup + audit log on failure)
    if (techUser) {
      await CustodyGuard.validate(ctx, techUser);
    }

    return techUser;
  }
}
