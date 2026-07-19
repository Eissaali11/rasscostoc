import type { IItemTypeCatalogRepository } from "@stockpro/contracts";
import type { AccountingCatalogLookupPort } from "../../../application/ports/AccountingCatalogLookupPort";

/**
 * ERP-005A-4 Phase 5 — backs AccountingCatalogLookupPort with inventory's
 * IItemTypeCatalogRepository (a new neutral, published contract in
 * @stockpro/contracts, backed by inventory's ItemTypesService.getItemTypesByIds).
 * Wired in the composition root only.
 */
export class AccountingInventoryPortAdapter implements AccountingCatalogLookupPort {
  constructor(private readonly itemTypeCatalogRepository: IItemTypeCatalogRepository) {}

  async getItemTypeNamesByIds(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (ids.length === 0) return new Map();
    const uniqueIds = [...new Set(ids)];
    const itemTypes = await this.itemTypeCatalogRepository.getItemTypesByIds(uniqueIds);
    return new Map(itemTypes.map((it) => [it.id, it.nameAr]));
  }
}
