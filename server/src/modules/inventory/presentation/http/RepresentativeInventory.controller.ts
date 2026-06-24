import type { Request, Response } from "express";
import { SyncRepresentativeInventoryUseCase } from '../../application/inventory/use-cases/SyncRepresentativeInventory.use-case';
import { CreateRepresentativeSaleUseCase } from '../../application/inventory/use-cases/CreateRepresentativeSale.use-case';
import {
  IdempotencyCollisionError,
  InsufficientStockError,
  ProductNotFoundError,
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
        items: items.map((item: any) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          lineTaxAmount: Number(item.lineTaxAmount),
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
    } else {
      const message = error instanceof Error ? error.message : "Internal Server Error";
      res.status(500).json({ error: message });
    }
  }
}
