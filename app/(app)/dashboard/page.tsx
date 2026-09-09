// ============================================================================
// Panel ejecutivo — redesigned to the 2026-07 mockup: a KPI row (4 cards with
// sparkline + delta) over two rows of 3 chart cards. Every number is wired to
// the real dashboard queries; colors come from the global tokens / chart theme.
// ============================================================================

import { Info, ArrowUp, ArrowDown, Calendar } from 'lucide-react'
import {
  getDashboardKpis,
  getTopLandlords,
  getPropertyTypeBreakdown,
  getContractsByCadence,
  getMonthlyIncomeTrend,
  getOperationalTrends,
  getCollectionHealth,
  getDashboardPeriod,
  getPeriodsWithData,
} from '@/lib/dashboard/queries'
import { buildPeriodTabs } from '@/lib/period'
import { fmtMoney, fmtInt } from '@/lib/format'
import { PeriodSelect }         from '@/components/charts/panel/PeriodSelect'
import { DashboardCard }        from '@/components/charts/panel/DashboardCard'
import { DonutPanel }           from '@/components/charts/panel/DonutPanel'
import { RadialGauge }          from '@/components/charts/panel/RadialGauge'
import { SortedHorizontalBars } from '@/components/charts/panel/SortedHorizontalBars'
import { StackedAreaChart }     from '@/components/charts/panel/StackedAreaChart'

// Chart hues — match the theme's blue / emerald / violet / amber rotation.
const BLUE = '#3B82F6', EMERALD = '#34D399', VIOLET = '#8B5CF6', AMBER = '#F59E0B', RED = '#EF4444'
const ROTATION = [BLUE, EMERALD, VIOLET, AMBER, '#60A5FA', '#94A3B8']

function pctChange(curr: number, prev: number): number | null {
  if (!isFinite(prev) || prev === 0) return null
  return ((curr - prev) / prev) * 100
}

// ── Tiny inline sparkline (SVG, no deps) ────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const w = 120, h = 40, pad = 4
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const xy = (v: number, i: number): [number, number] => [
    pad + (i / (values.length - 1)) * (w - 2 * pad),
    h - pad - ((v - min) / range) * (h - 2 * pad),
  ]
  const pts = values.map(xy).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = xy(values[values.length - 1], values.length - 1)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2}
                strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
      <circle cx={lx} cy={ly} r={2.6} fill={color} />
    </svg>
  )
}

// ── KPI card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, delta, deltaSuffix = '%', negativeIsBad = true, spark, sparkColor }: {
  label: string; value: string; delta: number | null; deltaSuffix?: string
  negativeIsBad?: boolean; spark?: number[]; sparkColor: string
}) {
  const up = (delta ?? 0) >= 0
  // For "morosidad" (negativeIsBad=false) an increase is BAD → red.
  const good = negativeIsBad ? up : !up
  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3.5 flex flex-col gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate min-w-0">
        <span className="truncate">{label}</span><Info size={13} className="text-slate/70 shrink-0" />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-[19px] xl:text-[22px] font-semibold text-ink leading-none tabular-nums truncate">{value}</div>
        {spark && <div className="hidden xl:block shrink-0"><Sparkline values={spark} color={sparkColor} /></div>}
      </div>
      {delta != null ? (
        <div className="flex items-center gap-1.5 text-[12px]">
          <span className={`inline-flex items-center gap-0.5 font-medium ${good ? 'text-success' : 'text-danger'}`}>
            {up ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            {Math.abs(delta).toFixed(1)}{deltaSuffix}
          </span>
          <span className="text-slate">vs. mes anterior</span>
        </div>
      ) : <div className="text-[12px] text-slate">&nbsp;</div>}
    </div>
  )
}

