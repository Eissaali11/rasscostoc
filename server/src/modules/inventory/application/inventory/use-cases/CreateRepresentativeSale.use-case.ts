import type { IInventoryV2UnitOfWork } from '../contracts/IInventoryV2UnitOfWork';
import type { SalesOrder } from '../../../../../../../shared/schema';
import {
  IdempotencyCollisionError,
  InsufficientStockError,
  ProductNotFoundError,
} from '../../../../../core/errors/AppError';

export type CreateRepresentativeSaleItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTaxAmount: number;
};

export type CreateRepresentativeSaleInput = {
  representativeId: string;
  orderNo: string;
  amountBeforeTax: number;
  taxAmount: number;
  totalAmount: number;
  idempotencyKey: string;
  items: CreateRepresentativeSaleItemInput[];
};

export type CreateRepresentativeSaleOutput = {
  order: SalesOrder;
};

export class CreateRepresentativeSaleUseCase {
  constructor(private readonly unitOfWork: IInventoryV2UnitOfWork) {}

  async execute(input: CreateRepresentativeSaleInput): Promise<CreateRepresentativeSaleOutput> {
    return this.unitOfWork.execute(async (context) => {
      // 1. Check idempotency key first to prevent duplication
      const existingOrder = await context.salesOrderRepository.findByIdempotencyKey(input.idempotencyKey);
      if (existingOrder) {
        // Return existing order to make the request idempotent
        return { order: existingOrder };
      }

      // 2. Validate products and lock stock rows using FOR UPDATE
      for (const item of input.items) {
        const product = await context.productRepository.findById(item.productId);
        if (!product) {
          throw new ProductNotFoundError(`Product with ID ${item.productId} was not found`);
        }

        const currentStock = await context.technicianProductStockRepository.lockAndGetBalance(
          input.representativeId,
          item.productId
        );

        if (currentStock < item.quantity) {
          throw new InsufficientStockError(
            `Insufficient stock for product ${product.nameEn} (${product.productCode}). Custody: ${currentStock}, Requested: ${item.quantity}`
          );
        }
      }

      // 3. Deduct stock balances
      for (const item of input.items) {
        const currentStock = await context.technicianProductStockRepository.getBalance(
          input.representativeId,
          item.productId
        );
        const nextStock = currentStock - item.quantity;
        await context.technicianProductStockRepository.setBalance(
          input.representativeId,
          item.productId,
          nextStock
        );
      }

      // 4. Record sales order and order items in DB
      const order = await context.salesOrderRepository.create(
        {
          representativeId: input.representativeId,
          orderNo: input.orderNo,
          amountBeforeTax: input.amountBeforeTax,
          taxAmount: input.taxAmount,
          totalAmount: input.totalAmount,
          idempotencyKey: input.idempotencyKey,
        },
        input.items
      );

      return { order };
    });
  }
}
