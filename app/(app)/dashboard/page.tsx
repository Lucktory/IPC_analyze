// ============================================================================
// Panel ejecutivo — dark "executive" view. Four premium chart panels in a
// 2×2 grid: portfolio composition (top), trends (bottom). Replaces the
// older light-themed mixed-content dashboard with a focused visual brief.
// ============================================================================

import {
  getContractsByCadence,
  getPropertyTypeBreakdown,
  getMonthlyIncomeTrend,
  getOperationalTrends,
} from '@/lib/dashboard/queries'
import { getCurrentPeriodLabel } from '@/lib/period'
import { fmtMoney, fmtTime }     from '@/lib/format'
import { DashboardCard }    from '@/components/charts/panel/DashboardCard'
import { DonutPanel }       from '@/components/charts/panel/DonutPanel'
import { MonthlyBars }      from '@/components/charts/panel/MonthlyBars'
import { MultiLineArea }    from '@/components/charts/panel/MultiLineArea'
import { DeltaIndicator }   from '@/components/charts/panel/DeltaIndicator'
import { SeriesKpiStrip }   from '@/components/charts/panel/SeriesKpiStrip'
import { PREMIUM, PREMIUM_ROTATION } from '@/components/charts/theme'

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  vivienda: 'Vivienda',
  local:    'Local',
  cochera:  'Cochera',
  oficina:  'Oficina',
  deposito: 'Depósito',
}

export default async function DashboardPage() {
  const [propTypes, cadence, incomeTrend, opsTrend] = await Promise.all([
    getPropertyTypeBreakdown(),
    getContractsByCadence(),
    getMonthlyIncomeTrend(6),
    getOperationalTrends(6),
  ])

  const periodLabel = getCurrentPeriodLabel()

  // ── Panel 1: property type donut ──
  const propTypeItems = propTypes.map((p, i) => ({
    label: PROPERTY_TYPE_LABEL[p.type] ?? p.type,
    value: p.count,
    color: PREMIUM_ROTATION[i % PREMIUM_ROTATION.length],
  }))
  const propTypeTotal = propTypes.reduce((s, p) => s + p.count, 0)

  // ── Panel 2: contracts by cadence donut ──
  const cadenceItems = cadence.map((c, i) => ({
    label: c.label,
    value: c.count,
    color: PREMIUM_ROTATION[i % PREMIUM_ROTATION.length],
  }))
  const cadenceTotal = cadence.reduce((s, c) => s + c.count, 0)

  // ── Panel 3: monthly income bars + delta ──
  const incomePoints = incomeTrend.map(t => ({ label: t.label, value: t.value }))
  const incomeCurrent  = incomeTrend.at(-1)?.value ?? 0
  const incomePrevious = incomeTrend.at(-2)?.value ?? 0
  const incomeDelta    = incomeCurrent - incomePrevious
  const incomeTotal    = incomeTrend.reduce((s, t) => s + t.value, 0)

  // ── Panel 4: operational trends multi-line ──
  const opsLabels = opsTrend.map(t => t.label)
  const opsCurrent = opsTrend.at(-1)
  const opsSeries = [
    { name: 'Ingresos',   color: PREMIUM.gold,     values: opsTrend.map(t => t.ingresos),   format: 'currency' as const },
    { name: 'Comisiones', color: PREMIUM.emerald,  values: opsTrend.map(t => t.comisiones), format: 'currency' as const },
    { name: 'Pagos',      color: PREMIUM.amethyst, values: opsTrend.map(t => t.pagos),      format: 'integer'  as const },
  ]

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
        {/* Panel 1 — Propiedades por tipo (donut + side legend) */}
        <DashboardCard
          title="Propiedades por tipo"
          subtitle={`Distribución actual · ${propTypeTotal} propiedades`}
        >
          {propTypeItems.length > 0 ? (
            <DonutPanel items={propTypeItems} legendPosition="side" totalUnit="propiedades" />
          ) : (
            <EmptyState text="Sin propiedades cargadas" />
          )}
        </DashboardCard>

        {/* Panel 2 — Contratos por cadencia (donut + bottom legend) */}
        <DashboardCard
          title="Contratos por cadencia"
          subtitle={`Distribución actual · ${cadenceTotal} contratos activos`}
        >
          {cadenceItems.length > 0 ? (
            <DonutPanel items={cadenceItems} legendPosition="bottom" totalUnit="contratos" />
          ) : (
            <EmptyState text="Sin contratos activos" />
          )}
        </DashboardCard>

        {/* Panel 3 — Ingresos por mes (bar chart + delta) */}
        <DashboardCard
          title="Ingresos por mes"
          subtitle={`Últimos 6 meses · ${fmtMoney(incomeTotal)}`}
          topRight={<DeltaIndicator label="vs. mes anterior" delta={incomeDelta} currency />}
        >
          {incomePoints.some(p => p.value > 0) ? (
            <MonthlyBars points={incomePoints} color={PREMIUM.gold} format="currency" />
          ) : (
            <EmptyState text="Sin ingresos registrados" />
          )}
        </DashboardCard>

        {/* Panel 4 — Tendencia operativa (3-series area lines) */}
        <DashboardCard title="Tendencia operativa" subtitle="Últimos 6 meses">
          {opsCurrent ? (
            <>
              <SeriesKpiStrip
                items={[
                  { label: 'Ingresos',   color: PREMIUM.gold,     value: fmtMoney(opsCurrent.ingresos) },
                  { label: 'Comisiones', color: PREMIUM.emerald,  value: fmtMoney(opsCurrent.comisiones) },
                  { label: 'Pagos',      color: PREMIUM.amethyst, value: opsCurrent.pagos.toString() },
                ]}
              />
              <MultiLineArea xLabels={opsLabels} series={opsSeries} />
            </>
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
