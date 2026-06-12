// ============================================================================
// Panel ejecutivo — four panels that each answer one question at a glance.
//
//   1. Cobranza del mes      → "Did the rents come in this month?"
//   2. Atención requerida    → "What do I need to do this week?"
//   3. Ingresos por mes      → "How is revenue trending?"
//   4. Tendencia operativa   → "What's the operational momentum?"
//
// Portfolio inventory (property types, contract cadence, …) intentionally
// does NOT live here — those drive decisions on /propiedades and /contratos.
// The dashboard is purely situational awareness.
// ============================================================================

import {
  getMonthlyIncomeTrend,
  getOperationalTrends,
  getCollectionHealth,
} from '@/lib/dashboard/queries'
import { listPendingActions }    from '@/lib/pending/queries'
import { getCurrentPeriodLabel } from '@/lib/period'
import { fmtMoney, fmtTime }     from '@/lib/format'
import { DashboardCard }            from '@/components/charts/panel/DashboardCard'
import { CollectionHealthCard }     from '@/components/charts/panel/CollectionHealthCard'
import { ActionableBreakdown }      from '@/components/charts/panel/ActionableBreakdown'
import { MonthlyBars }              from '@/components/charts/panel/MonthlyBars'
import { SparklineGroup }           from '@/components/charts/panel/SparklineGroup'
import { DeltaIndicator }           from '@/components/charts/panel/DeltaIndicator'
import { PREMIUM }                  from '@/components/charts/theme'

/** % change from `from` to `to`. Returns null when the base is zero so we
 *  don't render misleading "∞%" trends. */
function pctChange(from: number, to: number): number | null {
  if (from === 0) return null
  return ((to - from) / from) * 100
}

export default async function DashboardPage() {
  const [collection, pending, incomeTrend, opsTrend] = await Promise.all([
    getCollectionHealth(),
    listPendingActions(),
    getMonthlyIncomeTrend(6),
    getOperationalTrends(6),
  ])

  const periodLabel = getCurrentPeriodLabel()

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
        {/* Panel 1 — Cobranza del mes (collection health) */}
        <DashboardCard
          title="Cobranza del mes"
          subtitle="¿Llegaron los alquileres este período?"
        >
          {collection.totalContracts > 0 ? (
            <CollectionHealthCard data={collection} />
          ) : (
            <EmptyState text="Sin contratos activos para evaluar" />
          )}
        </DashboardCard>

        {/* Panel 2 — Atención requerida (pendientes breakdown) */}
        <DashboardCard
          title="Atención requerida"
          subtitle="Acciones que necesitan tu intervención esta semana"
        >
          <ActionableBreakdown counts={pending.counts} />
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
