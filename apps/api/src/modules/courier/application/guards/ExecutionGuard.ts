/**
 * ExecutionGuard
 *
 * Validates that the execution data submitted is structurally complete
 * before any DB write or workflow decision is made.
 *
 * Responsibility: data completeness only — not custody or ownership.
 */

import {
  GuardValidationError,
  isCompletedStatus,
  normalizeSerialList,
  type GuardContext,
} from "./guard.types";

export class ExecutionGuard {
  /**
   * Validate execution input for structural completeness.
   * Throws GuardValidationError if any required field is missing.
   * Incomplete / non-completed statuses do NOT require serials.
   */
  static validate(ctx: GuardContext): void {
    const { executionData } = ctx;

    // If marking as completed, at least one device SN is mandatory
    if (isCompletedStatus(executionData.installationStatus)) {
      const devices = normalizeSerialList(executionData.deviceSerials, executionData.sn);
      if (devices.length === 0) {
        throw new GuardValidationError(
          "الرقم التسلسلي للجهاز (SN) مطلوب عند تعيين الحالة كمكتمل.",
          "sn"
        );
      }
    }

    // Installation status must be a non-empty string if provided
    if (
      executionData.installationStatus !== undefined &&
      executionData.installationStatus !== null &&
      String(executionData.installationStatus).trim() === ""
    ) {
      throw new GuardValidationError(
        "حالة التركيب لا يمكن أن تكون فارغة.",
        "installationStatus"
      );
    }
  }
}
