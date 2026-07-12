# AGENTS.md

## Cursor Cloud specific instructions

StockPro / nulip-inventory is an Arabic (RTL) inventory management system. It is a
monorepo (npm workspaces + Turborepo) but ships as **one runtime process**: the
Express API (`apps/api`) also serves the React/Vite portal (`apps/portal`). Internal
`packages/*` are libraries, not separate services.

### Running the app (dev)
- One service only: `npm run dev` → Express API + Vite portal (HMR) on **port 3001**
  (`apps/api/src/server.ts`, launched via `tsx`). `tsx` here does **not** hot-reload on
  file changes — **restart** `npm run dev` after editing backend code. Use
  `npm run dev:clean` to free port 3001 first if needed.
- Standard scripts live in `package.json` (`build`, `start`, `check`, `test:unit`,
  `db:migrate`, `lint:architecture`, `smoke:api`). Note README's `npm run db:push`
  does **not** exist — use `npm run db:migrate`.

### PostgreSQL
- Postgres is required and is **not** auto-started on VM boot. Start it with:
  `sudo pg_ctlcluster 16 main start`.
- Local dev DB/role used in this environment: db `nulip_inventory`, user `nulip_user`
  (see `.env`). Migrations auto-run on server startup and via `npm run db:migrate`.

### Environment variables (`.env`, gitignored)
Required: `DATABASE_URL`, `SESSION_SECRET`, `JWT_SECRET`, `PORT`, `NODE_ENV`.
- **Gotcha:** `JWT_SECRET` is required by the server (`core/config/jwt.config.ts`, imported
  via auth middleware) **and** by the full test suite (`api-versioning.test.ts`), but it is
  **missing from `env.example.txt`**. Without it the server and one test suite throw on startup.

### Seeding required for the app to function
- Startup bootstrap (`BootstrapDefaultsUseCase`) only creates default **users + region**
  when the `users` table is empty — it does **not** seed item types (the "Item types
  initialized" log is misleading).
- **Item types must be seeded** for serial scanning / device recognition to work:
  `npx tsx scripts/seed-default-item-types.ts` (idempotent). Serial rules (prefix, length,
  regex per type) live in the `item_types` table and drive `SerialRecognitionService`.
- Default users (only seeded when `users` is empty): `admin`/`admin123`,
  `tech1`/`tech123`, `supervisor1`/`super123`.

### Testing gotchas
- `npm run test:unit` (Vitest) runs against the **real** `DATABASE_URL` database; some
  tests write rows (e.g. `locking_test_user`). That non-empty `users` table then prevents
  the empty-DB bootstrap from creating the default `admin`/`tech1`/`supervisor1` users. If
  you need a fresh bootstrap, `TRUNCATE users CASCADE;` and restart `npm run dev`.
- Mutating API requests are CSRF-protected: include header
  `X-Requested-With: XMLHttpRequest` (or `X-CSRF-Token`). `POST /api/auth/login` is exempt.

### Known pre-existing issues (not caused by feature work — do not "fix" incidentally)
- The `pre-commit` hook runs `npm run lint:architecture && npm run test:unit`.
  `lint:architecture` currently reports **20 pre-existing dependency-cruiser violations on
  `main`**, so a normal `git commit` is blocked; use `git commit --no-verify` for unrelated
  changes (or fix the violations if that is the task).
- `npm run check` (`tsc`) has a pre-existing type error in
  `DrizzleAdminDashboardRepository.ts` (`totalLebaraSim` missing) unrelated to app runtime.

### Serial recognition cycle
- `SerialRecognitionService` (`apps/api/.../infrastructure/services/serial-recognition.service.ts`)
  is the single source of truth for normalizing a raw scan, auto-detecting the item type from
  its prefix, extracting the clean stored serial, and (for reads) `resolveSerialCandidates()`.
  Intake stores the **normalized** serial (e.g. `NCD100253066` → `100253066`); all read/scan-out
  paths must resolve candidates via this service, never raw exact-match.
