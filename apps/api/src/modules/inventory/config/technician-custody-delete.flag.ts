/**
 * TEMPORARY FEATURE — remove or disable after final customer handover.
 *
 * Controls whether a technician may permanently delete a serialized item
 * (device/SIM) from their own active custody via
 * DELETE /api/serialized-items/my-custody/:serialNumber.
 *
 * Disabling requires no migration and no database access — set the
 * environment variable to anything other than "true" (or unset it) and
 * restart the API process. Default is disabled (fail closed).
 */
export function isTechnicianCustodyDeleteEnabled(): boolean {
  return process.env.ENABLE_TECHNICIAN_CUSTODY_DELETE === "true";
}
