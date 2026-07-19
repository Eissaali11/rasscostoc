/**
 * ERP-005A-4 Phases 4 & 4B — composition-root wiring for the identity<->inventory
 * data-ownership ports. This is the one file allowed to know about both
 * modules' concrete internals; neither module imports the other directly.
 *
 * Phase 4 (inventory -> identity): IdentityUserReadPort, TechnicianEligibilityPort,
 * IdentityStatsPort, IdentityUserRestorePort, backed by identity's own
 * IUserRepository. Inventory module code must not import the users table.
 *
 * Phase 4B (identity -> inventory): InventoryTechnicianDataPort, backed by
 * inventory's own InventoryTechnicianDataService. Identity module code must
 * not import technician_fixed_inventories/technician_fixed_inventory_entries/
 * technician_moving_inventory_entries/technicians_inventory/inventory_requests.
 */
import { identityRepositories } from "@modules/identity/infrastructure/database";
import { IdentityPortsAdapter } from "@modules/inventory/infrastructure/adapters/identity/IdentityPortsAdapter";
import { registerInventoryIdentityPorts } from "@modules/inventory/infrastructure/adapters/identity/identity-ports.registry";
import { inventoryTechnicianDataService } from "@modules/inventory/infrastructure/services/inventory-technician-data.service";
import { registerInventoryTechnicianDataPort } from "@modules/identity/infrastructure/adapters/inventory-ports.registry";

export const inventoryIdentityPorts = new IdentityPortsAdapter(identityRepositories.user);

registerInventoryIdentityPorts(inventoryIdentityPorts);

registerInventoryTechnicianDataPort(inventoryTechnicianDataService);
