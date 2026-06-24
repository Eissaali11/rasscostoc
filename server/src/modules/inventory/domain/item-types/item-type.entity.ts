export type ItemTypeCategory = "devices" | "papers" | "sim" | "accessories";

export type ItemTypeIdentity = {
  id?: string;
};

export type ItemTypeNaming = {
  nameAr: string;
  nameEn: string;
};

export type ItemTypeValidationPayload = ItemTypeIdentity &
  ItemTypeNaming & {
    unitsPerBox: number;
  };

export class ItemTypeDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemTypeDomainError";
  }
}

export class InvalidItemTypeError extends ItemTypeDomainError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidItemTypeError";
  }
}

export class DuplicateItemTypeNameError extends ItemTypeDomainError {
  constructor(public readonly field: "nameAr" | "nameEn", message: string) {
    super(message);
    this.name = "DuplicateItemTypeNameError";
  }
}

export class ItemTypeIdAlreadyExistsError extends ItemTypeDomainError {
  constructor(message: string) {
    super(message);
    this.name = "ItemTypeIdAlreadyExistsError";
  }
}

export function normalizeItemTypeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function sanitizeItemTypeNames<T extends ItemTypeNaming>(payload: T): T {
  return {
    ...payload,
    nameAr: payload.nameAr.trim(),
    nameEn: payload.nameEn.trim(),
  };
}

export function assertValidItemType(payload: ItemTypeValidationPayload): void {
  const normalized = sanitizeItemTypeNames(payload);

  if (!normalized.nameAr) {
    throw new InvalidItemTypeError("Item type Arabic name is required");
  }

  if (!normalized.nameEn) {
    throw new InvalidItemTypeError("Item type English name is required");
  }

  if (!Number.isInteger(normalized.unitsPerBox) || normalized.unitsPerBox <= 0) {
    throw new InvalidItemTypeError("unitsPerBox must be a positive integer");
  }
}

export function assertUniqueItemTypeNames(
  existingItems: Array<ItemTypeIdentity & ItemTypeNaming>,
  candidate: ItemTypeIdentity & ItemTypeNaming,
  options?: { excludeId?: string }
): void {
  const normalizedCandidate = sanitizeItemTypeNames(candidate);
  const normalizedCandidateAr = normalizeItemTypeName(normalizedCandidate.nameAr);
  const normalizedCandidateEn = normalizeItemTypeName(normalizedCandidate.nameEn);

  const duplicateAr = existingItems.find((item) => {
    if (options?.excludeId && item.id === options.excludeId) {
      return false;
    }

    return normalizeItemTypeName(item.nameAr) === normalizedCandidateAr;
  });

  if (duplicateAr) {
    throw new DuplicateItemTypeNameError("nameAr", "Item type Arabic name already exists");
  }

  const duplicateEn = existingItems.find((item) => {
    if (options?.excludeId && item.id === options.excludeId) {
      return false;
    }

    return normalizeItemTypeName(item.nameEn) === normalizedCandidateEn;
  });

  if (duplicateEn) {
    throw new DuplicateItemTypeNameError("nameEn", "Item type English name already exists");
  }
}
