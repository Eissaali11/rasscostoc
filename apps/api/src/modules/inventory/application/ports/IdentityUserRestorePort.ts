/**
 * ERP-005A-4 Phase 4 — Type D (write) consumer-owned port.
 *
 * Narrow, single-purpose contract for ImportSystemBackup.use-case.ts's
 * user-restore step. This is the only write path from inventory into
 * identity-owned data, and it exists solely to support restoring a full
 * system backup snapshot (export side never touches users at all).
 *
 * The caller is responsible for normalizing the payload (hashing the
 * password, defaulting the role, coercing types) before calling this port —
 * identity only owns the id/username/email collision resolution and the
 * actual write.
 */
export interface RestoreUserPayload {
  sourceId: string;
  username: string;
  email?: string | null;
  password: string;
  fullName?: string | null;
  profileImage?: string | null;
  city?: string | null;
  role: "admin" | "supervisor" | "technician";
  regionId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdentityUserRestorePort {
  /**
   * @param tx optional transaction executor so this write can participate in
   * the caller's larger multi-table restore transaction (same physical
   * database — this is a modular-monolith boundary, not a distributed one).
   */
  restoreUser(payload: RestoreUserPayload, tx?: unknown): Promise<{ id: string }>;

  /**
   * Full-fidelity export of every user row (including the password hash) for
   * ExportSystemBackup.use-case.ts. A backup must round-trip through
   * restoreUser() above exactly, so this intentionally returns everything —
   * unlike every other port in this file, which returns narrow display/
   * decision-only views.
   */
  getAllUsersForBackup(): Promise<ReadonlyArray<{
    id: string;
    username: string;
    email: string;
    password: string;
    fullName: string;
    profileImage: string | null;
    city: string | null;
    role: string;
    regionId: string | null;
    isActive: boolean;
    createdAt: Date | null;
    updatedAt: Date | null;
  }>>;
}
