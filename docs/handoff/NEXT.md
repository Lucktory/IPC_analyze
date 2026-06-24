# Open threads + recent decisions

What's pending and why, plus a narrative of the last week so context isn't lost.

## Open threads — priority order

### A. Observaciones split (next up — Alejandro waiting)

Alejandro's 2026-06-20 ask: split the per-row Observación cell into **two sections**:

- **Top** — reminder for the **NEXT** period (cosa que descontar / sumar el mes que viene)
- **Bottom** — the **CURRENT** period's note + the existing signed adjustment_amount field

Schema is already fine — `contract_period_notes` is keyed by `(contract_id, period)`. The "reminder for next month" is just the row for `next_period`. UI rework only:

- Modify `InlineObservacionCell` popover to show two textareas
- Top binds to `contract_period_notes` for `period + 1 month`
- Bottom binds to `period` (current behavior) + `adjustment_amount` slot

He's confirmed the design and is waiting on it. Estimated ~half a day. **Start here.**

### B. The OTHER Observaciones tab

Alejandro mentioned there's a second "observaciones" surface he uses ("la otra solapa observaciones... creo que eran recordatorios en general... hoy en el día la me fijo bien y te digo"). Don't build until he reports back what it should be.

### C. Arreglos / Eventos workflow

Schema fully ready (`contract_events` with `kind='arreglo'`, `applies_to_period`, `amount_landlord`, `amount_tenant`, `attachment_url`). UI nothing.

**Blocked on Mariela joining the group.** She manages the arreglos sector. Alejandro explicitly said he wanted her input on the UX before building.

When she joins: design the Arreglo modal with cross-month deferral (if logged after payment_day → next period). Surface pending arreglos on `/pendientes` or a new section. Visual badge on planilla row when contract has pending arreglos this period. Per saved memory `client_repair_tracking_manual_classification.md`: payer split is **manual**, never auto-classify landlord vs tenant.

### D. HTML rendición email (Receipt Shapes A/B/C)

Saved memory: `client_email_format_receipt.md`, `client_receipt_shapes.md`. Three sample PDFs (ALVAREZ, VILLAREAL, SIMOES) document the expected layout: header with logo + agency contact, INGRESOS section with itemized lines, DEDUCCIONES (admin commission + IVA + sellado + expensas + arreglos), SALDO A RENDIR footer. Shape C has per-landlord split for multi-owner rendiciones.

Attempted once (commit `b18e821` — `lib/liquidacion/email-receipt.ts` has the engine code), reverted (`05491a8`) because Alejandro said "I do not like the email template". Code is still in the repo but unused.

**Blocked on Alejandro materials:** logo PNG, the "abril" historical template, agency-branding rename pass (`Pampa Administración` → `Patagonia Propiedades`, ~18 files).

### E. IPC adjustment workflow

Biggest manual pain in the office (99 contracts × monthly aumento → 99 manual edits). Schema is fully ready: `cpi_values` (INDEC feed), `adjustments` (audit trail with cpi snapshot), `contracts.next_adjustment_date`, `contracts.indexer` (IPC_GENERAL / ICL / CASA_PROPIA / FIXED), `contracts.commission_pct`.

Not built. No code reads `cpi_values`. Encargada edits `current_rent` manually.

Design sketch (when this happens):
- A way to paste INDEC monthly variation values (form on a new `/aumentos` page or `/dashboard` widget)
- An "aumentos pendientes este mes" view listing contracts whose `next_adjustment_date <= today`
- One-click apply that creates `adjustments` row, updates `contracts.current_rent`, bumps `next_adjustment_date` by cadence months, sets `last_adjustment_date`

Open design question: compound formula vs simple. Argentine convention varies — confirm with Alejandro before coding.

### F. Tenant receipts (recibos)

`recibos` table is ready (numero, serie, fecha, monto, concepto, estado, pdf_url). Legally required in Argentina. Encargada presumably issues them in another tool today. No code.

### G. Sellado / Deposit automation

Both stored on `contracts` (`sellado_total / sellado_landlord_share_pct / sellado_applied_at`, `deposit_amount / deposit_status`). Schema models the lifecycle, no code auto-applies. The `CONTRACT_SELLADO_PENDING` and `CONTRACT_DEPOSIT_STATE_INVALID` validation rules surface drift; nothing fires the events.

### H. Bulk operations

