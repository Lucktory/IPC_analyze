// ============================================================================
// Panel ejecutivo — four-card visual brief of the rental portfolio.
//
// Each card uses a chart format chosen for the data shape, not for variety:
//   1. CompositionBar       — single stacked bar for "Propiedades por tipo".
//      Donuts hide composition at small sizes; a single bar is denser.
//   2. SortedHorizontalBars — one bar per cadence, sorted. Cadences have
//      implicit ordering (mensual → anual) that a donut can't show.
//   3. MonthlyBars + avg    — vertical bars with a dashed average line and
//      per-bar value tags so "above/below trend" reads at a glance.
//   4. SparklineGroup       — three small-multiples, each with its own y-scale.
//      Ingresos, comisiones, and pagos have wildly different magnitudes;
//      sharing an axis flattens the small one to a flat line.
// ============================================================================

import {
  getContractsByCadence,
  getPropertyTypeBreakdown,
  getMonthlyIncomeTrend,
  getOperationalTrends,
} from '@/lib/dashboard/queries'
import { getCurrentPeriodLabel } from '@/lib/period'
import { fmtMoney, fmtTime }     from '@/lib/format'
import { DashboardCard }            from '@/components/charts/panel/DashboardCard'
import { CompositionBar }           from '@/components/charts/panel/CompositionBar'
import { SortedHorizontalBars }     from '@/components/charts/panel/SortedHorizontalBars'
import { MonthlyBars }              from '@/components/charts/panel/MonthlyBars'
import { SparklineGroup }           from '@/components/charts/panel/SparklineGroup'
import { DeltaIndicator }           from '@/components/charts/panel/DeltaIndicator'
import { PREMIUM, PREMIUM_ROTATION } from '@/components/charts/theme'

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  vivienda: 'Vivienda',
  local:    'Local',
  cochera:  'Cochera',
  oficina:  'Oficina',
  deposito: 'Depósito',
}

/** % change from `from` to `to`. Returns null when the base is zero so we
 *  don't render misleading "∞%" trends. */
function pctChange(from: number, to: number): number | null {
  if (from === 0) return null
  return ((to - from) / from) * 100
}

export default async function DashboardPage() {
  const [propTypes, cadence, incomeTrend, opsTrend] = await Promise.all([
    getPropertyTypeBreakdown(),
    getContractsByCadence(),
    getMonthlyIncomeTrend(6),
    getOperationalTrends(6),
  ])

  const periodLabel = getCurrentPeriodLabel()

  // ── Panel 1: composition bar — propiedades por tipo ──
  const propTypeItems = propTypes.map((p, i) => ({
    label: PROPERTY_TYPE_LABEL[p.type] ?? p.type,
    value: p.count,
    color: PREMIUM_ROTATION[i % PREMIUM_ROTATION.length],
  }))
  const propTypeTotal = propTypes.reduce((s, p) => s + p.count, 0)

  // ── Panel 2: sorted horizontal bars — contratos por cadencia ──
  const cadenceItems = cadence.map((c, i) => ({
    label: c.label,
    value: c.count,
    color: PREMIUM_ROTATION[i % PREMIUM_ROTATION.length],
  }))
  const cadenceTotal = cadence.reduce((s, c) => s + c.count, 0)

  // ── Panel 3: monthly income bars + dashed avg line ──
  const incomePoints   = incomeTrend.map(t => ({ label: t.label, value: t.value }))
  const incomeCurrent  = incomeTrend.at(-1)?.value ?? 0
  const incomePrevious = incomeTrend.at(-2)?.value ?? 0
  const incomeDelta    = incomeCurrent - incomePrevious
  const incomeTotal    = incomeTrend.reduce((s, t) => s + t.value, 0)

  // ── Panel 4: 3 sparklines, each with its own scale ──
  const opsFirst   = opsTrend.at(0)
  const opsCurrent = opsTrend.at(-1)
  const opsLabels  = opsTrend.map(t => t.label)
  const sparkSeries = opsCurrent && opsFirst ? [
    {
      label:     'Ingresos',
      color:     PREMIUM.gold,
      current:   fmtMoney(opsCurrent.ingresos),
      changePct: pctChange(opsFirst.ingresos, opsCurrent.ingresos),
      values:    opsTrend.map(t => t.ingresos),
    },
    {
      label:     'Comisiones',
      color:     PREMIUM.emerald,
      current:   fmtMoney(opsCurrent.comisiones),
      changePct: pctChange(opsFirst.comisiones, opsCurrent.comisiones),
      values:    opsTrend.map(t => t.comisiones),
    },
    {
      label:     'Pagos del mes',
      color:     PREMIUM.amethyst,
      current:   opsCurrent.pagos.toLocaleString('es-AR'),
      changePct: pctChange(opsFirst.pagos, opsCurrent.pagos),
      values:    opsTrend.map(t => t.pagos),
    },
  ] : []

  return (
    <>
      <header className="mb-6">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <p className="label-cap text-slate">Panel ejecutivo</p>
            <h1 className="font-display text-[22px] font-medium text-ink mt-1">{periodLabel}</h1>
          </div>
          <p className="text-[11px] text-slate tabular-nums">
            Actualizado · {fmtTime(new Date())}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Panel 1 — Propiedades por tipo (composition bar) */}
        <DashboardCard
          title="Propiedades por tipo"
          subtitle={`Distribución actual · ${propTypeTotal} propiedades`}
        >
          {propTypeItems.length > 0 ? (
            <CompositionBar items={propTypeItems} totalUnit="propiedades" />
          ) : (
            <EmptyState text="Sin propiedades cargadas" />
          )}
        </DashboardCard>

        {/* Panel 2 — Contratos por cadencia (sorted horizontal bars) */}
        <DashboardCard
          title="Contratos por cadencia"
          subtitle={`Distribución actual · ${cadenceTotal} contratos activos`}
        >
          {cadenceItems.length > 0 ? (
            <SortedHorizontalBars items={cadenceItems} totalUnit="contratos" />
          ) : (
            <EmptyState text="Sin contratos activos" />
          )}
        </DashboardCard>

        {/* Panel 3 — Ingresos por mes (bars + avg reference line + value tags) */}
        <DashboardCard
          title="Ingresos por mes"
          subtitle={`Últimos 6 meses · ${fmtMoney(incomeTotal)}`}
          topRight={<DeltaIndicator label="vs. mes anterior" delta={incomeDelta} currency />}
        >
          {incomePoints.some(p => p.value > 0) ? (
            <MonthlyBars
              points={incomePoints}
              color={PREMIUM.gold}
              format="currency"
              showAverage
              showValueTags
            />
          ) : (
            <EmptyState text="Sin ingresos registrados" />
          )}
        </DashboardCard>

        {/* Panel 4 — Tendencia operativa (3 sparklines, independent scales) */}
        <DashboardCard title="Tendencia operativa" subtitle="Últimos 6 meses · cada serie tiene su propia escala">
          {sparkSeries.length > 0 ? (
            <SparklineGroup series={sparkSeries} xLabels={opsLabels} />
          ) : (
            <EmptyState text="Sin movimientos registrados" />
          )}
        </DashboardCard>
      </div>
    </>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-[13px] text-slate">{text}</p>
    </div>
  )
}
