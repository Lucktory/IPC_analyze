# Competitive Design Audit — Argentine Rental Administration Software

**Date**: 2026-06-06
**Scope**: 30-minute reconnaissance of direct + adjacent competitors to ground our build in real market patterns instead of generic SaaS taste.

---

## What we looked at

### Direct competitors (rental admin SaaS for Argentine inmobiliarias)
- **Barreeo** (barreeo.com) — current market leader, $7.5K-$48.6K ARS/month, 2000+ properties managed
- **Ubiquo** (ubiquo.com.ar) — 320+ inmobiliarias in LATAM
- **Tokko Broker** (tokkobroker.com) — #1 CRM in Argentina with 4,200 professionals (CRM-focused, not rental-admin-specific)

### Competitors with weak Argentine fit (per Barreeo's own comparison)
- Rentger, Homming, Odoo, Mlsoft, Rentware, Nester — all flagged for lacking IPC/ICL automation, punitorios, or WhatsApp

### Adjacent references
- Galicia online banking UX case study (Aerolab) — for financial dashboard patterns
- Roomix.ai (modern AR IPC calculator)

---

## Key findings

### 1. Terminology — we are partially off-market

The customer-facing vocabulary administrators and tenants actually use:

| Concept | Barreeo / market term | What we have | Action |
|---|---|---|---|
| Rent increase | **Aumento** / Aumentos | "Ajustes IPC" | Add "Aumentos" as primary label, keep "Ajustes IPC" as secondary detail |
| Late fee / interest | **Punitorios** | "Mora" / "Late interest" | Rename to "Punitorios" |
| Owner payout | **Liquidación** | "Liquidación" | ✓ correct |
| Tenant | **Inquilino** | "Inquilino" | ✓ correct |
| Owner | **Propietario** | "Propietario" | ✓ correct |
| Receipts | **Recibos** | (missing) | Add as Phase 1 — administrators give recibos every payment |
| Building expenses | **Expensas** | (missing) | Add as data field — they pass through to tenant + appear in liquidation |
| Tenant self-service | **Portal inquilino** | (missing) | Phase 2, but mention in roadmap — Barreeo leads with it |

### 2. Index handling — we hardcoded IPC, but the market uses multiple

The DNU 70/2023 deregulated index choice. Real Argentine contracts use:
- **IPC** (INDEC monthly) — most common, what we have
- **ICL** (BCRA daily) — required by older Ley de Alquileres contracts still active
- **UVA / UVI** (BCRA daily with inflation caps)
- **Casa Propia** (alternative index)

Barreeo + Ubiquo both automate IPC **AND** ICL. We only handle IPC general. Per-contract indexer was in our schema but isn't surfaced anywhere in the UI.

### 3. Selling proposition — competitors don't sell "professional dashboards", they sell hours saved

Barreeo's hero KPI: **"40 horas perdidas al mes" → "1 hora"** (manual vs Barreeo).
Their landing leads with TIME, not feature lists.

Our dashboard's hero KPI is "247 Contratos activos." Accurate but not motivating. Administradores don't care about contract count — they manage it. They care about hours.

A hero KPI like "Tiempo ahorrado este mes: 32 hs" would land harder than "Contratos activos."

### 4. Missing operational features that competitors lead with

| Feature | Barreeo | Ubiquo | Our build |
|---|---|---|---|
| WhatsApp reminders | ✓ Marketing headline | ✓ | ❌ Phase 2 only |
| ARCA AFIP electronic invoice | ✓ Chrome extension | (unknown) | ❌ Out of scope (correct call per discussion) |
| Tenant portal | ✓ Branded | ✓ | ❌ Phase 2 |
| Automatic IPC + ICL | ✓ | ✓ | ⚠ IPC only |
| Automatic punitorios (daily) | ✓ | ✓ | ⚠ Schema yes, UI no |
| Expensas tracking | ✓ | (likely) | ❌ Not in schema |
| Recibos generation | ✓ | (likely) | ❌ Not built |

We are NOT outclassed on engine quality (compound IPC, audit trail, reconciliation) — we are missing the operational surface that administrators expect to see in a v1.

### 5. Visual style — our palette is defensible but unusual

| Element | Market norm | Our choice | Verdict |
|---|---|---|---|
| Background | White (Barreeo, Ubiquo) | Cream `#FAF6F1` | Differentiated, premium signal per Galicia UX case study — keep |
| Primary | Blue (Barreeo navy) | Royal `#4068d8` | Same family, slightly lighter — fine |
| CTA / success | Green | Coral `#FF8552` as accent + green success | Coral as accent is distinctive — keep, but use green for "completed/paid" states |
| Typography | Sans-serif modern | Lexend (just changed) | Distinctive — keep |
| Icons | Emoji in marketing, lucide in product | Hand-drawn SVG | More premium than market — keep |

