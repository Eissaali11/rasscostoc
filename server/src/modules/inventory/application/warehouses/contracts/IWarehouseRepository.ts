import type { WarehouseWithStats } from "@shared/schema";

export interface IWarehouseRepository {
  getWarehouses(): Promise<WarehouseWithStats[]>;
}
