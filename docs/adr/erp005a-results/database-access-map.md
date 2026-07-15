# ERP-005A — Database Access Map & Violations

This report details where query builders, database transactions, or drizzle configurations are illegally accessed outside infrastructure data-access classes.

---

## 🛢️ Database Access Leakages

1. **File**: `apps/api/src/modules/inventory/presentation/routes/warehouse-transfer-operations.routes.ts`
   * **Target**: `node_modules/drizzle-orm/index.js`
   * **Violation**: Direct drizzle-orm import inside route registration.
   * **Business Risk**: Mixes HTTP request/response routing logic with database schema query syntax.

2. **File**: `apps/api/src/modules/inventory/presentation/routes/warehouse-transfer-operations.routes.ts`
   * **Target**: `apps/api/src/modules/inventory/infrastructure/database/DrizzleInventoryUnitOfWork.ts`
   * **Violation**: Controller directly importing database transaction class `DrizzleInventoryUnitOfWork`.
   * **Business Risk**: Presentation layer manages business transactions and DB session life cycles.

3. **File**: `apps/api/src/modules/inventory/presentation/routes/serialized-items.routes.ts`
   * **Target**: `node_modules/drizzle-orm/index.js`
   * **Violation**: Query builder imported inside route handlers.

4. **File**: `apps/api/src/modules/courier/application/optimistic-locking.test.ts`
   * **Target**: `node_modules/drizzle-orm/index.js`
   * **Violation**: Query builder logic utilized inside application test file.
