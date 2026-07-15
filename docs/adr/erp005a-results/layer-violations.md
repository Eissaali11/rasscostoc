# ERP-005A — Layer Boundary Violations Report

This report documents the exact violations where layer boundaries (Domain, Application, Presentation) are breached by importing concrete outer-layer abstractions or infrastructure details.

---

## 🔴 1. Domain Layer Violations (Critical)
*The Domain Layer must be pure and should not import from outer layers or direct database query builders like drizzle-orm.*

1. **File**: `apps/api/src/modules/inventory/domain/custody-engine.ts`
   * **Target**: `node_modules/drizzle-orm/index.js`
   * **Violation**: Domain importing `drizzle-orm` directly.
   * **Business Risk**: Ties core custody business rule algorithms directly to the database technology, making it impossible to run unit tests without database mock libraries.
   
2. **File**: `apps/api/src/modules/courier/domain/repositories/courier.repository.interface.ts`
   * **Target**: `apps/api/src/modules/courier/application/courier.service.ts`
   * **Violation**: Domain layer depending on Application layer (`courier.service.ts`).
   * **Business Risk**: Circular dependency. Repositories should implement domain-defined ports, not rely on the application orchestrator.

---

## 🟡 2. Application Layer Violations (High)
*Application use cases must remain independent of delivery, data access details, or query builder implementations.*

1. **File**: `apps/api/src/modules/courier/application/inventory/inventory.engine.ts`
   * **Target**: `node_modules/drizzle-orm/index.js`
   * **Violation**: Direct drizzle-orm query builder logic inside application services.
   
2. **File**: `apps/api/src/modules/courier/application/inventory/inventory.engine.ts`
   * **Target**: `apps/api/src/modules/courier/infrastructure/adapters/SerializedItemsAdapter.ts`
   * **Violation**: Direct import of infrastructure adapters inside application layer.

3. **File**: `apps/api/src/modules/courier/application/inventory/inventory.engine.ts`
   * **Target**: `apps/api/src/modules/courier/infrastructure/adapters/DevicesServiceAdapter.ts`
   * **Violation**: Application depending on concrete device service adapters.

4. **File**: `apps/api/src/modules/courier/application/guards/TechnicianGuard.ts`
   * **Target**: `node_modules/drizzle-orm/index.js`
   * **Violation**: Authorization guard depending on query builder.

5. **File**: `apps/api/src/modules/courier/application/guards/CustodyGuard.ts`
   * **Target**: `node_modules/drizzle-orm/index.js`
   * **Violation**: Guard logic querying database directly using Drizzle.

6. **File**: `apps/api/src/modules/courier/application/courier.service.ts`
   * **Target**: `node_modules/drizzle-orm/index.js`
   * **Violation**: Service level orchestrator executing inline Drizzle SQL query structures.

7. **File**: `apps/api/src/modules/courier/application/courier.service.ts`
   * **Target**: `apps/api/src/modules/courier/infrastructure/repositories/drizzle-courier.repository.ts`
   * **Violation**: Application service importing concrete `DrizzleCourierRepository` instead of the domain interface.
