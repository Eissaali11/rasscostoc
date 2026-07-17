import './inventory-identity.adapter';
import { repositories } from '@modules/inventory/infrastructure/database';
import { adminDashboardContainer } from './admin-dashboard.container';
import { bootstrapDefaultsContainer } from './bootstrap-defaults.container';
import { inventoryContainer } from './inventory.container';
import { inventoryEntriesContainer } from './inventory-entries.container';
import { inventoryEntriesMigrationContainer } from './inventory-entries-migration.container';
import { inventoryRequestsApprovalContainer } from './inventory-requests-approval.container';
import { inventoryRequestsCreateContainer } from './inventory-requests-create.container';
import { inventoryRequestsManagementContainer } from './inventory-requests-management.container';
import { stockFixedInventoryContainer } from './stock-fixed-inventory.container';
import { stockTransferContainer } from './stock-transfer.container';
import { supervisorAssignmentsContainer } from './supervisor-assignments.container';
import { supervisorUsersContainer } from './supervisor-users.container';
import { techniciansContainer } from './technicians.container';
import { createGetTechnicianMovingInventoryUseCase } from './technicians-moving-inventory.container';
import { createWithdrawTechnicianInventoryToWarehouseUseCase } from './technicians-withdraw.container';
import { transactionsContainer } from './transactions.container';
import { usersContainer } from './users.container';
import { warehousesContainer } from './warehouses.container';
import { representativeInventoryContainer } from './representative-inventory.container';
import { devicesContainer } from './devices.container';
import { regionsContainer } from './regions.container';
import { dashboardContainer } from './dashboard.container';
import { serializedItemsContainer } from './serialized-items.container';
import { itemTypesContainer } from './item-types.container';

export {
  adminDashboardContainer,
  bootstrapDefaultsContainer,
  inventoryContainer,
  inventoryEntriesContainer,
  inventoryEntriesMigrationContainer,
  inventoryRequestsApprovalContainer,
  inventoryRequestsCreateContainer,
  inventoryRequestsManagementContainer,
  stockFixedInventoryContainer,
  stockTransferContainer,
  supervisorAssignmentsContainer,
  supervisorUsersContainer,
  techniciansContainer,
  transactionsContainer,
  usersContainer,
  warehousesContainer,
  representativeInventoryContainer,
  devicesContainer,
  regionsContainer,
  dashboardContainer,
  serializedItemsContainer,
  itemTypesContainer,
  createGetTechnicianMovingInventoryUseCase,
  createWithdrawTechnicianInventoryToWarehouseUseCase,
};

export const compositionRoot = Object.freeze({
  repositories,
  containers: {
    adminDashboardContainer,
    bootstrapDefaultsContainer,
    inventoryContainer,
    inventoryEntriesContainer,
    inventoryEntriesMigrationContainer,
    inventoryRequestsApprovalContainer,
    inventoryRequestsCreateContainer,
    inventoryRequestsManagementContainer,
    stockFixedInventoryContainer,
    stockTransferContainer,
    supervisorAssignmentsContainer,
    supervisorUsersContainer,
    techniciansContainer,
    transactionsContainer,
    usersContainer,
    warehousesContainer,
    representativeInventoryContainer,
    devicesContainer,
    regionsContainer,
    dashboardContainer,
    serializedItemsContainer,
    itemTypesContainer,
  },
  factories: {
    createGetTechnicianMovingInventoryUseCase,
    createWithdrawTechnicianInventoryToWarehouseUseCase,
  },
});

export type AppCompositionRoot = typeof compositionRoot;

export const storage = compositionRoot;

export default compositionRoot;