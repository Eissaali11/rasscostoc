import type { InsertItemType, ItemType } from "@shared/schema";
import type { IItemTypesRepository } from "../contracts/IItemTypesRepository";
import {
  assertUniqueItemTypeNames,
  assertValidItemType,
  ItemTypeIdAlreadyExistsError,
  sanitizeItemTypeNames,
} from "../../../domain/item-types/item-type.entity";

export class CreateItemTypeUseCase {
  constructor(private readonly repository: IItemTypesRepository) {}

  async execute(input: InsertItemType): Promise<ItemType> {
    const normalizedInput: InsertItemType = sanitizeItemTypeNames(input);

    assertValidItemType({
      id: normalizedInput.id,
      nameAr: normalizedInput.nameAr,
      nameEn: normalizedInput.nameEn,
      unitsPerBox: normalizedInput.unitsPerBox,
    });

    if (normalizedInput.id) {
      const existingById = await this.repository.getById(normalizedInput.id);
      if (existingById) {
        throw new ItemTypeIdAlreadyExistsError("Item type ID already exists");
      }
    }

    const existingTypes = await this.repository.getAll();
    assertUniqueItemTypeNames(existingTypes, {
      id: normalizedInput.id,
      nameAr: normalizedInput.nameAr,
      nameEn: normalizedInput.nameEn,
    });

    return this.repository.create(normalizedInput);
  }
}
