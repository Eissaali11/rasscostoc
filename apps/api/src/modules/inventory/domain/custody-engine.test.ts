import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CustodyEngine } from './custody-engine';
import { items, inventoryTransactions, itemHistoryLogs, custodyMovements } from "@shared/schema";

describe('CustodyEngine Unit Tests', () => {
  let mockTx: any;

  beforeEach(() => {
    mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
    };
  });

  describe('lookupItem', () => {
    it('returns item when found', async () => {
      const mockItem = { id: 'item-1', serialNumber: 'SN123' };
      mockTx.limit.mockResolvedValue([mockItem]);

      const result = await CustodyEngine.lookupItem('SN123', mockTx);
      expect(result).toEqual(mockItem);
    });

    it('returns null when not found', async () => {
      mockTx.limit.mockResolvedValue([]);

      const result = await CustodyEngine.lookupItem('SN123', mockTx);
      expect(result).toBeNull();
    });
  });

  describe('scanItem', () => {
    it('creates new item and registers custody when not exists', async () => {
      mockTx.limit.mockResolvedValueOnce([]); // lookupItem returning empty array
      mockTx.returning.mockResolvedValueOnce([{ id: 'new-item-uuid' }]); // insert returning new id

      const result = await CustodyEngine.scanItem('SN123', 'type-1', 'tech-1', mockTx);

      expect(result).toEqual({ id: 'new-item-uuid', action: 'inserted' });
      expect(mockTx.insert).toHaveBeenCalledWith(items);
      expect(mockTx.insert).toHaveBeenCalledWith(inventoryTransactions);
      expect(mockTx.insert).toHaveBeenCalledWith(custodyMovements);
    });

    it('throws error when item already exists and is active', async () => {
      const existingItem = { id: 'item-1', serialNumber: 'SN123', currentOwnerId: null, status: 'WAREHOUSE' };
      mockTx.limit.mockResolvedValueOnce([existingItem]);

      await expect(
        CustodyEngine.scanItem('SN123', 'type-1', 'tech-1', mockTx)
      ).rejects.toThrow('المنتج موجود مسبقاً وحالته نشط');
    });

    it('throws error when item already exists and is closed', async () => {
      const existingItem = { id: 'item-1', serialNumber: 'SN123', currentOwnerId: null, status: 'DELIVERED' };
      mockTx.limit.mockResolvedValueOnce([existingItem]);

      await expect(
        CustodyEngine.scanItem('SN123', 'type-1', 'tech-1', mockTx)
      ).rejects.toThrow('المنتج موجود وحالته مغلق');
    });
  });

  describe('deliverItem', () => {
    it('delivers item successfully and releases custody', async () => {
      const existingItem = { id: 'item-1', serialNumber: 'SN123', currentOwnerId: 'tech-1', status: 'RECEIVED_BY_TECHNICIAN' };
      mockTx.limit.mockResolvedValueOnce([existingItem]);

      const result = await CustodyEngine.deliverItem('item-1', 'ORD123', 'tech-1', 'admin-1', mockTx);

      expect(result).toEqual({ success: true });
      expect(mockTx.update).toHaveBeenCalledWith(items);
      expect(mockTx.insert).toHaveBeenCalledWith(inventoryTransactions);
      expect(mockTx.insert).toHaveBeenCalledWith(itemHistoryLogs);
      expect(mockTx.insert).toHaveBeenCalledWith(custodyMovements);
    });

    it('throws error if item not found', async () => {
      mockTx.limit.mockResolvedValueOnce([]);

      await expect(
        CustodyEngine.deliverItem('item-unknown', 'ORD123', 'tech-1', 'admin-1', mockTx)
      ).rejects.toThrow('الجهاز غير موجود بقواعد البيانات');
    });

    it('throws error if item currentOwnerId does not match technicianId', async () => {
      const existingItem = { id: 'item-1', serialNumber: 'SN123', currentOwnerId: 'tech-2', status: 'RECEIVED_BY_TECHNICIAN' };
      mockTx.limit.mockResolvedValueOnce([existingItem]);

      await expect(
        CustodyEngine.deliverItem('item-1', 'ORD123', 'tech-1', 'admin-1', mockTx)
      ).rejects.toThrow('الجهاز المطلوب تسليمه ليس في عهدة هذا الفني حالياً');
    });
  });

  describe('returnItem', () => {
    it('returns item to warehouse successfully and clears owner', async () => {
      const existingItem = { id: 'item-1', serialNumber: 'SN123', currentOwnerId: 'tech-1', status: 'RECEIVED_BY_TECHNICIAN' };
      mockTx.limit.mockResolvedValueOnce([existingItem]);

      const result = await CustodyEngine.returnItem('item-1', 'wh-1', 'tech-1', 'admin-1', mockTx);

      expect(result).toEqual({ success: true });
      expect(mockTx.update).toHaveBeenCalledWith(items);
      expect(mockTx.insert).toHaveBeenCalledWith(inventoryTransactions);
      expect(mockTx.insert).toHaveBeenCalledWith(itemHistoryLogs);
      expect(mockTx.insert).toHaveBeenCalledWith(custodyMovements);
    });
  });
});
