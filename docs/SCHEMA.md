# Data model

Reference for the Supabase / Postgres schema. **Source of truth: `db/schema.sql`.**
This doc summarises the tables in the order they appear in the file and notes the relationships that aren't obvious from a single `\d`.

## Multi-tenancy root

| Table | Purpose |
|---|---|
| `administrations` | Top-level account (Pampa Administración). All other rows cascade to one administration. |
| `administrators` | The four partners (Lisa / Flavio / Alejandro / Dorso). Each has a `default_commission_pct`. |

## Core entities

| Table | Purpose | Key fields |
|---|---|---|
| `landlords` | Property owners | `name`, `dni_or_cuit`, `email`, `phone`, `notes` |
| `tenants`   | Renters         | `name`, `dni`, `email`, `phone` |
| `properties` | Physical units | `address`, `property_type` (`vivienda`/`local`/`cochera`/`oficina`/`deposito`), `administration_id` |
| `contracts`  | The rental agreement spine | many — see below |

`contracts` is the most important table. Key fields:

| Field | Meaning |
|---|---|
| `property_id` | FK to `properties` (RESTRICT on delete — can't drop a rented property) |
| `current_rent` | Currently active monthly rent. Updated when an IPC adjustment is applied. |
| `initial_rent` | Original rent at contract start — preserved for audit. |
| `expensas` | Monthly expensas charge (separate from rent). |
| `cadence` | Adjustment cadence: `mensual` / `bimestral` / `trimestral` / `cuatrimestral` / `semestral` / `anual`. |
| `indexer` | Which index to apply: `IPC_GENERAL` / `ICL` / `CASA_PROPIA` / `FIXED`. |
| `start_date` / `end_date` | Contract term. |
| `next_adjustment_date` | Cached date of next IPC adjustment. |
| `payment_day` | Day of month rent is due (1-31). |
| `status` | `draft` / `active` / `suspended` / `ended` / `rescinded`. |
| `lfa_code` | L/F/A code identifying which Pampa admin handles this contract. Added 2026-06-13. |
| `commission_pct` | Pampa's commission % applied to total cobrado. Default 8.0%. Added 2026-06-13. |

## Junction tables (many-to-many)

| Table | Connects | Why |
|---|---|---|
| `contract_tenants` | contracts ↔ tenants | A contract can have multiple co-tenants. `is_primary` flag picks the headline tenant for displays. |
| `contract_landlords` | contracts ↔ landlords | Co-ownership: each row has `ownership_pct` (must sum to 100 per contract). |
| `contract_administrators` | contracts ↔ administrators | Which Pampa partner administers the contract, with their `share_pct`. |
| `property_landlords` | properties ↔ landlords | Property-level co-ownership (independent of which contracts exist). |

## Money flow

| Table | Purpose |
|---|---|
| `transaction_types` | Lookup for every kind of money movement (21 codes: RENT_IN, COMMISSION_OUT, ABL_OUT, …). |
| `transactions` | Every money movement. Tagged with `contract_id` (nullable), `transaction_type_id`, `period`, `bank_date`, `bank_account_id`, `amount`, `description`. |
| `liquidaciones` | Monthly settlement per (contract, landlord, period). Status flow `draft` → `sent` → `paid`. Stores `gross_amount` / `total_deductions` / `net_to_landlord` snapshot + `adjustment_amount` (signed manual adjustment) + `notes`. |
| `liquidacion_lines` | Per-transaction itemisation of a liquidación (when generated). |
| `adjustments` | IPC rent-adjustment audit trail (snapshot of CPI values at adjustment time). |

### Transaction codes (the 21 from the seed)

| Code | Dir | Category | Affects liquidación |
|---|---|---|---|
| `RENT_IN` | IN | rent | ✓ |
| `EXPENSAS_IN` | IN | expense | ✓ |
| `DEPOSIT_IN` | IN | deposit | — |
| `LATE_FEE_IN` | IN | rent | ✓ |
| `UTILITY_REFUND_IN` | IN | refund | ✓ |
| `OTHER_IN` | IN | other | ✓ |
| `COMMISSION_OUT` | OUT | commission | ✓ |
| `LANDLORD_PAYOUT` | OUT | rent | — |
| `EXPENSAS_OUT` | OUT | expense | ✓ |
| `ABL_OUT` | OUT | tax | ✓ |
| `AYSA_OUT` / `EDESUR_OUT` / `METROGAS_OUT` | OUT | utility | ✓ |
| `AFIP_OUT` | OUT | tax | ✓ |
| `REPAIR_OUT` / `LEGAL_OUT` / `INSURANCE_OUT` / `BANK_FEE_OUT` | OUT | expense | ✓ |
| `DEPOSIT_REFUND` | OUT | deposit | — |
| `TRANSFER_OUT` | OUT | transfer | — |
| `OTHER_OUT` | OUT | other | ✓ |

`affects_liquidacion=true` rows go into the embudo aggregation. The false ones (deposits, transfers, landlord payouts) move money but don't change the embudo math.

### Three-destination commission split (Alejandro's spec #3)

`COMMISSION_OUT` rows have their `description` parsed for the marker substring:
- `ADM_GALICIA`
- `ADM_FRANCES_50_9`
- `ADM_FRANCES_51_6`

`classifyDestination()` (in `lib/reconciliation/queries.ts`) returns the matching `DestinationCode` so the per-account `/conciliacion` view and the per-row split columns in `/liquidacion` stay consistent.

## Bank accounts

| Table | Purpose |
|---|---|
| `banks` | Master list of bank brands (Galicia, BBVA Francés, etc.) with per-bank fees (`monthly_fee`, `transfer_fee_pct`, `transfer_fee_fixed`) + commercial contact info. |
| `bank_accounts` | Individual accounts: `alias`, `cbu`, `account_number`, `account_type` (CA/CC/USD), `is_active`, and exactly ONE of `administration_id` / `administrator_id` / `landlord_id` (owner). |

## Operational helpers

| Table | Purpose |
|---|---|
| `contract_period_notes` | Per-(contract, period) text notes used by the encargada. Upserted via the period notes editor on contract detail. |
| `pending_actions_sent` | Snooze table for the Pendientes bell. Records `(contract_id, category, sent_at)` so a marked-sent action disappears for 7 days. |

## Status enums

| Field | Values |
|---|---|
| `contracts.status` | `draft` / `active` / `suspended` / `ended` / `rescinded` |
| `contracts.cadence` | `mensual` / `bimestral` / `trimestral` / `cuatrimestral` / `semestral` / `anual` |
| `contracts.indexer` | `IPC_GENERAL` / `ICL` / `CASA_PROPIA` / `FIXED` |
| `contracts.currency` | `ARS` / `USD` |
| `transactions.status` | `pending` / `partial` / `paid` / `overdue` / `cancelled` |
| `transactions.currency` | `ARS` / `USD` |
| `liquidaciones.status` | `draft` / `sent` / `paid` |
| `pending_actions_sent.category` | `cobranza` / `aumento` / `renovacion` |

## Relationships at a glance

```
administrations ───┐
                   │
   ┌───────────────┼──────────────────┐
   │               │                  │
administrators  contracts ─┬─ properties
   │               │       │
   │               │       └─ property_landlords ── landlords
   │               │
   │               ├─ contract_tenants     ── tenants
   │               ├─ contract_landlords   ── landlords
   │               └─ contract_administrators ── administrators
   │
   └─ bank_accounts ── banks
            │
            └─ transactions ── transaction_types
                  │
                  └─ liquidaciones ── liquidacion_lines
```

## Indexes worth knowing

The schema sets these indexes (see `db/schema.sql` for the full list):

- `idx_transactions_period` — every dashboard / liquidación query filters by `period`.
- `idx_transactions_contract` — embudo aggregations.
- `idx_contracts_next_adjustment` — Pendientes "aviso de aumento" detection.
- `idx_liquidaciones_period` / `idx_liquidaciones_status` — grid filters.

## Conventions

- All money columns are `numeric(12,2)` (Argentine peso precision).
- All foreign keys cascade ON DELETE except `property_id` / `contract_id` on `transactions` (SET NULL — preserves audit trail) and `landlord_id` / `tenant_id` (RESTRICT — protects junction integrity).
- `created_at` on every table; no `updated_at` yet (planned with the audit log in production hardening).
- Periods are stored as `date` set to the first of the month (`YYYY-MM-01`).