Applying IPC to 99 contracts = 99 clicks. Marking liquidaciones paid in batch = 99 clicks. Sending rendición batch = 99 clicks. Worth adding a bulk select pattern on `/liquidacion`. Not asked for yet but flagged because the office is small.

### I. DB constraint enforcement (Thread A3)

After all data is clean (per the diagnostic SQL), apply DB-level enforcement:
- `CHECK (end_date > start_date)` on contracts
- Constraint triggers enforcing junction sums = 100 on contract_landlords, contract_tenants, contract_administrators

Migration drafts not written. Defer until A2 results are zero.

## Won't do unless Alejandro re-raises

Per `memory/client_galicia_scope_decision.md`:

- BW agency-internal expenses (the "red zone" columns from his Sheets)
- Araiz / Beverelli subgroup tagging
- "Ensamble" of those totals into the main planilla
- Direct (non-mediated) contracts (Medhi-chan raised this, Alejandro never confirmed need)

## Recent work narrative

Day-by-day for the last week to preserve context the new Claude can't infer from git log alone.

### 2026-06-17 — Phase 11 base

- Branding rename setup (Patagonia Propiedades vs Pampa placeholder)
- IVA + billing fields added to contracts (`billing_administrator_id`, `commission_includes_iva`, `commission_base`, `is_commercial`, `rent_iva_rate`, `sellado_*`, `deposit_*`, `includes_abl`/`abl_amount`)
- Tenant `share_pct` + auto-rebalance on save
- Rendiciones table for Shape C multi-contract aggregation
- Three saved-memory files about receipts, IVA rules, deposits

### 2026-06-18 — Thread A diagnostic system

- Color spec revision: blues replace yellow/orange for expiry (Alejandro voice), orange replaces blue for aumento
- Thread A2a: 6 Tier-1 integrity rules + diagnostic SQL covering all 12 rule kinds
- Color tints unified solid (sticky-vs-non-sticky bleed-through fix)
- Movimientos modal pattern established
- Deuda breakdown popover + carryover + intereses toggle (localStorage-persisted per contract)

### 2026-06-19 — Thread A2b + ABL

- 6 Tier-2 integrity rules (admin sum, missing pct, sellado, deposit state, IVA mismatch, etc.)
- Saturation bump on all status tints (50→100, 100→200, 200→300/70)
- First version of ABL: single field on contracts, merged into Alquiler cell expected
- Pendientes rewrite to 3 categories
- /diagnostico page (Thread A2c) using shared `ValidationIssueRow`

### 2026-06-20 — Alquiler revision + Recargos

- Alejandro voice: "el alquiler tiene que permanecer limpio, libre — es el alquiler y nada más"
- ABL revert from Alquiler cell
- New `contract_recurring_charges` table (N rows per contract, label + amount + optional recupero_type_code)
- Migration moves existing ABL data, drops the two `contracts.*` columns
- New Recargos column on planilla with status dot (green/red/none)
- Editor on contract page, originally with read-only popover from planilla
- New `RECURRING_CHARGE_NOT_RECORDED` validation rule

### 2026-06-25 — Recargos UX fixes

- **Bug found**: clicking propietario/inquilino names on planilla had no nav, or wrong nav. Fixed: both names show a `→` pill jumping to `/contratos/[id]`. Previous Inquilino arrow was pointing at `/liquidacion/[contractId]` (per-period rendición detail), not the contract page.
- **Major redesign**: Recargos cell now opens a **modal** (not a popover) containing both the read-only status breakdown AND the full editor stacked. Same pattern as Movs. Empty cell shows "+ Cargar" instead of dead "—". Encargada never has to leave the planilla.
- Status icons in the Recargos breakdown bumped from 13px → 18px (Medhi-chan flagged they were too small to read).

## Pre-deploy checklist when picking back up

1. **Run the SQL migration in Supabase** if not already: `db/migration-2026-06-20-contract-recurring-charges.sql`. Verify with `select count(*) from contract_recurring_charges;` — should match the number of contracts that previously had `includes_abl=true`.
2. **Check git status** — should be clean at `dd70236`.
3. **Type-check**: `npx tsc --noEmit -p tsconfig.json` — should exit 0.
4. **Smoke-test `/liquidacion`** — open a row's Recargos cell, verify the modal opens with the editor.
5. **Check the topbar bell** — should show the count of actionable pendientes.
