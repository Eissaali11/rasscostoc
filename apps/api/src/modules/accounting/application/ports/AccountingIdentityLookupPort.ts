/**
 * ERP-005A-4 Phase 5 — consumer-owned port for accounting's read-only
 * dependency on identity-owned `users` data (technician display name and
 * region, used for invoice-line display, technician performance reports,
 * region filters, and the technician-sales-metrics region snapshot).
 */
export interface AccountingTechnicianView {
  id: string;
  fullName: string;
  regionId: string | null;
}

export interface AccountingIdentityLookupPort {
  /**
   * Batch lookup — always use this instead of one call per technician.
   */
  getTechniciansByIds(ids: readonly string[]): Promise<ReadonlyMap<string, AccountingTechnicianView>>;

  /**
   * Technician ids belonging to a region — used to replace a `WHERE
   * u.region_id = $n` filter that previously required a live JOIN against
   * `users`.
   */
  getTechnicianIdsInRegion(regionId: string): Promise<ReadonlySet<string>>;
}
