/**
 * ERP-005A-4 Phase 5 — late-binding registry for accounting's catalog
 * (item-type) lookup port. See identity-lookup.registry.ts for why this
 * pattern is required (accountingService is an eager singleton).
 */
import type { AccountingCatalogLookupPort } from "../../../application/ports/AccountingCatalogLookupPort";

let port: AccountingCatalogLookupPort | null = null;

export function registerAccountingCatalogLookupPort(impl: AccountingCatalogLookupPort): void {
  port = impl;
}

export function getAccountingCatalogLookupPort(): AccountingCatalogLookupPort {
  if (!port) {
    throw new Error(
      "Accounting catalog lookup port not registered yet — composition root must call " +
      "registerAccountingCatalogLookupPort() at startup before any accounting code that " +
      "reads item-type data runs."
    );
  }
  return port;
}
