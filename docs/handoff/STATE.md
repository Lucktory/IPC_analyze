# Code state

What's live in `main` at handoff. Last commit `dd70236`.

## Schema (22 tables)

Source: `db/schema.sql`. Drop + recreate at the top, then seed banks + transaction_types + the Patagonia admin row.

Main entities:
- `administrations` · `administrators` (Flavio/Lisa/Alejandro/Dorso) · `external_accountants`
- `landlords` · `tenants` · `properties` (vacancies are first-class)
- `banks` · `bank_accounts` (polymorphic owner: admin / administrator / landlord)
- `contracts` with junctions: `contract_landlords` · `contract_tenants` · `contract_administrators`
- `contract_period_notes` (per-period scratchpad)
- `contract_events` (timeline: arreglos / aumentos / mails / status changes — schema ready, UI not built)
- `contract_recurring_charges` (NEW 2026-06-20 — replaces contracts.includes_abl/abl_amount)
- `transaction_types` (21 + 5 recupero codes = 26 seeded) · `transactions`
- `rendiciones` · `rendicion_landlords` · `liquidaciones` · `liquidacion_lines`
- `adjustments` · `cpi_values` (IPC feed, never wired)
- `recibos` (tenant receipts — schema ready, no code)

## Pending migration to apply

`db/migration-2026-06-20-contract-recurring-charges.sql` — must run in Supabase SQL Editor on the production project before the `Recargos` column populates. Creates the new table, moves existing ABL data, drops the two now-obsolete columns from `contracts`.

If you find this still pending when you take over: tell Medhi-chan first, don't run it yourself — destructive on the column-drop step.

## Major pages

### `/liquidacion` — the planilla

`app/(app)/liquidacion/page.tsx` + `components/liquidacion/LiquidacionGrid.tsx` (the big one, ~900 lines).

Columns in left-to-right order (4 sticky-left):

1. Observación (sticky) — `InlineObservacionCell`
2. LFA (sticky) — code editor
3. F. banco (sticky) — `InlineDateCell` for RENT_IN
4. Propietario (sticky) — `InlineParticipantsCell` + `→` to `/contratos/[id]`
5. Expensas — number
6. Inquilino — `InlineParticipantsCell` + `→` to `/contratos/[id]`
7. Pct — commission %
8. Cadencia
9. Contrato (vigencia) — date range + expiry color tint
10. Deuda — `InlineDeudaBreakdownCell` (popover with carryover + intereses toggle)
11. Pago — countdown / cobrado / vencido
12. Alquiler — pure rent only (orange tint when aumento)
12b. **Recargos** (NEW) — `InlineRecurringChargesCell` → modal with editor
13. Extras — non-rent IN inflows
14. Transferencia
15. Otros — non-commission OUT
15b. Movs — `InlineMovimientosCell` → modal
16. D. transf
17. ADMI · 17b. IVA · 18. Galicia · 19. BBVA 50/9 · 20. BBVA 51/6
21. Estado — click to cycle draft → sent → paid → draft
22. Mail — `LiquidarYEnviarButton`
23. Check — `ValidationBadgeCell` (popover lists all issues for the row)

Data: `lib/liquidacion/queries.ts` → `getLiquidacionGridForPeriod(period)`. One contracts query + two bulk helpers (deuda breakdown, recurring charges) running in parallel.

### `/pendientes` — cashflow inbox

`app/(app)/pendientes/page.tsx` + `lib/pending/digest.ts`.

Three categories (no more aumento/validation/datos — those moved to other surfaces):

1. **pendiente_transferencia** — either tenant hasn't paid (`falta_cobro`) or agency hasn't transferred (`falta_transferencia`)
2. **liquidacion_abierta** — LANDLORD_PAYOUT recorded but status ≠ 'paid'
3. **cobranza_proxima** — vence en ≤7 días, no cobro yet

Per row: WhatsApp icon (green, wa.me link), Email icon (Gmail compose URL — NOT mailto, that breaks on Windows without a default mail client), "Ver contrato →" link.

### `/contratos/[id]` — contract config page

`app/(app)/contratos/[id]/page.tsx`. Sections from top:

- Header / metadata strip
- **Recargos editor** (`RecurringChargesEditor` — replaces the old `AblSurchargeEditor`)
- Liquidación embudo for the selected period
- **Deuda breakdown** for the selected period
- **Diagnóstico** (per-contract validation issues — uses `ValidationIssueRow`)
- **Movimientos** panel
- Observaciones notes editor
- Sidebar: landlords + tenants list

### `/diagnostico` — system-wide validation view

`app/(app)/diagnostico/page.tsx` + `lib/liquidacion/diagnostico.ts`.

Lists every validation issue across active contracts for the current period. StickyHeader + 3 KPI cards (errors / warnings / clean) + per-rule filter chips + accordion sections grouped by severity. Reuses `ValidationIssueRow`.

## Validation framework

`lib/liquidacion/validations.ts`. 20 pure-function rules ran against every row by `validateRow()`. Each returns `ValidationIssue | null`.

