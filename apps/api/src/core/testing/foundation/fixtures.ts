/**
 * PHASE B1.1 — Backend Test Foundation: shared fixture factories.
 *
 * Plain-object factories only (no DB writes here — that's B1.2's job via
 * seedMinimalReferenceData()). Each factory returns sane, valid-shape
 * defaults and accepts an `overrides` partial so a test only states the
 * field it actually cares about, per standard test-data-builder practice.
 * IDs are randomUUID() by default (deterministic clock/UUID injection for
 * tests that need reproducibility is provided by fake-clock.ts).
 */
import { randomUUID } from "crypto";

type Overrides<T> = Partial<T>;

export interface UserFixture {
  id: string;
  username: string;
  role: "technician" | "supervisor" | "admin";
  regionId: string | null;
  employeeCode: string | null;
}

export function createUserFixture(overrides: Overrides<UserFixture> = {}): UserFixture {
  return {
    id: randomUUID(),
    username: `test.user.${Date.now()}`,
    role: "technician",
    regionId: null,
    employeeCode: null,
    ...overrides,
  };
}

export function createTechnicianFixture(overrides: Overrides<UserFixture> = {}): UserFixture {
  return createUserFixture({ role: "technician", ...overrides });
}

export interface WarehouseFixture {
  id: string;
  name: string;
  regionId: string | null;
  createdBy: string;
}

export function createWarehouseFixture(overrides: Overrides<WarehouseFixture> = {}): WarehouseFixture {
  return {
    id: randomUUID(),
    name: `Test Warehouse ${Date.now()}`,
    regionId: null,
    createdBy: randomUUID(),
    ...overrides,
  };
}

export interface ItemFixture {
  id: string;
  serialNumber: string;
  barcode: string;
  itemTypeId: string;
  status: "AVAILABLE" | "IN_TRANSIT_CUSTODY" | "ASSIGNED";
  currentOwnerId: string | null;
}

export function createItemFixture(overrides: Overrides<ItemFixture> = {}): ItemFixture {
  const suffix = randomUUID().slice(0, 8);
  return {
    id: randomUUID(),
    serialNumber: `SN-TEST-${suffix}`,
    barcode: `BC-TEST-${suffix}`,
    itemTypeId: randomUUID(),
    status: "AVAILABLE",
    currentOwnerId: null,
    ...overrides,
  };
}

export interface CourierRequestFixture {
  id: number;
  tid: string;
  incidentNumber: string;
  mobile: string;
  city: string;
  createdBy: string;
}

export function createCourierRequestFixture(
  overrides: Overrides<CourierRequestFixture> = {}
): CourierRequestFixture {
  return {
    id: Math.floor(Math.random() * 1_000_000),
    tid: `TID-${Date.now()}`,
    incidentNumber: `INC-${Date.now()}`,
    mobile: "0500000000",
    city: "Riyadh",
    createdBy: randomUUID(),
    ...overrides,
  };
}

export interface AccountingFixture {
  id: string;
  accountCode: string;
  accountName: string;
  createdBy: string;
}

export function createAccountingFixture(overrides: Overrides<AccountingFixture> = {}): AccountingFixture {
  return {
    id: randomUUID(),
    accountCode: `TEST-${Math.floor(Math.random() * 10000)}`,
    accountName: "Test Chart of Accounts Entry",
    createdBy: randomUUID(),
    ...overrides,
  };
}
