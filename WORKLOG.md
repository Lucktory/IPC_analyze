# Rental Admin — Build Log

Project: Alejandro H. — Argentina rental administration + IPC automation
Client repo file: [alejandro-argentina-rental-ipc-automation.md](alejandro-argentina-rental-ipc-automation.md)
Build target: `rental-admin/` (Next.js 15 + Supabase + ECharts)
Started: 2026-06-06

---

## Project structure

```
alejandro-argentina-rental-ipc-automation/
├── alejandro-argentina-rental-ipc-automation.md   (bid + client research)
├── WORKLOG.md                                      (this file)
└── rental-admin/                                   (the Next.js app)
    ├── app/                  (App Router)
    ├── components/
    │   ├── shell/            (SideNav, TopBar, AppLayout)
    │   ├── ui/               (KPICard, Badge, Semaforo, PageHeader)
    │   └── charts/           (BarHorizontal, DonutChart, etc.)
    ├── lib/
    │   ├── supabase/         (server + client)
    │   ├── ipc-engine/       (compound formula, INDEC client)
    │   └── design/           (tokens, fonts)
    ├── public/
    └── scripts/              (seed.ts, import-from-sheet.ts)
```

---

## Design system — sourced from Plager ERP prototype

The user explicitly rejected generic AI-template aesthetics. Instead of starting from
shadcn defaults, this build reuses the design language from the Plager ERP prototype
at `C:\HSH\chatActive\joao-br-plager-erp-refactor\prototipo-erp` — a proven premium
admin system already validated for LATAM enterprise use.

### Color tokens (Tailwind extension)

```
coral      #FF8552  accent / active indicators / focus states
coral-dark #E66A36  hover on coral
peach      #FFBC7D  soft accent

royal      #4068d8  primary brand (sidebar, primary buttons)
royal-dark #3457b8  active sidebar bg, button hover
royal-deep #2A4DBC
royal-light#5478e0
royal-line #3F5FC8  sidebar dividers
royal-ghost#EAF0FD  selected row tint

navy       #1E3A5F  data viz primary
navy-light #2B4977
navy-deep  #16294A

ink        #111111  primary text
ink-soft   #1F1F1F  secondary text
slate      #7D8491  meta text, labels
slate-dark #4A4F58

paper      #FFFFFF  card surfaces
cream      #FAF6F1  page background (NOT pure white — premium signal)
cream-2    #F3EEE6  secondary background
line       #E6E1D8  borders (warm, NOT gray)

success    #16A34A  positive deltas, paid status
warn       #F2994A  attention
danger     #DC2626  late, errors
info       #2563EB  informational
```

### Typography

- **Body**: Roboto 400 / 500 / 700, base size 14px, line-height 1.5
- **Display**: Poppins 600 / 700, used for h1-h4, numbers in KPIs, brand
- **Letter spacing**: -0.01em on headlines
- **Numbers**: `tabular-nums` everywhere (rents, percentages, dates, IDs)
- **Labels**: `.label-cap` utility — 11px / 500 / 0.06em uppercase / slate color

### Shadows (NOT generic shadow-md)

```
card        0 1px 2px rgba(17,17,17,0.04), 0 4px 12px rgba(17,17,17,0.04)
cardHover   0 1px 2px rgba(17,17,17,0.06), 0 8px 24px rgba(17,17,17,0.06)
```

### Other tokens

- Max content width: 1440px (`max-w-shell`)
- Custom scrollbar (warm gray, 10px wide)
- Border radius: rounded-md on most surfaces, rounded-lg on cards
- Sidebar: 240px width, royal blue background

---

## Anti-AI design principles (hard rules)

These are non-negotiable for every screen built:

1. **No purple-to-pink gradients anywhere.** Backgrounds are flat cream or paper.
2. **No emoji in section headers** (no 📊 Dashboard, no 💰 Payments). Headers are clean Poppins text.
3. **No "AI-powered" badges, sparkles, robot icons** or anything that signals
   "this was built by an LLM."
4. **No generic shadcn slate-on-white look.** The cream/royal/coral palette
   replaces every slate-50 / slate-900 default.
