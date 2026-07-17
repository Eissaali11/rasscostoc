/**
 * ERP-005A-4 Phase 4 — late-binding registry for inventory's identity ports.
 *
 * Several inventory repositories (DrizzleRegionRepository, DrizzleDevicesRepository,
 * DrizzleTransactionsRepository, etc.) are instantiated as eager module-level
 * singletons in infrastructure/database/index.ts, before the composition root
 * runs. They cannot receive the identity port via constructor injection without
 * either (a) inventory importing composition/** directly (forbidden — see
 * ERP-005A-4 Phase 1) or (b) composition importing this file to populate the
 * slot once at startup, which is what this registry exists for.
 *
 * apps/api/src/composition/inventory-identity.adapter.ts calls
 * registerInventoryIdentityPorts(...) once, at composition-root init time,
 * before any HTTP request can reach a repository method.
 */
import type { IdentityUserReadPort } from "../../../application/ports/IdentityUserReadPort";
import type { TechnicianEligibilityPort } from "../../../application/ports/TechnicianEligibilityPort";
import type { IdentityStatsPort } from "../../../application/ports/IdentityStatsPort";
import type { IdentityUserRestorePort } from "../../../application/ports/IdentityUserRestorePort";
import type { SupervisorTechnicianDisplayPort } from "../../../application/ports/SupervisorTechnicianDisplayPort";

export interface InventoryIdentityPorts
  extends
    IdentityUserReadPort,
    TechnicianEligibilityPort,
    IdentityStatsPort,
    IdentityUserRestorePort,
    SupervisorTechnicianDisplayPort {}

let ports: InventoryIdentityPorts | null = null;

export function registerInventoryIdentityPorts(impl: InventoryIdentityPorts): void {
  ports = impl;
}

export function getInventoryIdentityPorts(): InventoryIdentityPorts {
  if (!ports) {
    throw new Error(
      "Inventory identity ports not registered yet — composition root must call " +
      "registerInventoryIdentityPorts() at startup before any inventory code that " +
      "reads/writes user data runs."
    );
  }
  return ports;
}
