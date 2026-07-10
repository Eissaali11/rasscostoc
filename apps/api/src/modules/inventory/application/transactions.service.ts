import { 
  type Transaction,
  type InsertTransaction,
  type TransactionWithDetails
} from "@shared/schema";
import type { ITransactionsRepository } from "./transactions/contracts/ITransactionsRepository";

/**
 * Transactions Management Service
 * Handles all inventory transaction operations
 */
export class TransactionsService {
  constructor(
    private readonly transactionsRepository: ITransactionsRepository
  ) {}

  /**
   * Create new transaction
   */
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    return this.transactionsRepository.createTransaction(insertTransaction);
  }

  /**
   * Get transactions with filters
   */
  async getTransactions(filters?: {
    userId?: string;
    itemId?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<TransactionWithDetails[]> {
    return this.transactionsRepository.getTransactions(filters);
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(limit: number = 10): Promise<TransactionWithDetails[]> {
    return this.getTransactions({ limit });
  }

  /**
   * Get transactions by user
   */
  async getTransactionsByUser(userId: string, limit?: number): Promise<TransactionWithDetails[]> {
    return this.getTransactions({ userId, limit });
  }

  /**
   * Get transactions by item
   */
  async getTransactionsByItem(itemId: string, limit?: number): Promise<TransactionWithDetails[]> {
    return this.getTransactions({ itemId, limit });
  }

  /**
   * Get transactions by type
   */
  async getTransactionsByType(type: string, limit?: number): Promise<TransactionWithDetails[]> {
    return this.getTransactions({ type, limit });
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStatistics(startDate?: Date, endDate?: Date) {
    return this.transactionsRepository.getTransactionStatistics(startDate, endDate);
  }

  /**
   * Get daily transaction summary
   */
  async getDailyTransactionSummary(startDate: Date, endDate: Date) {
    return this.transactionsRepository.getDailyTransactionSummary(startDate, endDate);
  }

  /**
   * Get most active users by transactions
   */
  async getMostActiveUsers(limit: number = 10, startDate?: Date, endDate?: Date) {
    return this.transactionsRepository.getMostActiveUsers(limit, startDate, endDate);
  }

  /**
   * Get most transacted items
   */
  async getMostTransactedItems(limit: number = 10, startDate?: Date, endDate?: Date) {
    return this.transactionsRepository.getMostTransactedItems(limit, startDate, endDate);
  }

  /**
   * Record inventory adjustment transaction
   */
  async recordInventoryAdjustment(
    itemId: string,
    userId: string,
    quantityAdjustment: number,
    reason: string
  ): Promise<Transaction> {
    return this.createTransaction({
      type: 'adjustment',
      itemId,
      userId,
      quantity: quantityAdjustment,
      reason
    });
  }

  /**
   * Record inventory inbound transaction
   */
  async recordInventoryInbound(
    itemId: string,
    userId: string,
    quantity: number,
    notes?: string
  ): Promise<Transaction> {
    return this.createTransaction({
      type: 'inbound',
      itemId,
      userId,
      quantity,
      reason: notes
    });
  }

  /**
   * Record inventory outbound transaction
   */
  async recordInventoryOutbound(
    itemId: string,
    userId: string,
    quantity: number,
    notes?: string
  ): Promise<Transaction> {
    return this.createTransaction({
      type: 'outbound',
      itemId,
      userId,
      quantity,
      reason: notes
    });
  }

  /**
   * Record inventory transfer transaction
   */
  async recordInventoryTransfer(
    itemId: string,
    userId: string,
    quantity: number,
    fromLocation: string,
    toLocation: string
  ): Promise<Transaction> {
    return this.createTransaction({
      type: 'transfer',
      itemId,
      userId,
      quantity,
      reason: `Transfer from ${fromLocation} to ${toLocation}`
    });
  }

  /**
   * Get transaction trends
   */
  async getTransactionTrends(days: number = 30) {
    return this.transactionsRepository.getTransactionTrends(days);
  }

  /**
   * Get transactions with pagination
   */
  async getTransactionsWithPagination(
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      userId?: string;
      itemId?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    return this.transactionsRepository.getTransactionsWithPagination(page, pageSize, filters);
  }
}