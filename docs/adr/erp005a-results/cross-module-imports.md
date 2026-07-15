# ERP-005A — Cross-Module Internal Imports Report

This document registers all occurrences where a business module directly imports private files or internals from another module without using public API gateways or shared types.

---

## 🔀 Detected Violations

1. **File**: `apps/api/src/modules/inventory/infrastructure/subscribers/inventory.subscriber.ts`
   * **Target**: `apps/api/src/modules/courier/application/inventory/inventory.engine.ts`
   * **Violation**: Inventory module subscriber directly importing a courier internal engine (`inventory.engine.ts`).
   * **Business Risk**: Direct coupling of Inventory to Courier. A change in the Courier engine's signature breaks the Inventory compile-time check.

2. **File**: `apps/api/src/modules/courier/infrastructure/adapters/SerializedItemsAdapter.ts`
   * **Target**: `apps/api/src/modules/inventory/infrastructure/services/serialized-items.service.ts`
   * **Violation**: Courier adapter importing directly from Inventory infrastructure service.
   * **Business Risk**: Tightly couples Courier workflows to how Inventory tracks items. Modifying Inventory internals breaks Courier compilation.

3. **File**: `apps/api/src/modules/courier/application/workflow/courier.workflow.test.ts`
   * **Target**: `apps/api/src/modules/inventory/infrastructure/subscribers/inventory.subscriber.ts`
   * **Violation**: Courier test file importing Inventory's private subscriber class.
   * **Business Risk**: High coupling of test suites.

4. **File**: `apps/api/src/modules/courier/application/ai-engine/courier-pdf-extraction.adapter.ts`
   * **Target**: `apps/api/src/modules/ai-engine-settings/ai-engine-settings.store.ts`
   * **Violation**: Courier PDF extractor depending on internal settings stores of the AI settings engine.
   * **Business Risk**: Ties Courier domain details directly to AI settings details.
