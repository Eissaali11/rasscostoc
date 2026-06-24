import { TechnicianService } from "@modules/inventory/application/technician.service";
import type { InsertTechnicianFixedInventory } from "@shared/schema";

const technicianService = new TechnicianService();

export async function getTechnicianFixedInventory(technicianId: string) {
  return technicianService.getTechnicianFixedInventory(technicianId);
}

export async function createTechnicianFixedInventory(inventory: InsertTechnicianFixedInventory) {
  return technicianService.createTechnicianFixedInventory(inventory);
}

export async function updateTechnicianFixedInventory(technicianId: string, updates: Partial<InsertTechnicianFixedInventory>) {
  return technicianService.updateTechnicianFixedInventory(technicianId, updates);
}

export async function deleteTechnicianFixedInventory(technicianId: string) {
  return technicianService.deleteTechnicianFixedInventory(technicianId);
}
