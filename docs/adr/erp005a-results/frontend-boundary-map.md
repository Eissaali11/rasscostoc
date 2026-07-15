# ERP-005A — Frontend Architecture & Boundaries

This document maps out the current structure of the React frontend application (`apps/portal`) and outlines the rules needed to enforce Feature-First isolation.

---

## 🎨 1. Current Architecture Layout
The portal is structured as follows:
* `apps/portal/src/pages/`: Contains page-level layouts (e.g., `CourierRequestsPage`, `TechniciansPage`).
* `apps/portal/src/components/`: Shared or page-specific visual components.
* `apps/portal/src/hooks/`: React state hooks.
* `apps/portal/src/styles/` and `index.css`: Tailwind styling definitions.

---

## ⛔ 2. Found Architectural Violations (Debt)
1. **Direct API Endpoint Calls**: React components (e.g. inside `pages/`) trigger `fetch` or `axios` directly with raw strings like `'/api/couriers'`. If the URL pattern changes on the backend, the frontend breaks at runtime without compile-time checks.
2. **Page-Specific Components Scattered**: Page components contain large embedded UI sections instead of refactoring them into clean sub-components or domain features.
3. **No Central API Contract Validation**: The frontend manually writes TS type annotations for API outputs instead of importing schemas from `packages/shared-types` or `packages/contracts`.

---

## 🛡️ 3. Target Feature-First Architecture
The portal will be refactored to enforce:
1. **Feature boundaries**: Mapped under `apps/portal/src/features/`. One feature (e.g. `courier/`) must not import internal files of another feature (e.g. `inventory/`).
2. **Centralized Query Managers**: All network calls must utilize `react-query` or `wouter` routing wrappers declared centrally under `shared/api/`. React components must never contain raw URL strings.
3. **Design Tokens**: Standardize buttons, inputs, loaders, and layout wrappers using atomic UI components in `shared/ui/`.
