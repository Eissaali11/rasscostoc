import { describe, expect, it } from "vitest";
import type { InsertItemType, ItemType } from "@shared/schema";
import type { IItemTypesRepository } from "../contracts/IItemTypesRepository";
import { CreateItemTypeUseCase } from "./CreateItemType.use-case";
import {
  DuplicateItemTypeNameError,
  InvalidItemTypeError,
  ItemTypeIdAlreadyExistsError,
} from "../../../domain/item-types/item-type.entity";

class InMemoryItemTypesRepository implements IItemTypesRepository {
  private items: ItemType[];

  constructor(initialItems: ItemType[] = []) {
    this.items = [...initialItems];
  }

  async getById(id: string): Promise<ItemType | undefined> {
    return this.items.find((item) => item.id === id);
  }

  async getAll(): Promise<ItemType[]> {
    return [...this.items];
  }

  async create(data: InsertItemType): Promise<ItemType> {
    const created: ItemType = {
      id: data.id ?? "generated-id",
      nameAr: data.nameAr,
      nameEn: data.nameEn,
      category: data.category,
      unitsPerBox: data.unitsPerBox,
      isActive: data.isActive ?? true,
      isVisible: data.isVisible ?? true,
      sortOrder: data.sortOrder ?? 0,
      icon: data.icon ?? null,
      color: data.color ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.items.push(created);
    return created;
  }
}

function makeItemType(overrides: Partial<ItemType> = {}): ItemType {
  return {
    id: "item-1",
    nameAr: "صنف",
    nameEn: "Type",
    category: "devices",
    unitsPerBox: 10,
    isActive: true,
    isVisible: true,
    sortOrder: 0,
    icon: null,
    color: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<InsertItemType> = {}): InsertItemType {
  return {
    id: "new-id",
    nameAr: "  صنف جديد  ",
    nameEn: "  New Type  ",
    category: "devices",
    unitsPerBox: 10,
    isActive: true,
    isVisible: true,
    sortOrder: 0,
    icon: undefined,
    color: undefined,
    ...overrides,
  };
}

describe("CreateItemTypeUseCase", () => {
  it("creates item type successfully with normalized names", async () => {
    const repository = new InMemoryItemTypesRepository();
    const useCase = new CreateItemTypeUseCase(repository);

    const result = await useCase.execute(makeCreateInput());

    expect(result.nameAr).toBe("صنف جديد");
    expect(result.nameEn).toBe("New Type");
  });

  it("throws when duplicate Arabic name exists", async () => {
    const repository = new InMemoryItemTypesRepository([
      makeItemType({ id: "existing-1", nameAr: "  الصنف  ", nameEn: "Unique EN" }),
    ]);
    const useCase = new CreateItemTypeUseCase(repository);

    await expect(
      useCase.execute(makeCreateInput({ id: "new-2", nameAr: "الصنف", nameEn: "Another EN" }))
    ).rejects.toThrowError(DuplicateItemTypeNameError);
  });

  it("throws when duplicate English name exists", async () => {
    const repository = new InMemoryItemTypesRepository([
      makeItemType({ id: "existing-1", nameAr: "Unique AR", nameEn: "  existing-en  " }),
    ]);
    const useCase = new CreateItemTypeUseCase(repository);

    await expect(
      useCase.execute(makeCreateInput({ id: "new-2", nameAr: "Another AR", nameEn: "EXISTING-EN" }))
    ).rejects.toThrowError(DuplicateItemTypeNameError);
  });

  it("throws when provided id already exists", async () => {
    const repository = new InMemoryItemTypesRepository([
      makeItemType({ id: "same-id" }),
    ]);
    const useCase = new CreateItemTypeUseCase(repository);

    await expect(
      useCase.execute(makeCreateInput({ id: "same-id" }))
    ).rejects.toThrowError(ItemTypeIdAlreadyExistsError);
  });

  it("throws validation error for invalid unitsPerBox", async () => {
    const repository = new InMemoryItemTypesRepository();
    const useCase = new CreateItemTypeUseCase(repository);

    await expect(
      useCase.execute(makeCreateInput({ unitsPerBox: 0 }))
    ).rejects.toThrowError(InvalidItemTypeError);
  });
});
