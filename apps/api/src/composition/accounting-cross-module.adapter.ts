/**
 * ERP-005A-4 Phase 5 — composition-root wiring for accounting's read-only
 * cross-module ports. This is the one file allowed to know about both
 * accounting and identity/inventory's concrete internals; accounting module
 * code must not import modules/identity/** or modules/inventory/** directly.
 *
 * AccountingIdentityLookupPort (accounting -> identity): technician display
 * name + region, backed by identity's own IUserRepository (the same
 * @stockpro/contracts interface Phase 4's IdentityPortsAdapter uses — no
 * changes needed to it).
 *
 * AccountingCatalogLookupPort (accounting -> inventory): item-type Arabic
 * display name, backed by a new @stockpro/contracts interface
 * (IItemTypeCatalogRepository) implemented by inventory's ItemTypesService.
 */
import { identityRepositories } from "@modules/identity/infrastructure/database";
import { itemTypesContainer } from "./item-types.container";
import { AccountingIdentityPortAdapter } from "@modules/accounting/infrastructure/adapters/identity/AccountingIdentityPortAdapter";
import { registerAccountingIdentityLookupPort } from "@modules/accounting/infrastructure/adapters/identity/identity-lookup.registry";
import { AccountingInventoryPortAdapter } from "@modules/accounting/infrastructure/adapters/inventory/AccountingInventoryPortAdapter";
import { registerAccountingCatalogLookupPort } from "@modules/accounting/infrastructure/adapters/inventory/catalog-lookup.registry";

export const accountingIdentityLookupPort = new AccountingIdentityPortAdapter(identityRepositories.user);
registerAccountingIdentityLookupPort(accountingIdentityLookupPort);

export const accountingCatalogLookupPort = new AccountingInventoryPortAdapter(itemTypesContainer.itemTypesService);
registerAccountingCatalogLookupPort(accountingCatalogLookupPort);
