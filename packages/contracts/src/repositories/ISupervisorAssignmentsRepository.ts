import type { SupervisorTechnician, SupervisorWarehouse } from "@shared/schema";

/**
 * ERP-005A-4 Phase 5C — narrowed from UserSafe (the full identity row) to
 * just the id, the only field any real consumer has ever read from
 * getSupervisorTechnicians. See docs/architecture/PHASE-5C-REPORT-AR.md.
 */
export interface SupervisorTechnicianReference {
  id: string;
}

export interface ISupervisorAssignmentsRepository {
  getSupervisorTechnicians(supervisorId: string): Promise<SupervisorTechnicianReference[]>;
  assignTechnicianToSupervisor(supervisorId: string, technicianId: string): Promise<SupervisorTechnician>;
  removeTechnicianFromSupervisor(supervisorId: string, technicianId: string): Promise<boolean>;
  getSupervisorWarehouses(supervisorId: string): Promise<SupervisorWarehouse[]>;
  assignWarehouseToSupervisor(supervisorId: string, warehouseId: string): Promise<SupervisorWarehouse>;
  removeWarehouseFromSupervisor(supervisorId: string, warehouseId: string): Promise<boolean>;
}
