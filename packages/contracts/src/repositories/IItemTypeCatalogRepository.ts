import type { ItemType } from "@shared/schema";

export interface IItemTypeCatalogRepository {
  getItemTypesByIds(ids: readonly string[]): Promise<ItemType[]>;
}