5. **No stock illustrations or cartoon empty states.** Empty states are short,
   serious sentences in slate text.
6. **No glassmorphism, no blurred backgrounds, no animated mesh gradients.**
7. **Hand-crafted SVG icons in the sidebar** (ported from the ERP). Lucide only
   for utility spots (close buttons, expand arrows). No `<Sparkles />` or `<Wand2 />`.
8. **Real Argentine data only.** Tenant names like Pérez, García, Romero — never
   "John Doe" or "Acme Properties." Bank names: Galicia, Santander, Macro, BBVA.
   Addresses in CABA neighborhoods.
9. **`tabular-nums` on every number.** Rent amounts, percentages, dates, days
   late — they must align in columns.
10. **One signature design moment per screen.** On the sidebar it's the 3px coral
    accent bar on the active item. On KPI cards it's the Poppins 32px number.
    On tables it's the cream zebra. Don't dilute with multiple "wow" effects.
11. **No multi-step animated onboarding flows.** This is internal back-office
    software for one admin. Users land on the dashboard and work.
12. **No marketing landing page.** First route is `/login`. Authenticated route
    is `/`. No "welcome to our platform" page.

---

## Component reuse map

Components to port from Plager ERP (Vue → React):

| Source (Vue) | Target (React) | Effort | Status |
|---|---|---|---|
| `shell/SideNav.vue` | `components/shell/SideNav.tsx` | 1h | pending |
| `shell/TopBar.vue` | `components/shell/TopBar.tsx` | 30m | pending |
| `shell/AppLayout.vue` | `app/(app)/layout.tsx` | 30m | pending |
| `ui/KPICard.vue` | `components/ui/KPICard.tsx` | 15m | pending |
| `ui/Badge.vue` | `components/ui/Badge.tsx` | 15m | pending |
| `ui/PageHeader.vue` | `components/ui/PageHeader.tsx` | 15m | pending |
| `ui/Semaforo.vue` | `components/ui/Semaforo.tsx` | 15m | pending |
| `charts/useChartTheme.ts` | `lib/charts/theme.ts` | 30m | pending |
| `charts/BarHorizontal.vue` | `components/charts/BarHorizontal.tsx` | 1h | pending |
| `charts/DonutChart.vue` | `components/charts/DonutChart.tsx` | 1h | pending |

Chart library: **echarts + echarts-for-react** (matches the ERP's choice; avoids
the generic Recharts look that ships with most templates).

---

## Phase plan

### Phase 0 — Foundations (this session)
- [x] Scout reusable modules
- [x] Extract design tokens
- [x] Define anti-AI principles
- [ ] Create Next.js project at `rental-admin/`
- [ ] Install dependencies (Next 15, Tailwind, Supabase, echarts)
- [ ] Configure Tailwind with ported tokens
- [ ] Wire fonts (Roboto + Poppins via `next/font`)
- [ ] Write global CSS with label-cap utility + scrollbar polish
- [ ] Supabase project setup + schema deployed
- [ ] Seed sample data

### Phase 1 — Authentication + Shell
- [ ] Login page (no marketing, just the form on cream background)
- [ ] Middleware for protected routes
- [ ] App shell layout (royal sidebar + topbar + main area)
- [ ] Port SideNav with hand-drawn SVG icons
- [ ] Port TopBar with user dropdown
- [ ] Logout flow

### Phase 2 — Dashboard
- [ ] KPI strip (4 ported KPICard components)
- [ ] Alertas del día list
- [ ] Saldos por banco table (with red shortfall flags)
- [ ] Próximos ajustes IPC table (clickable rows)
- [ ] Atrasados list (with computed interest)
- [ ] Quick actions footer (3 buttons)

### Phase 3 — Contracts
- [ ] List page (search + filters + paginated table)
- [ ] Detail page with tabs (Detalles, Pagos, Historial de ajustes)

### Phase 4 — IPC Engine
- [ ] INDEC client (datos.gob.ar with local cache)
- [ ] Compound formula (lib/ipc-engine/compute.ts)
- [ ] "Disparar ajuste" modal with breakdown
- [ ] Confirmation flow writes to adjustments table

