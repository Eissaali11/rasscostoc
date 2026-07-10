import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WarehouseService } from './warehouse.service';
import type { IWarehouseRepository } from './warehouse/contracts/IWarehouseRepository';

describe('WarehouseService', () => {
  let service: WarehouseService;
  let mockRepository: IWarehouseRepository;

  beforeEach(() => {
    mockRepository = {
      getWarehouses: vi.fn(),
      getWarehouse: vi.fn(),
      createWarehouse: vi.fn(),
      updateWarehouse: vi.fn(),
      deleteWarehouse: vi.fn(),
      getWarehouseInventory: vi.fn(),
      updateWarehouseInventory: vi.fn(),
      getWarehouseInventoryEntries: vi.fn(),
      upsertWarehouseInventoryEntry: vi.fn(),
      getWarehouseTransfers: vi.fn(),
      createWarehouseTransfer: vi.fn(),
      updateWarehouseTransferStatus: vi.fn(),
      rejectWarehouseTransfer: vi.fn(),
      getWarehousesByRegion: vi.fn(),
      getActiveWarehouses: vi.fn(),
      searchWarehouses: vi.fn(),
    };
    service = new WarehouseService(mockRepository);
  });

  it('should delegate getWarehouses to repository', async () => {
    const mockWarehouses = [{ id: 'w-1', name: 'Warehouse 1' }] as any[];
    vi.mocked(mockRepository.getWarehouses).mockResolvedValue(mockWarehouses);

    const result = await service.getWarehouses();
    expect(mockRepository.getWarehouses).toHaveBeenCalled();
    expect(result).toBe(mockWarehouses);
  });

  it('should delegate getWarehouse to repository', async () => {
    const mockWarehouse = { id: 'w-1', name: 'Warehouse 1' } as any;
    vi.mocked(mockRepository.getWarehouse).mockResolvedValue(mockWarehouse);

    const result = await service.getWarehouse('w-1');
    expect(mockRepository.getWarehouse).toHaveBeenCalledWith('w-1');
    expect(result).toBe(mockWarehouse);
  });

  it('should delegate createWarehouse to repository', async () => {
    const insertWarehouse = { name: 'New Warehouse', location: 'Riyadh' } as any;
    const mockWarehouse = { id: 'w-1', ...insertWarehouse } as any;
    vi.mocked(mockRepository.createWarehouse).mockResolvedValue(mockWarehouse);

    const result = await service.createWarehouse(insertWarehouse, 'user-1');
    expect(mockRepository.createWarehouse).toHaveBeenCalledWith(insertWarehouse, 'user-1');
    expect(result).toBe(mockWarehouse);
  });

  it('should delegate acceptWarehouseTransfer to updateWarehouseTransferStatus', async () => {
    const mockTransfer = { id: 't-1', status: 'accepted' } as any;
    vi.mocked(mockRepository.updateWarehouseTransferStatus).mockResolvedValue(mockTransfer);

    const result = await service.acceptWarehouseTransfer('t-1');
    expect(mockRepository.updateWarehouseTransferStatus).toHaveBeenCalledWith('t-1', 'accepted');
    expect(result).toBe(mockTransfer);
  });
});
