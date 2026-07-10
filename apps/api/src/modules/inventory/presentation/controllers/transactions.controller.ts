/**
 * Transactions controller
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { z } from "zod";
import { transactionsContainer } from "@server/composition/transactions.container";

const transactionFiltersSchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val) : undefined)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val) : undefined)),
  type: z.string().optional(),
  userId: z.string().optional(),
  regionId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  recent: z.string().optional(),
});

const transactionStatisticsSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  regionId: z.string().optional(),
});

export class TransactionsController {
  /**
   * GET /api/transactions
   * Get transactions with filters
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const query = transactionFiltersSchema.parse(req.query);

    const result = await transactionsContainer.getTransactionsUseCase.execute({
      page: query.page,
      limit: query.limit,
      type: query.type,
      userId: query.userId,
      regionId: query.regionId,
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
      recent: query.recent,
    });

    res.json(result);
  });

  /**
   * GET /api/transactions/statistics
   * Get transaction statistics
   */
  getStatistics = asyncHandler(async (req: Request, res: Response) => {
    const query = transactionStatisticsSchema.parse(req.query);

    const statistics = await transactionsContainer.getTransactionStatisticsUseCase.execute({
      startDate: query.startDate,
      endDate: query.endDate,
      regionId: query.regionId,
    });

    res.json(statistics);
  });
}

export const transactionsController = new TransactionsController();