### Phase 5 — Payments + Late status
- [ ] Payments page (IN/OUT, filters)
- [ ] Late detection logic + interest calculation
- [ ] Bank cash-position calculator (powers dashboard widget)

### Phase 6 — Email integration
- [ ] Resend setup
- [ ] Placeholder templates (swap with Alejandro's later)
- [ ] Sample email sender with preview

### Phase 7 — Polish + deploy
- [ ] Empty states (short, serious sentences)
- [ ] Loading skeletons (cream-tinted, not gray)
- [ ] Error toasts (sonner with cream theme)
- [ ] Final Vercel deploy

### Post-Alejandro-materials phase
- [ ] Sheet importer script
- [ ] Real templates swap
- [ ] Logo + brand color application
- [ ] Real user accounts in Supabase
- [ ] Subdomain DNS

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-06-06 | Stack: Next.js 15 + Supabase + ECharts | Most popular + matches ERP chart choice |
| 2026-06-06 | Design system from Plager ERP | Already-validated premium LATAM admin look |
| 2026-06-06 | Build with sample data first | Don't wait for client materials; productive parallelism |
| 2026-06-06 | NO Tremor / NO default shadcn theme | Both leak generic "template" aesthetics |
| 2026-06-06 | ECharts over Recharts | Recharts is the giveaway "AI dashboard" library |
| 2026-06-06 | Roboto + Poppins (not Inter) | Initial: Inter signals generic SaaS; Roboto + Poppins has the ERP weight |
| 2026-06-06 | Lexend (single typeface) replaces Roboto + Poppins | User feedback: Roboto+Poppins is the canonical AI dashboard pairing. Lexend is distinctive, designed for readability, less template-typical. Heading weight reduced from 700 to 600, tracking tightened from -0.01em to -0.02em. |
| 2026-06-06 | Background cream `#FAF6F1`, not white | Premium signal — flat white is the AI tell |
| 2026-06-06 | Custom hand-drawn SVG sidebar icons | Lucide icon dump is the #1 AI giveaway |

---

## Daily log

### 2026-06-06 (Session 1)

**Scouting**
- Scouted 5 workspace projects for reusable modules.
- Plager ERP at `joao-br-plager-erp-refactor/prototipo-erp` selected as design source — only premium-grade visual system in the workspace. Other projects (delivery, marketplace, consultoria) were scaffold-grade or domain-locked.
- Read source files: tailwind.config.ts, style.css, SideNav, TopBar, AppLayout, KPICard, Badge, PageHeader, Semaforo.

**Design system established**
- 16 color tokens documented (royal, coral, cream, paper, line, ink, slate, success/warn/danger/info + variants).
- Roboto + Poppins typography selected over Inter (rejects generic SaaS aesthetic).
- `.label-cap` utility, warm scrollbar, custom shadows (`card` / `cardHover`) defined.
- 12 anti-AI design principles documented.

**Project scaffolded**
- Created `rental-admin/` with full Next.js 15 + React 19 + Supabase + ECharts stack.
- Wrote 10 root files: package.json, tsconfig.json, next.config.ts, postcss.config.mjs, tailwind.config.ts (with all ported tokens), .gitignore, .env.local.example.
- Wrote `app/globals.css` with `:root` CSS variables, label-cap utility, warm scrollbar.
- Wrote `app/layout.tsx` with `next/font` Roboto + Poppins wired to CSS variables.

**Components ported (Vue → React)**
- `components/shell/SideNav.tsx` — royal blue sidebar, hand-drawn SVG icons (dashboard/contracts/payments/adjustments/reports), coral 3px active indicator, footer with administration metadata.
- `components/shell/TopBar.tsx` — cream search input, pendientes button with coral badge, coral avatar with user info.
- `components/ui/KPICard.tsx` — paper card with Poppins 32px number, tabular-nums, tone-colored delta.
- `components/ui/Badge.tsx` — 5 tones (success/warn/danger/info/neutral) with subtle tinted backgrounds.
- `components/ui/PageHeader.tsx` — Poppins 28px title, slate subtitle, actions slot via children prop.
- Semaforo skipped (low priority for Phase 1).

**Backend wiring**
- `lib/supabase/server.ts` — Server Component client using `@supabase/ssr` cookie integration.
- `lib/supabase/client.ts` — Browser client.
- `db/schema.sql` — 8 tables (administrations, bank_accounts, owners, tenants, contracts, payments, adjustments, cpi_values) with 5 performance indexes. Ready to paste into Supabase SQL Editor.

**App structure**
- `app/page.tsx` — redirects to `/dashboard`.
- `app/(app)/layout.tsx` — shell wrapper (SideNav + TopBar + content area with max-w-shell).
- `app/(app)/dashboard/page.tsx` — Panel principal with 4 sections:
  - KPI strip (4 cards: contracts active, expiring, late, weekly adjustments)
  - Saldos por banco table (4 Argentine banks, red shortfall flags via Badge)
  - Próximos ajustes IPC table (5 rows with current vs projected rent, info-tone cadence badges)
  - Inquilinos atrasados table (3 rows with days late in danger color, accumulated interest)
- All sample data uses realistic Argentine context: surnames Pérez/García/Romero/López/Fernández, real banks (Galicia/Santander/Macro/BBVA), peso-formatted with `toLocaleString('es-AR')`.

**Files written this session: 16**

### Next session priorities

1. **Verify the design renders** — run `npm install` in `rental-admin/`, then `npm run dev`, visit `localhost:3000`, confirm the sidebar/topbar/dashboard render as intended.
2. **Write `scripts/seed.ts`** — 40 realistic Argentine contracts populating Supabase. Stagger next_adjustment_date so 5 fall this week. Make 7 contracts late.
3. **Build login page** at `app/login/page.tsx` — cream background, Poppins title, royal primary button. No marketing copy.
4. **Add middleware** for auth gating — redirect unauthenticated users to `/login`.
5. **Wire dashboard to Supabase** — replace sample arrays with server-side queries via `createSupabaseServer()`.
6. **Port ECharts wrappers** — `useChartTheme`, BarHorizontal, DonutChart (for reports page later).

### Commands to run next

```powershell
cd c:\HSH\chatActive\alejandro-argentina-rental-ipc-automation\rental-admin
npm install
npm run dev
```

Then open http://localhost:3000 — should redirect to /dashboard and show the full panel.

### 2026-06-06 (Session 2)

**Verification of Session 1**
- `npm install`: 192 packages added in 2 minutes.
- `npm run dev`: Next.js 15.5.19 ready in 2.5s.
- `GET /` returns 307 → `/dashboard`.
- `GET /dashboard` returns 200 with all 4 sections present (KPI strip, saldos por banco, próximos ajustes, atrasados).

**Files added (7)**
- `scripts/seed.ts` — populates Supabase with 1 administration, 4 banks, 15 owners, 40 tenants, 40 contracts (5 due this week, 10 this month, 25 spread 1-6 months), ~280 historical payments + 7 current-month late, ~70 adjustment history rows, 17 INDEC IPC values from 2024-12 to 2026-04. Uses service-role key, bypasses RLS.
- `lib/dashboard/queries.ts` — server-side helpers: `getKpis`, `getUpcomingAdjustments`, `getBankPositions`, `getLateTenants`. Typed return shapes. **Not yet wired** into the dashboard page (kept as sample-array fallback so local demo continues to work without Supabase).
- `app/login/page.tsx` — cream background, Poppins 28px title, two form fields with focus:border-royal, royal primary button, danger-colored error message. Client component, calls `signInWithPassword`, redirects to /dashboard on success.
- `middleware.ts` — gate behind Supabase env vars: if `NEXT_PUBLIC_SUPABASE_URL` is missing, allow everything through (dev mode). When configured, redirects unauthenticated requests to `/login` and authenticated requests away from `/login`.
- `components/charts/theme.ts` — palette + chartBaseStyle ported; currency formatters adapted from BRL to ARS (`fmtCompactARS`, `fmtARS`).
- `components/charts/BarHorizontal.tsx` — React port using `echarts-for-react`, dynamic import with `ssr: false`. Coral bars, ARS-formatted axis labels.
- `components/charts/DonutChart.tsx` — React port. Center label with total in Poppins, supports compact mode.

**Verified**
- `GET /login`: 200, contains "Iniciar sesión", "Correo", "Ingresar".
- `GET /dashboard`: 200, still renders all 4 sections.

**Files written this session: 7**
**Total project files: 23**

### Supabase setup recipe (for next session)

When ready to switch from sample arrays to live data:

1. Sign up at supabase.com, create project in São Paulo region.
2. **SQL Editor** → paste contents of `rental-admin/db/schema.sql` → Run.
3. **Project Settings → API** → copy URL, anon key, service_role key into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
4. Seed: `npm run seed` — populates the DB.
5. **Authentication → Users → Add user** → create `alejandro@local.test` / a password.
6. Swap the dashboard page to use queries (the file already imports the helpers, just replace the const arrays):

   ```tsx
   // app/(app)/dashboard/page.tsx
   import { getKpis, getUpcomingAdjustments, getBankPositions, getLateTenants } from '@/lib/dashboard/queries'

   export default async function DashboardPage() {
     const [kpi, adjustments, banks, late] = await Promise.all([
       getKpis(),
       getUpcomingAdjustments(),
       getBankPositions(),
       getLateTenants(3),
     ])
     // ... render using these values instead of the const arrays
   }
   ```

7. Restart dev server. Visiting `/dashboard` now redirects to `/login`. Sign in, lands on dashboard with real Supabase data.

### Next session priorities

1. **Contracts pages** — list (`/contratos`) with search/filters + paginated table; detail (`/contratos/[id]`) with tabs (Detalles, Pagos, Historial de ajustes).
2. **IPC engine** — `lib/ipc-engine/compute.ts`, `lib/ipc-engine/indec-client.ts`. "Disparar ajuste" modal on contract detail.
3. **Payments page** with IN/OUT filters and late-tenant view.
4. **Sign-out button** on TopBar (server action calling `supabase.auth.signOut()`).
5. **Reports page** stub using BarHorizontal + DonutChart.

### 2026-06-06 (Session 3) — Chart-driven dashboard + kill the 404s

**Diagnosis: why the original dashboard underperformed**
- All four sections were tables → users had to read and calculate rather than glance and grasp.
- No visual hierarchy of urgency → every section visually screamed equally.
- No comparison or trend view → "is this month worse than last?" required separate analysis.
- Numbers without proportion → "$2.4M pendiente" looked alarming without the 16%-of-total context.
- Outliers were buried in rows → Banco Macro being 34% short was one cell among twenty.
- The chart components (BarHorizontal, DonutChart) were built in Session 2 but never deployed.

**Dashboard redesign**
- Replaced table-only layout with charts-on-top, tables-as-detail pattern.
- Row 1: Cobro del mes (donut with center % cobrado + breakdown legend) + Faltante por banco (horizontal bars highlighting Macro).
- Row 2: Atrasados por antigüedad (donut: 1-7d/8-15d/16+ buckets with urgency-graded colors) + Ajustes IPC próximos (royal bars per week).
- Detail tables below unchanged in content but framed as "detalle" with "más urgentes" badges.

**404 elimination — all sidebar routes now functional**
- `/contratos` — 4 KPIs + 2 donuts (distribución por cadencia, tipo de propiedad) + filter bar + 12-row contracts table with status badges.
- `/pagos` — 4 KPIs + horizontal bar (ingresos por mes, 6 months) + compact donut (estado de pagos) + tabbed movements table (IN/OUT colored).
- `/ajustes-ipc` — 4 KPIs (esta semana, próximos 30d, aplicados, IPC último) + royal bars (ajustes proyectados por mes) + table with factor + "Disparar" action.
- `/reportes` — 4-chart grid (cumplimiento por banco %, ingresos por banco, donut cadencia, donut tipo propiedad) + top-10 contratos horizontal bars.

**Component refactor — Server Component compatibility**
- Initial implementation passed function props (`valueFormatter={fmtCount(...)}`) → Next.js 500: "Functions cannot be passed directly to Client Components."
- Refactored BarHorizontal + DonutChart props: replaced `valueFormatter` (function) with declarative props:
  - `format?: 'currency' | 'percent' | 'integer'` (default currency)
  - `unit?: string` + `unitPlural?: string` (when set, renders as "N contratos")
- Formatter is built inside the client component, eliminating the Server→Client function boundary issue.

**Other fixes**
- SideNav Panel route was `/`, but app/page.tsx redirects to `/dashboard`. Active state never matched. Fixed: Panel `to: '/dashboard'`, simplified `isActive`.

**Files modified (4) + created (4)**
- Modified: SideNav.tsx, theme.ts (+ fmtInt + fmtCount helpers), BarHorizontal.tsx, DonutChart.tsx, dashboard/page.tsx.
- Created: contratos/page.tsx, pagos/page.tsx, ajustes-ipc/page.tsx, reportes/page.tsx.

**Verification**
```
/dashboard    -> 200 | 149 KB
/contratos    -> 200 | 142 KB
/pagos        -> 200 | 138 KB
/ajustes-ipc  -> 200 | 102 KB
/reportes     -> 200 | 120 KB
/login        -> 200 |  14 KB
```

All 6 routes serve 200 with real chart content rendered. Sidebar navigation now coherent — clicking any item lands on a populated, visual page.

**Total project files: 27**

### 2026-06-06 (Session 4) — Font swap to Lexend

User reviewed the dashboard and flagged the typography as AI-generated. Approved change A from the proposal (typography overhaul), specified Lexend.

**Changes**
- `app/layout.tsx`: replaced `Roboto` + `Poppins` imports with `Lexend` (weights 400, 500, 600, 700). Single variable `--font-lexend` applied to `<html>`.
- `tailwind.config.ts`: `font-sans` and `font-display` both map to `var(--font-lexend)`. Existing `font-display` class usages keep working.
- `app/globals.css`: body family + heading family both Lexend. Heading weight 700 → 600, tracking -0.01em → -0.02em.
- `components/charts/theme.ts`: `chartBaseStyle.textStyle.fontFamily` and tooltip text both `'Lexend, system-ui, sans-serif'`.
- `components/charts/DonutChart.tsx`: center label font 700 → 600, family Roboto/Poppins → Lexend.

**NOT changed** (deferred until user reviews Lexend live)
- B: PageHeader removal from /dashboard
- C: Inline page headers on other routes
- D: Interpunct (·) stripping
- E: Badge color noise reduction

**Verification**
- All 6 routes still serve 200.
- Layout CSS confirms `Google Fonts → Lexend` injected via Next.js font loader.
- `<html class="__variable_xxxxxx">` carries the Lexend variable globally.

User to review live and decide whether to approve any of B-E next.

### 2026-06-06 (Session 5) — Competitive audit + Tiers A+B+C applied

Triggered by user's question: "Is the content you currently created generated by analyzing data based on the maximum number of people?" Honest answer: no. The build to that point was based on (1) one reference codebase, (2) generic SaaS heuristics, (3) one client's input. User authorized a competitive audit.

**Audit performed** (30 min)
- Direct competitors researched: Barreeo, Ubiquo, Tokko Broker.
- Adjacent references: Galicia online banking UX case study (Aerolab), Roomix IPC calculator.
- Output: [COMPETITIVE_AUDIT.md](COMPETITIVE_AUDIT.md) with terminology gaps, missing domain concepts, and tiered recommendations.

**Key findings**
- We say "Ajustes IPC" / "Mora"; the market says "Aumentos" / "Punitorios".
- We have IPC general only; the market handles IPC + ICL + Casa Propia (DNU 70/2023 deregulated).
- We were missing **Expensas** (building expenses) and **Recibos** (receipts) — table stakes for Argentine inmobiliarias.
- Barreeo leads with "40 horas → 1 hora" — the market sells on TIME SAVED, not feature count.
- Galicia UX lesson: take brand to the background, group by workflow stages, reduce screens — validates removing the "Panel principal" hero card.

**User approved: all tiers (A + B + C)**

**Tier A — terminology and copy**
- SideNav: `/ajustes-ipc` → `/aumentos`; added `/recibos` 6th nav item with hand-drawn receipt icon.
- Old `/ajustes-ipc` page now redirects (307) to `/aumentos` to preserve any bookmarked URLs.
- New `/aumentos` page ports the prior /ajustes-ipc content but with index-aware columns (IPC / ICL / Casa Propia badges), action button labeled "Aplicar" instead of "Disparar".
- Dashboard: PageHeader "Panel principal" card REMOVED. Replaced with one-line context strip "Sábado 6 de junio · 12 acciones requieren atención" + "Junio 2026" label-cap on the right.
- Dashboard KPI position 1 changed from "Contratos activos" to **"Tiempo ahorrado"** ("32 hs — equivalente a 4 jornadas") — market emotional anchor per Barreeo's positioning.
- Dashboard: "Próximos ajustes IPC" → "Próximos aumentos" with new Índice column showing IPC/ICL badges.
- Dashboard atrasados table: "Interés acumulado" → "Punitorio acumulado".
- Aumentos page section title: "Aumentos proyectados por mes" (was "Ajustes proyectados").

**Tier B — missing domain concepts**
- `db/schema.sql`: added `expensas numeric(12,2) default 0` to contracts; added full `recibos` table with serie/numero/fecha/monto/concepto/estado + indexes.
- `scripts/seed.ts`: contracts get realistic expensas ($15K-$45K range); indexer now weighted distribution (65% IPC / 25% ICL / 10% Casa Propia); recibos seeded with 3 per contract for last 3 paid months (~120 rows).
- `/contratos`: added Expensas + Índice columns to the table. Sample data now shows IPC, ICL, Casa Propia variety.
- `/recibos`: new page with 4 KPIs (emitidos/monto/pendientes/último número), volumen mensual bar chart, and recent 10-row recibos table with Emitido/Anulado states.

**Tier C — credibility tiles**
- New section at bottom of dashboard: **"Próximas integraciones"** with 3 disabled-style tiles:
  - Portal inquilino
  - Recordatorios por WhatsApp
  - Factura electrónica ARCA
- Each carries a "Próximamente" Badge and a short description of what it'll do. Signals to administrators "we know this market".

**Tier D — explicitly deferred**
- Portal inquilino (full implementation)
- WhatsApp messaging integration
- ARCA AFIP factura electrónica
- ICL daily BCRA fetch

**Live verification**
```
/dashboard     -> 200 | 166 KB
/contratos     -> 200 | 148 KB
/pagos         -> 200 | 139 KB
/aumentos      -> 200 | 111 KB
/recibos       -> 200 | 101 KB
/reportes      -> 200 | 120 KB
/login         -> 200 |  14 KB
/ajustes-ipc   -> 307 redirect to /aumentos
```

**Files changed / created (8)**
- Modified: `components/shell/SideNav.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/contratos/page.tsx`, `app/(app)/ajustes-ipc/page.tsx` (now redirect), `db/schema.sql`, `scripts/seed.ts`.
- Created: `app/(app)/aumentos/page.tsx`, `app/(app)/recibos/page.tsx`.

**Total project files: 30 (+ COMPETITIVE_AUDIT.md at repo root)**

### What's still open
- The Supabase wiring is still on hold (sample data everywhere).
- Earlier proposed cleanup (interpunct stripping across all pages, badge color reduction) — was rolled into Tiers A+B+C only where it touched modified pages. Other pages still carry interpunct subtitles where they exist.
- Contracts list could be wired to query the indexer field once Supabase is connected.

### 2026-06-06 (Session 6) — Design overhaul: collapse palette, ink accent, kill chrome, redesign charts

User feedback: "the colors still have a strong AI feel" + "buttons feel template" + "charts look toy-like."

Five-layer overhaul applied — all approved at once.

**A. Palette collapsed**
- `Badge` rewritten: dropped info-blue, warn-orange tones. Only success / danger / neutral remain.
- New visual: text + 6px colored dot (Linear pattern). No more full-fill pills with backgrounds and borders.
- Where Badge was decorative (cadencia, índice on contratos and aumentos pages), removed Badge entirely → plain text.

**B. Accent swapped to near-black**
- `SideNav`: `bg-royal` (#4068d8) → `bg-ink` (#111111). Removed the coral 3px active indicator → simple `bg-paper/[0.08]` subtle highlight. Icons match label opacity, no separate coral state.
- `TopBar`: avatar circle was `bg-coral` → `bg-ink`. Pendientes badge was `bg-coral` → `bg-danger` (semantic for urgency).
- Input focus: `focus:border-royal` → `focus:border-ink`.

**C. Buttons redesigned**
- Primary: `bg-royal text-paper rounded-md hover:bg-royal-dark` → `bg-ink text-paper rounded-sm hover:opacity-90`. Sharper corners (2px), no color hover decoration.
- Inline table action ("Aplicar" in aumentos): converted from royal-button-style to plain text-link with underline-on-hover.
- Pagos tab buttons: collapsed from 3 outlined buttons to active/inactive text-style.

**D. Card chrome stripped**
- All `rounded-lg shadow-card overflow-hidden` patterns → `rounded overflow-hidden`. Border only, no shadow, sharper (4px) corners.
- `KPICard`: removed `shadow-card transition-shadow hover:shadow-cardHover`. Border-only, sharper corners. Heading weight 700 → 600 with tighter tracking.
- Login form: removed shadow, sharper corners.
- Phase 2 tiles on dashboard: removed `opacity-75`, replaced "Próximamente" Badge with plain small uppercase slate text.

**E. Charts redesigned for seriousness**
- `theme.ts`: added monoInk / monoSlate / monoRed / monoGreen single-hue palettes + accent constants.
- `BarHorizontal`: `barWidth` 18 → 10. Removed `borderRadius` (sharp corners). Default color → `accentInk` (near-black). Added `label.show: true, position: 'right'` so values render next to each bar in mono. Disabled balloon tooltip. Disabled animation. Removed xAxis ticks/labels entirely (cleaner).
- `DonutChart`: removed `padAngle: 2`, removed `borderRadius: 6`, removed `borderColor + borderWidth`, removed `animationType + Easing + Duration` (set `animation: false`), disabled `emphasis` hover scale. Tooltip disabled. Default palette → `monoInkPalette` (3 grey lightness levels).
- Dashboard `atrasadosAntiguedad` colors: 3-shade red mono progression `#F87171 → #DC2626 → #991B1B` (urgency by lightness).
- Dashboard `cobroMes` palette: `success / slate / danger` (3 semantic categories preserved).
- Contratos / Reportes `cadenciaDistribucion` + `tipoContrato`: 2-3 slate-mono shades instead of multi-blue/coral.
- Pagos `estadoPagos`: success / slate / danger.

**Files changed (15)**
- Components: `Badge.tsx` (rewrite), `KPICard.tsx` (rewrite), `SideNav.tsx` (rewrite), `TopBar.tsx` (rewrite), `theme.ts` (extended), `BarHorizontal.tsx` (rewrite), `DonutChart.tsx` (rewrite).
- Pages: `dashboard/page.tsx` (rewrite), `contratos/page.tsx` (7 edits), `pagos/page.tsx` (7 edits), `aumentos/page.tsx` (5 edits), `recibos/page.tsx` (6 edits), `reportes/page.tsx` (5 edits), `login/page.tsx` (3 edits).

**Live verification**
```
/dashboard    -> 200 | 155 KB
/contratos    -> 200 | 138 KB
/pagos        -> 200 | 140 KB
/aumentos     -> 200 |  96 KB
/recibos      -> 200 | 100 KB
/reportes     -> 200 | 124 KB
/login        -> 200 |  14 KB
```

All 7 routes serve clean. Visual signature now: cream background, ink-black sidebar, ink-black buttons, hairline-bordered cards, monochrome charts with value labels right-of-bars, dot-style badges in 3 tones only.
