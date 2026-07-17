/**
 * ERP-005A-4 Phase 4B — late-binding registry for identity's reverse
 * dependency on inventory-owned technician-stock data.
 *
 * Mirrors apps/api/src/modules/inventory/infrastructure/adapters/identity/identity-ports.registry.ts
 * from Phase 4: DrizzleAdminDashboardRepository.ts and
 * DrizzleSupervisorUsersReadRepository.ts are eager module-level singletons
 * (instantiated in infrastructure/database/index.ts before the composition
 * root runs), so they cannot receive the port via constructor injection
 * without identity importing modules/inventory/** directly (forbidden —
 * see ERP-005A-4 Phase 1/4B rules). composition/inventory-identity.adapter.ts
 * calls registerInventoryTechnicianDataPort(...) once at startup.
 */
import type { InventoryTechnicianDataPort } from "../../application/ports/InventoryTechnicianDataPort";

let port: InventoryTechnicianDataPort | null = null;

export function registerInventoryTechnicianDataPort(impl: InventoryTechnicianDataPort): void {
  port = impl;
}

export function getInventoryTechnicianDataPort(): InventoryTechnicianDataPort {
  if (!port) {
    throw new Error(
      "Inventory technician data port not registered yet — composition root must call " +
      "registerInventoryTechnicianDataPort() at startup before any identity code that " +
      "reads inventory technician-stock data runs."
    );
  }
  return port;
}
