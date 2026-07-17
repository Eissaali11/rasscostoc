/**
 * ERP-005A-4 Phase 4 — composition-root wiring for inventory's identity ports
 * (IdentityUserReadPort, TechnicianEligibilityPort, IdentityStatsPort,
 * IdentityUserRestorePort), backed by identity's own IUserRepository.
 *
 * Inventory module code must not import the users table from @shared/schema.
 */
import { identityRepositories } from "@modules/identity/infrastructure/database";
import { IdentityPortsAdapter } from "@modules/inventory/infrastructure/adapters/identity/IdentityPortsAdapter";
import { registerInventoryIdentityPorts } from "@modules/inventory/infrastructure/adapters/identity/identity-ports.registry";

export const inventoryIdentityPorts = new IdentityPortsAdapter(identityRepositories.user);

registerInventoryIdentityPorts(inventoryIdentityPorts);