### 6. Dashboard pattern (per Galicia case study)

Aerolab's design philosophy for Galicia online banking was:
- **Group by workflow stages**, not feature lists
- **Reduce information load** — premium service demanded a cleaner look
- **Take brand to the background** — prioritize operations
- **Wireframe hierarchy first**, visual polish second

Our current dashboard does some of this (chart-driven, KPI strip first) but still has the "Panel principal" hero card that adds chrome without information. The Galicia approach validates removing it.

---

## What we got right

1. **Compound IPC formula with audit trail** — matches Barreeo's exact explanation (1,05 × 1,04 × 1,06 − 1 = 0,160).
2. **Liquidaciones terminology** — matches the market.
3. **DNU 70/2023 awareness in the bid** — Alejandro's conversation referenced it; it's the legal underpinning Barreeo also leads with.
4. **Per-contract cadence flexibility** — schema already supports trimestral/semestral/anual.
5. **Multi-bank support in schema** — Argentine administradores really do work across 3-4 banks.
6. **Audit-trail emphasis** — Barreeo doesn't even market this, but for administrator-to-owner trust, it's a real differentiator.
7. **Lexend over Roboto+Poppins** — Roboto+Poppins is the AI tell; Lexend reads as a deliberate choice.

---

## What we got wrong (or sub-optimally)

1. **Hero KPI choice** — "Contratos activos" instead of "horas ahorradas" misses the market's emotional driver.
2. **Terminology** — "Ajustes IPC" / "Mora" instead of "Aumentos" / "Punitorios" makes the product feel academic, not native.
3. **Missing Expensas and Recibos** — these are *table stakes* in Argentine inmobiliarias, not nice-to-haves.
4. **IPC general only, no ICL toggle** — limits us to contracts under the new framework; older contracts use ICL.
5. **"Panel principal" hero card** — generic SaaS chrome, neither competitor uses this pattern.
6. **No tenant portal stub** — Barreeo's #1 marketed differentiator, we have nothing.
7. **No WhatsApp signal anywhere** — administrators expect to see it at least as "coming soon."

---

## Recommended changes (Phase 1 within current $1,200 budget)

### Tier A — terminology and copy (1-2 hours, high impact)

- **Rename `/ajustes-ipc` → `/aumentos`** in the sidebar label (keep the URL or also rename, your call). Subtitle: "Aumentos automáticos por IPC, ICL y otros índices."
- **Rename "Mora" → "Punitorios"** wherever it appears (data model, UI labels, KPI cards).
- **Tweak hero KPIs** on `/dashboard` to lead with "Tiempo estimado ahorrado" instead of "Contratos activos." Calculation: hours-per-month-that-would-be-manual × num adjustments + late-tenant calls + liquidations.
- **Add "Aumentos próximos"** copy where we currently say "Ajustes IPC próximos."

### Tier B — domain concepts (0.5-1 day)

- **Add `expensas` field to contracts** (numeric, optional). Show in contract detail. Include in liquidation calculation.
- **Add `recibos` table** + simple receipt generation per payment (PDF stub OK for Phase 1).
- **Surface the `indexer` field per-contract** in the UI (currently in schema only). Default IPC_GENERAL, but show ICL / Casa Propia as options in dropdowns.

### Tier C — credibility / market signals (1-2 hours)

- **Add a "Phase 2" section to the dashboard** with disabled tiles for: Portal inquilino, WhatsApp automático, ARCA factura electrónica. Signals administrators "we know what comes next."
- **Add "Tiempo ahorrado este mes" KPI card** as the first card in the strip.
- **Replace "Panel principal" hero card** with a single line: "Sábado 6 de junio · 12 acciones requieren atención" — per the earlier proposal, now reinforced by the Galicia UX case study.

### Tier D — defer to Phase 2 (don't build yet)

- Portal inquilino (full tenant self-service)
- WhatsApp messaging actual integration
- ARCA AFIP factura electrónica integration
- Multi-administración UI toggle (data layer already supports it)
- ICL daily fetch from BCRA API

---

## What I will NOT change

- Cream / royal / coral palette
- Chart-driven dashboard structure
- Compound IPC engine logic
- The Plager ERP-derived design system foundations
- Lexend typography
- Hand-drawn SVG icons

---

## Sources

- [Barreeo product landing](https://barreeo.com/)
- [Barreeo IPC calculator + formula explanation](https://barreeo.com/calculadora-de-alquileres/)
- [Barreeo competitor comparison](https://barreeo.com/mejor-software-alquileres-argentina/)
- [Ubiquo product landing](https://www.ubiquo.com.ar/)
- [Tokko Broker features](https://www.tokkobroker.com/es-ar/funcionalidades)
- [Galicia online banking UX case study (Aerolab)](https://aerolab.co/banco-galicia-online-banking)
- [Roomix IPC calculator](https://roomix.ai/calculadora-ipc)
