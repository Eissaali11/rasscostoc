import type { IInventoryV2UnitOfWork } from '../contracts/IInventoryV2UnitOfWork';
import type { Product, SalesOrder } from '@shared/schema';
import {
  IdempotencyCollisionError,
  InsufficientStockError,
  ProductNotFoundError,
} from '../../../../../core/errors/AppError';
import {
  assertClientFinancialsMatchServerDerived,
  deriveRepresentativeSaleFinancials,
} from '../services/RepresentativeSaleFinancials';

/**
 * DB-R10C.2: `unitPrice`, `amountBeforeTax`, `taxAmount`, and
 * `totalAmount` remain in the input shape ONLY because the current API
 * contract (RepresentativeInventory.controller.ts) still requires the
 * header fields to be present in the request body (DB-R10C.2 §10 chose
 * temporary compatibility over a broader contract change). They are
 * NEVER treated as the source of truth — see RepresentativeSaleFinancials.ts.
 * The server derives its own values from `product.defaultPrice` /
 * `product.defaultTaxRate` and rejects the request outright
 * (FinancialMismatchError) if these client-submitted values disagree.
 */
export type CreateRepresentativeSaleItemInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;
  lineTaxAmount?: number;
};

export type CreateRepresentativeSaleInput = {
  representativeId: string;
  orderNo: string;
  amountBeforeTax?: number;
  taxAmount?: number;
  totalAmount?: number;
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

      // 2. Validate products and lock stock rows using FOR UPDATE.
      // The authoritative Product record fetched here (never the
      // client's copy) is what DB-R10C.2's financial derivation reads
      // price/tax from in step 3 — kept aligned with input.items by index.
      const products: Product[] = [];
      for (const item of input.items) {
        const product = await context.productRepository.findById(item.productId);
        if (!product) {
          throw new ProductNotFoundError(`Product with ID ${item.productId} was not found`);
        }
        products.push(product);

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

      // 3. DB-R10C.2: derive authoritative financial values from
      // product data + validated quantity — never from client input —
      // then reject the request outright if the client's (still
      // API-contract-required) financial fields disagree.
      const serverFinancials = deriveRepresentativeSaleFinancials(
        input.items.map((item, i) => ({
          productId: item.productId,
          quantity: item.quantity,
          product: {
            id: products[i].id,
            defaultPrice: products[i].defaultPrice,
            defaultTaxRate: products[i].defaultTaxRate,
          },
        }))
      );
      assertClientFinancialsMatchServerDerived(
        {
          amountBeforeTax: input.amountBeforeTax,
          taxAmount: input.taxAmount,
          totalAmount: input.totalAmount,
          items: input.items.map((item) => ({
            productId: item.productId,
            unitPrice: item.unitPrice,
            lineTaxAmount: item.lineTaxAmount,
          })),
        },
        serverFinancials
      );

      // 4. Deduct stock balances
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

      // 5. Record sales order and order items in DB — persisting ONLY
      // server-derived financial values (serverFinancials), never
      // input.amountBeforeTax/taxAmount/totalAmount or
      // input.items[].unitPrice/lineTaxAmount.
      const order = await context.salesOrderRepository.create(
        {
          representativeId: input.representativeId,
          orderNo: input.orderNo,
          amountBeforeTax: serverFinancials.amountBeforeTax,
          taxAmount: serverFinancials.taxAmount,
          totalAmount: serverFinancials.totalAmount,
          idempotencyKey: input.idempotencyKey,
        },
        serverFinancials.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTaxAmount: line.lineTaxAmount,
        }))
      );

      return { order };
    });
  }
}
