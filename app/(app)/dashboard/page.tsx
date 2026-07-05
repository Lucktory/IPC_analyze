// ============================================================================
// Panel ejecutivo — redesigned to the 2026-07 mockup: a KPI row (4 cards with
// sparkline + delta) over two rows of 3 chart cards. Every number is wired to
// the real dashboard queries; colors come from the global tokens / chart theme.
// ============================================================================

import { Info, ArrowUp, ArrowDown, Calendar } from 'lucide-react'
import {
  getDashboardKpis,
  getCommissionByDestination,
  getTopLandlords,
  getPropertyTypeBreakdown,
  getContractsByCadence,
  getMonthlyIncomeTrend,
  getOperationalTrends,
  getCollectionHealth,
  getDashboardPeriod,
} from '@/lib/dashboard/queries'
import { periodLabel } from '@/lib/period'
import { fmtMoney } from '@/lib/format'
import { fmtCompactARS } from '@/components/charts/theme'
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

export default async function DashboardPage() {
  // Resolve the period ONCE (latest month with data, e.g. June) so every
  // widget agrees — otherwise a fresh current month shows an empty Panel.
  const dashPeriod = await getDashboardPeriod()
  const [kpis, commByBank, topLandlords, propTypes, cadence, incomeTrend, opTrends, health] = await Promise.all([
    getDashboardKpis(dashPeriod),
    getCommissionByDestination(dashPeriod),
    getTopLandlords(5, dashPeriod),
    getPropertyTypeBreakdown(),
    getContractsByCadence(),
    getMonthlyIncomeTrend(6, dashPeriod),
    getOperationalTrends(6, dashPeriod),
    getCollectionHealth(dashPeriod),
  ])

  const period = periodLabel(dashPeriod)

  // KPI deltas + sparkline series from the trend queries
  const incomeVals = incomeTrend.map(p => p.value)
  const commVals   = opTrends.map(p => p.comisiones)
  const n = incomeVals.length
  const incomeDelta = n >= 2 ? pctChange(incomeVals[n - 1], incomeVals[n - 2]) : null
  const m = commVals.length
  const commDelta   = m >= 2 ? pctChange(commVals[m - 1], commVals[m - 2]) : null

  const morosidadPct = health.expectedAmount > 0 ? (health.pendingAmount / health.expectedAmount) * 100 : 0
  const saludPct     = Math.round(health.collectionRateByAmount)
  const saludStatus: 'ok' | 'warning' | 'critical' = saludPct >= 80 ? 'ok' : saludPct >= 50 ? 'warning' : 'critical'

  // Donut / bar items
  const commItems     = commByBank.map((b, i) => ({ label: b.label, value: b.total, color: ROTATION[i % ROTATION.length] }))
  const propItems     = propTypes.map((p, i) => ({ label: p.type, value: p.count, color: ROTATION[i % ROTATION.length] }))
  const landlordItems = topLandlords.map(l => ({ label: l.name, value: l.revenue, color: BLUE }))
  const cadenceTotal  = cadence.reduce((s, c) => s + c.count, 0)

  return (
    // Full-height, no page scroll: header + KPIs are fixed; the two chart rows
    // share the remaining height (grid-rows-2) so every widget fits one screen
    // from 1024x768 up and grows on taller/wider viewports.
    <div className="h-full flex flex-col gap-2.5 min-h-0">
      <header className="flex items-baseline gap-3 shrink-0">
        <h1 className="text-[20px] font-semibold text-ink">Panel</h1>
        <p className="text-[13px] text-slate">{period}</p>
      </header>

      {/* KPI row — 2-up on small, 4-up from lg (1024px) */}
      <section className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiCard label="Contratos activos" value={kpis.activeContracts.toLocaleString('es-AR')}
                 delta={null} sparkColor={BLUE} />
        <KpiCard label="Ingresos del mes" value={fmtMoney(kpis.monthlyIncome)}
                 delta={incomeDelta} spark={incomeVals} sparkColor={BLUE} />
        <KpiCard label="Comisión" value={fmtMoney(kpis.monthlyCommission)}
                 delta={commDelta} spark={commVals} sparkColor={EMERALD} />
        <KpiCard label="Morosidad" value={`${morosidadPct.toFixed(1).replace('.', ',')}%`}
                 delta={null} sparkColor={RED} negativeIsBad={false} />
      </section>

      {/* Two chart rows share the leftover height */}
      <div className="flex-1 min-h-0 grid grid-rows-2 gap-2.5">
        {/* Row 2 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 min-h-0">
          <DashboardCard title="Tendencia de ingresos" subtitle="Últimos 6 meses" fill>
            <StackedAreaChart
              xLabels={incomeTrend.map(p => p.label)}
              series={[{ name: 'Ingresos (ARS)', color: BLUE, values: incomeVals }]}
              height="100%"
            />
          </DashboardCard>

          <DashboardCard title="Comisión por banco" fill>
            <DonutPanel items={commItems} totalUnit="Total" fill
                        centerText={fmtCompactARS(commItems.reduce((s, i) => s + i.value, 0)).replace('$ ', '')} />
          </DashboardCard>

          <DashboardCard title="Top propietarios" fill>
            <div className="h-full flex flex-col justify-center">
              <SortedHorizontalBars items={landlordItems} totalUnit="" />
            </div>
          </DashboardCard>
        </section>

        {/* Row 3 */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 min-h-0">
          <DashboardCard title="Tipo de propiedad" fill>
            <DonutPanel items={propItems} totalUnit="Total" fill />
          </DashboardCard>

          <DashboardCard title="Cadencia" fill>
            <div className="h-full flex flex-col justify-between">
              <CadenceRows items={cadence.map(c => ({ label: c.label, count: c.count }))} total={cadenceTotal} />
              <div className="mt-3 pt-2.5 border-t border-line flex justify-between text-[12px] text-slate shrink-0">
                <span>Total</span>
                <span className="tabular-nums text-ink">{cadenceTotal} · 100%</span>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard title="Salud de cobranza" fill>
            <div className="h-full flex items-center gap-4">
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
