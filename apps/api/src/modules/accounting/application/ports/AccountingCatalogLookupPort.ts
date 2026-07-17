/**
 * ERP-005A-4 Phase 5 — consumer-owned port for accounting's read-only
 * dependency on inventory-owned `item_types` data (Arabic display name,
 * used for invoice/bill line display and item-performance reports).
 */
export interface AccountingCatalogLookupPort {
  /**
   * Batch lookup — always use this instead of one call per item type.
   */
  getItemTypeNamesByIds(ids: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