| Tier | Codes |
|---|---|
| Cashflow (8) | TRANSFERENCIA_IMBALANCE, TRANSFERENCIA_NEGATIVE, PAID_STATUS_INCONSISTENT, BANK_DATES_OUT_OF_ORDER, ADMI_DESTINATIONS_UNCLASSIFIED, COMMISSION_PCT_DEVIATION, RENT_AMOUNT_VARIANCE, PAYMENT_OVERDUE |
| Integrity Tier 1 (6) | CONTRACT_EXPIRED_BUT_ACTIVE, CONTRACT_INVALID_DATE_RANGE, CONTRACT_LANDLORD_JUNCTION_EMPTY, CONTRACT_TENANT_JUNCTION_EMPTY, LANDLORD_PCT_SUM_NOT_100, TENANT_PCT_SUM_NOT_100 |
| Integrity Tier 2 (6) | ADMIN_PCT_SUM_INVALID, CONTRACT_MISSING_COMMISSION_PCT, CONTRACT_NEXT_ADJUSTMENT_OVERDUE, CONTRACT_SELLADO_PENDING, CONTRACT_DEPOSIT_STATE_INVALID, BILLING_IVA_MISMATCH |
| Recurring (1) | RECURRING_CHARGE_NOT_RECORDED |

All surface in the Check column (per row) AND `/diagnostico` (system-wide) AND the contract page Diagnóstico section. Single source of truth for rule labels: `prettyValidationCode()` in `components/shared/ValidationIssueRow.tsx`.

Diagnostic SQL audit (no app code, paste in Supabase): `db/diagnostic-2026-06-18-data-integrity.sql`. Returns one row per (contract, issue_kind) for the same rules.

## Color tokens

Single source: `lib/liquidacion/thresholds.ts`. Never hex codes in components.

| Token | Value (after 2026-06-19 saturation bump) |
|---|---|
| Contract expiry, next month | `bg-sky-200` (celeste) — Contrato cell |
| Contract expiry, this month | `bg-sky-400/70` (azul oscuro) — Contrato cell |
| Contract expired | `bg-red-200` — Contrato cell |
| Aumento this period | `bg-orange-300/70` — Alquiler cell |
| Validation error | `bg-red-100` — full row (sticky + non-sticky use same solid class) |
| Validation warning | `bg-orange-100` — full row |
| Recently edited (<5 min) | `bg-yellow-100` — full row |
| Zebra alternation | `bg-white` / `bg-gray-50` |

## Componentization patterns established

Three click-to-expand patterns. Match the existing one when adding new cells:

| Type | Pattern | Example |
|---|---|---|
| **Modal** (managed config + status) | shared Panel + shared Editor inside modal chrome | `MovimientosModal`, `RecurringChargesModal` |
| **Popover** (view-only breakdown) | portal-rendered floating panel | `InlineDeudaBreakdownCell`, `ValidationBadgeCell` |
| **Inline editor** (single field) | click → small popover with text/date/select | `InlineLfaCell`, `InlineDateCell` |

Shared panels live in `components/shared/`, page-specific wrappers in `components/liquidacion/` or `components/contract/`.

## Auto-touch triggers

`schema.sql` end section. Touches `updated_at` on every UPDATE for: contracts, landlords, tenants, banks, contract_recurring_charges. The planilla sorts by "most recently touched" for the recently-edited yellow tint.

## Things shipped but never used by the UI

- `recibos` table — schema ready, no code generates rows
- `cpi_values` table — INDEC feed slot, nothing populates it
- `external_accountants` table — `landlords.external_accountant_id` references it but no editor
- `property_landlords` junction — vacancy ownership; queries only use `contract_landlords`
- `transactions.status` enum — always 'pending', actual paid-state lives on `bank_date`
- `transactions.expected_date` — never written

Don't delete — they're inert, not buggy. Leave them sleeping until someone asks.

## File-tree shortcuts

```
lib/liquidacion/
├── queries.ts                ← grid query + LiquidacionGridRow interface
├── validations.ts            ← 20 rules + validateRow aggregator
├── deuda-breakdown.ts        ← Deuda popover bulk helper
├── diagnostico.ts            ← /diagnostico digest
├── thresholds.ts             ← color tokens + tolerances
├── email-actions.ts          ← prepareEmailDraft (plain-text fallback)
├── email-receipt.ts          ← buildReceiptHtml (premium template, reverted, lives unused)
├── ingresos-line-types.ts    ← INGRESOS_LINE_TYPES whitelist
└── ingresos-line-actions.ts  ← Per-line CRUD for the Ingresos popover

lib/contract/
├── queries.ts                ← getContractDetail
├── recurring-charges.ts      ← CRUD
├── recurring-charges-bulk.ts ← buildRecurringChargesSummariesBulk
├── inline-field-actions.ts   ← updateContractLfa, etc.
├── junction-actions.ts       ← contract_landlords / contract_tenants edits
└── notes.ts                  ← contract_period_notes

lib/pending/
└── digest.ts                 ← /pendientes + getPendingCount (topbar bell)

lib/transaction/
├── actions.ts                ← Generic upsert/create/delete
└── movimientos-actions.ts    ← Modal-specific CRUD

components/shared/
├── ValidationIssueRow.tsx    ← Used by /diagnostico, contract page, badge popover
├── DeudaBreakdownPanel.tsx
├── MovimientosPanel.tsx
├── MovimientosModal.tsx
├── RecurringChargesPanel.tsx
├── RecurringChargesModal.tsx
└── cells/NamesCell.tsx, forms/Field.tsx, etc.

components/liquidacion/
├── LiquidacionGrid.tsx       ← The planilla itself
├── ValidationBadgeCell.tsx
├── InlineDeudaBreakdownCell.tsx
├── InlineRecurringChargesCell.tsx
├── InlineMovimientosCell.tsx
└── ~15 other Inline*Cell.tsx files

components/contract/
├── RecurringChargesEditor.tsx
└── PeriodNotesEditor.tsx
```
