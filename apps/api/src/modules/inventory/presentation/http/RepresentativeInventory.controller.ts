import type { Request, Response } from "express";
import { SyncRepresentativeInventoryUseCase } from '../../application/inventory/use-cases/SyncRepresentativeInventory.use-case';
import { CreateRepresentativeSaleUseCase } from '../../application/inventory/use-cases/CreateRepresentativeSale.use-case';
import {
  FinancialMismatchError,
  IdempotencyCollisionError,
  InsufficientStockError,
  InvalidProductTaxConfigurationError,
  ProductNotFoundError,
  ValidationError,
} from '../../../../core/errors/AppError';

export class RepresentativeInventoryController {
  constructor(
    private readonly syncUseCase: SyncRepresentativeInventoryUseCase,
    private readonly createSaleUseCase: CreateRepresentativeSaleUseCase
  ) {}

  syncInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const technicianId = req.params.technicianId || (req.user as any)?.id;
      if (!technicianId) {
        res.status(400).json({ error: "Technician ID is required" });
        return;
      }

      const result = await this.syncUseCase.execute({ technicianId });
      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  createSale = async (req: Request, res: Response): Promise<void> => {
    try {
      const idempotencyKey = req.headers['x-idempotency-key'] as string;
      if (!idempotencyKey) {
        res.status(400).json({ error: "x-idempotency-key header is required" });
        return;
      }

      const technicianId = (req.user as any)?.id || req.body.representativeId || req.body.technicianId;
      if (!technicianId) {
        res.status(400).json({ error: "Representative/Technician ID is required" });
        return;
      }

      const { orderNo, amountBeforeTax, taxAmount, totalAmount, items } = req.body;

      if (!orderNo || amountBeforeTax === undefined || taxAmount === undefined || totalAmount === undefined || !items) {
        res.status(400).json({ error: "Missing required sales order fields" });
        return;
      }

      const result = await this.createSaleUseCase.execute({
        representativeId: technicianId,
        orderNo,
        amountBeforeTax: Number(amountBeforeTax),
        taxAmount: Number(taxAmount),
        totalAmount: Number(totalAmount),
        idempotencyKey,
        // DB-R10C.2: unitPrice/lineTaxAmount are comparison-only (never
        // persisted as truth — see RepresentativeSaleFinancials.ts).
        // Preserved as `undefined` rather than `Number(undefined)` (NaN)
        // when the client omits them, so the use-case's optional-field
        // comparison correctly treats "absent" as "nothing to compare",
        // not as an invalid numeric value.
        items: items.map((item: any) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: item.unitPrice === undefined ? undefined : Number(item.unitPrice),
          lineTaxAmount: item.lineTaxAmount === undefined ? undefined : Number(item.lineTaxAmount),
        })),
      });

      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private handleError(error: any, res: Response): void {
    if (error instanceof IdempotencyCollisionError) {
      res.status(409).json({ error: error.message });
    } else if (error instanceof InsufficientStockError) {
      res.status(422).json({ error: error.message });
    } else if (error instanceof ProductNotFoundError) {
      res.status(404).json({ error: error.message });
    } else if (error instanceof FinancialMismatchError) {
      // DB-R10C.2: client-submitted financial value disagreed with the
      // server-derived authoritative value — 409, matching this
      // repository's existing convention for "your view of state is
      // stale/wrong" (same status as IdempotencyCollisionError).
      res.status(409).json({ error: error.message, field: error.field, expected: error.expected, received: error.received });
    } else if (error instanceof InvalidProductTaxConfigurationError) {
      // DB-R10C.2: stored product tax-rate data is invalid/ambiguous —
      // a server-side data problem, not a client input error.
      res.status(error.statusCode).json({ error: error.message, code: error.code });
    } else if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      const message = error instanceof Error ? error.message : "Internal Server Error";
      res.status(500).json({ error: message });
    }
  }
}