// ── Cadence progress rows ───────────────────────────────────────────────────
function CadenceRows({ items, total }: { items: { label: string; count: number }[]; total: number }) {
  return (
    <div className="flex flex-col gap-2.5 pt-0.5">
      {items.map((it, i) => {
        const pct = total > 0 ? (it.count / total) * 100 : 0
        return (
          <div key={it.label} className="flex items-center gap-3 text-[13px]">
            <Calendar size={15} className="text-slate shrink-0" />
            <span className="w-20 text-ink">{it.label}</span>
            <div className="flex-1 h-2 rounded-full bg-cream-2 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ROTATION[i % ROTATION.length] }} />
            </div>
            <span className="w-9 text-right tabular-nums text-ink">{it.count}</span>
            <span className="w-12 text-right tabular-nums text-slate">{pct.toFixed(1).replace('.', ',')}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Legend rows (Salud de cobranza) ─────────────────────────────────────────
function LegendRows({ rows }: { rows: { label: string; amount: number; pct: number; color: string }[] }) {
  return (
    <div className="flex flex-col gap-2.5 text-[13px] w-full">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
          <span className="flex-1 text-ink">{r.label}</span>
          <span className="tabular-nums text-slate-dark">{fmtMoney(r.amount)}</span>
          <span className="w-12 text-right tabular-nums text-slate">{r.pct.toFixed(1).replace('.', ',')}%</span>
        </div>
      ))}
    </div>
  )
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams
  // Default to the latest month WITH data (e.g. June); ?period=YYYY-MM-01 from
  // the month selector overrides it. Every widget keys off this one period.
  const [latestPeriod, dataPeriods] = await Promise.all([getDashboardPeriod(), getPeriodsWithData()])
  const validReq = sp.period && /^\d{4}-\d{2}-01$/.test(sp.period) ? sp.period : null
  const dashPeriod = validReq ?? latestPeriod
  const selectorPeriods = buildPeriodTabs(dataPeriods, dashPeriod, 3)

  const [kpis, topLandlords, propTypes, cadence, incomeTrend, opTrends, health] = await Promise.all([
    getDashboardKpis(dashPeriod),
    getTopLandlords(5, dashPeriod),
    getPropertyTypeBreakdown(),
    getContractsByCadence(),
    getMonthlyIncomeTrend(6, dashPeriod),
    getOperationalTrends(6, dashPeriod),
    getCollectionHealth(dashPeriod),
  ])

  // KPI deltas + sparkline series from the trend queries
  const incomeVals = incomeTrend.map(p => p.value)
  const commVals   = opTrends.map(p => p.comisiones)
  const honVals    = opTrends.map(p => p.honorarios)
  // Current-month split for the "Ingresos de la inmobiliaria" footer — the
  // last trend point is the selected period, so the chart's last point and
  // the footer totals agree.
  const lastOp     = opTrends[opTrends.length - 1]
  const currAdm    = lastOp?.comisiones ?? 0
  const currHon    = lastOp?.honorarios ?? 0
  const n = incomeVals.length
  const incomeDelta = n >= 2 ? pctChange(incomeVals[n - 1], incomeVals[n - 2]) : null
  const m = commVals.length
  const commDelta   = m >= 2 ? pctChange(commVals[m - 1], commVals[m - 2]) : null

  const morosidadPct = health.expectedAmount > 0 ? (health.pendingAmount / health.expectedAmount) * 100 : 0
  // Cap at 100% — a messy historical month can have RENT_IN > current rent roll
  // (duplicate/legacy rows), which would otherwise render a >100% gauge.
  const saludPct     = Math.min(100, Math.round(health.collectionRateByAmount))
  const saludStatus: 'ok' | 'warning' | 'critical' = saludPct >= 80 ? 'ok' : saludPct >= 50 ? 'warning' : 'critical'

  // Donut / bar items
  const propItems     = propTypes.map((p, i) => ({ label: p.type, value: p.count, color: ROTATION[i % ROTATION.length] }))
  const landlordItems = topLandlords.map(l => ({ label: l.name, value: l.revenue, color: BLUE }))
  const cadenceTotal  = cadence.reduce((s, c) => s + c.count, 0)

  return (
    // At lg+ the Panel fills the viewport with NO page scroll: header + KPIs are
    // fixed and the two chart rows share the leftover height (grid-rows-2) so
    // every widget fits one screen from 1024x768 up and grows on bigger screens.
    // Below lg it falls back to a normal vertical scroll (charts get a fixed
    // height) so nothing collapses / overlaps on small screens.
    <div className="flex flex-col gap-2.5 lg:h-full lg:min-h-0">
      <header className="flex items-center justify-between gap-3 shrink-0">
        <h1 className="text-[20px] font-semibold text-ink">Panel</h1>
        <PeriodSelect current={dashPeriod} periods={selectorPeriods} />
      </header>

      {/* KPI row — 2-up on small, 4-up from lg (1024px) */}
      <section className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiCard label="Contratos activos" value={fmtInt(kpis.activeContracts)}
                 delta={null} sparkColor={BLUE} />
        <KpiCard label="Ingresos del mes" value={fmtMoney(kpis.monthlyIncome)}
                 delta={incomeDelta} spark={incomeVals} sparkColor={BLUE} />
        <KpiCard label="Comisión" value={fmtMoney(kpis.monthlyCommission)}
                 delta={commDelta} spark={commVals} sparkColor={EMERALD} />
        <KpiCard label="Morosidad" value={`${morosidadPct.toFixed(1).replace('.', ',')}%`}
                 delta={null} sparkColor={RED} negativeIsBad={false} />
      </section>

      {/* Two chart rows: stacked+scroll below lg, share leftover height at lg+ */}
      <div className="flex flex-col gap-2.5 lg:flex-1 lg:min-h-0 lg:grid lg:grid-rows-2">
        {/* Row 2 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 lg:min-h-0">
          <DashboardCard title="Tendencia de ingresos" subtitle="Últimos 6 meses" fill>
            <div className="h-[180px] lg:h-full">
              <StackedAreaChart
                xLabels={incomeTrend.map(p => p.label)}
                series={[{ name: 'Ingresos (ARS)', color: BLUE, values: incomeVals }]}
                height="100%"
              />
            </div>
          </DashboardCard>

          {/* Ingresos de la inmobiliaria — Administración (comisión mensual) +
              Honorarios (fee de alquiler, one-time) juntos, en distintos
              colores, over the last 6 months. Per Alejandro: "en el dashboard
              podemos unirlo con administraciones con distintos colores." The
              footer shows the current-month split + total. */}
          <DashboardCard title="Ingresos de la inmobiliaria" subtitle="Administración + Honorarios · 6 meses" fill>
            <div className="lg:h-full flex flex-col">
              <div className="h-[150px] lg:flex-1 lg:min-h-0">
                <StackedAreaChart
                  xLabels={opTrends.map(p => p.label)}
                  series={[
                    { name: 'Administración', color: EMERALD, values: commVals },
                    { name: 'Honorarios',     color: VIOLET,  values: honVals },
                  ]}
                  height="100%"
                />
              </div>
              <div className="mt-2 pt-2 border-t border-line flex items-center justify-between gap-2 text-[12px] shrink-0">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: EMERALD }} />
                  <span className="text-slate">Adm.</span>
                  <span className="tabular-nums text-ink truncate">{fmtMoney(currAdm)}</span>
                </span>
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: VIOLET }} />
                  <span className="text-slate">Hon.</span>
                  <span className="tabular-nums text-ink truncate">{fmtMoney(currHon)}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-slate">Total</span>
                  <span className="tabular-nums font-semibold text-ink">{fmtMoney(currAdm + currHon)}</span>
                </span>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard title="Top propietarios" fill>
            <div className="lg:h-full flex flex-col lg:justify-center">
              <SortedHorizontalBars items={landlordItems} totalUnit="" valueFormat="compact" />
            </div>
          </DashboardCard>
        </section>

        {/* Row 3 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 lg:min-h-0">
          <DashboardCard title="Tipo de propiedad" fill>
            <div className="h-[180px] lg:h-full">
              <DonutPanel items={propItems} totalUnit="Total" fill />
            </div>
          </DashboardCard>

          <DashboardCard title="Cadencia" fill>
            <div className="lg:h-full flex flex-col lg:justify-between">
              <CadenceRows items={cadence.map(c => ({ label: c.label, count: c.count }))} total={cadenceTotal} />
              <div className="mt-3 pt-2.5 border-t border-line flex justify-between text-[12px] text-slate shrink-0">
                <span>Total</span>
                <span className="tabular-nums text-ink">{cadenceTotal} · 100%</span>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard title="Salud de cobranza" fill>
            <div className="lg:h-full flex items-center gap-4">
              <div className="shrink-0 w-[130px] sm:w-[150px]"><RadialGauge pct={saludPct} status={saludStatus} /></div>
              <div className="flex-1 min-w-0">
                <LegendRows rows={[
                  { label: 'Pagada',    amount: health.collectedAmount, pct: health.collectionRateByAmount,       color: EMERALD },
                  { label: 'Pendiente', amount: health.pendingAmount,   pct: 100 - health.collectionRateByAmount, color: RED },
                ]} />
              </div>
            </div>
          </DashboardCard>
        </section>
      </div>
    </div>
  )
}
