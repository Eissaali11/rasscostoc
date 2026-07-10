import type { InsertItemType, ItemType } from "@shared/schema";

export interface IItemTypesRepository {
  getById(id: string): Promise<ItemType | undefined>;
  getAll(): Promise<ItemType[]>;
  create(data: InsertItemType): Promise<ItemType>;
}
