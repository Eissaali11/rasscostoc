export class InvalidStockQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStockQuantityError';
  }
}

export class InsufficientStockError extends Error {
  constructor(available: number, requested: number) {
    super(`Insufficient stock. Available: ${available}, Requested: ${requested}`);
    this.name = 'InsufficientStockError';
  }
}

export class InventoryItemAggregate {
  private constructor(private readonly currentQuantity: number) {}

  static fromCurrentQuantity(quantity: number): InventoryItemAggregate {
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new InvalidStockQuantityError('Current stock quantity is invalid');
    }

    return new InventoryItemAggregate(quantity);
  }

  add(quantity: number): number {
    this.assertPositiveQuantity(quantity);
    return this.currentQuantity + quantity;
  }

  withdraw(quantity: number): number {
    this.assertPositiveQuantity(quantity);

    if (this.currentQuantity < quantity) {
      throw new InsufficientStockError(this.currentQuantity, quantity);
    }

    return this.currentQuantity - quantity;
  }

  private assertPositiveQuantity(quantity: number): void {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new InvalidStockQuantityError('Quantity must be a positive number');
    }
  }
}
