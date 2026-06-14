# IPC-Analyze

Rental administration web app for **Pampa Administración** (Alejandro Himmel, Argentina).
Manages contracts, tenants, landlords, properties, movimientos, liquidaciones, and bank reconciliation, with IPC-aware rent adjustment built into the data model.

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Database | Supabase (Postgres + Auth) |
| Styling | Tailwind CSS 3 (CSS-variable theme tokens) |
| Charts | ECharts + custom SVG (sparklines, gauge) |
| PDFs (v1) | Browser native print → "Save as PDF" |
| Hosting | Vercel |

## Quick setup

```bash
# 1. Install
npm install

# 2. Environment
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Database
# In Supabase SQL editor, run in order:
#   db/schema.sql                                   (initial schema)
#   db/migration-2026-06-09-contract-period-notes.sql
#   db/migration-2026-06-09-property-landlords.sql
#   db/migration-2026-06-11-banks-fields.sql
#   db/migration-2026-06-11-pending-actions-sent.sql
#   db/migration-2026-06-13-liquidacion-grid.sql
#   db/migration-2026-06-13-contract-commission.sql
# See docs/MIGRATIONS.md for context on each.

# 4. (Optional) Import existing data from CSV
npm run import-sheet

# 5. Dev server
npm run dev
```

## Documentation

| Document | Audience |
|---|---|
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | Daily users (encargada, Alejandro) — every page, every action |
| [docs/SCHEMA.md](docs/SCHEMA.md) | Developers — data model reference |
| [docs/MIGRATIONS.md](docs/MIGRATIONS.md) | DevOps — deployment + migration checklist |
| [WORKLOG.md](WORKLOG.md) | Devs — chronological build log |

## Project structure

```
app/                          Next.js App Router pages
  (app)/                      Authenticated app shell
    dashboard/                Panel ejecutivo (5 charts)
    pendientes/               Action queue (cobranza/aumento/renovación)
    contratos/                Contracts list + create + detail
    propietarios/             Landlords CRUD
    inquilinos/               Tenants CRUD
    propiedades/              Properties CRUD
    movimientos/              Transactions CRUD
    bancos/                   Bank accounts + bank-institution master list
    conciliacion/             Per-account commission reconciliation
    liquidacion/              Wide spreadsheet grid + detail with embudo
  login/                      Sign-in page
components/
  ui/                         Shared UI primitives (DelayedActionButton, FormField, …)
  shell/                      App shell (TopBar, SideNav, ThemeToggle, …)
  charts/                     Dashboard chart components
  liquidacion/                Grid + inline cells + workflow buttons
  movimiento/                 Movimiento forms (new + edit)
  tenant/ landlord/ property/ bank/ contract/   Entity forms
lib/
  supabase/                   Server + browser clients
  liquidacion/                Queries + actions
  transaction/                Transaction actions (create / upsert / update / commission gen)
  contract/ tenant/ landlord/ property/ bank/   Per-entity queries + actions
  dashboard/ pending/ reconciliation/            Aggregate queries
  format.ts / period.ts / owner.ts / db-errors.ts   Shared helpers
db/                            Schema + migrations + seed SQL
scripts/
  import-from-sheet.ts        Parses client-data/alejandro-sheet.csv → seed SQL
  seed.ts                     Generates synthetic seed data
```

## Conventions

- **Always log in via Supabase auth.** No row-level security in dev (`db/rls-disable.sql` is applied). Production deployment requires RLS to be enabled (planned, not shipped).
- **Money-touching mutations use `DelayedActionButton`** — a 10-second arm-cancel wrapper. Anywhere a Save/Delete/Send button affects a money column, you click → countdown → confirm or cancel.
- **CSS-variable theming** — light/dark palette swaps via `<html data-theme="dark">`. Existing Tailwind utilities (`bg-paper`, `text-ink`, …) work automatically.
- **Single source of truth** modules: `lib/format.ts` for formatters, `lib/owner.ts` for owner-type derivation, `lib/period.ts` for "current period", `lib/db-errors.ts` for Postgres error translation.
