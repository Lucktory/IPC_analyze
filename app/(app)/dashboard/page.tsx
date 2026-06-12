// ============================================================================
// Panel ejecutivo — five charts, one chart family each, 12-col bento layout.
//
// Layout (desktop, xl breakpoint):
//   ┌──────────────┬──────────────┬──────────────┐
//   │ Cobranza     │ Pendientes   │ Sparklines   │
//   │ Radial gauge │ Donut        │ Multi-line   │
//   │ (4 cols)     │ (4 cols)     │ (4 cols)     │
//   ├──────────────┴──────────────┼──────────────┤
//   │ Ingresos & Comisiones       │ Concentración│
//   │ Stacked-area lines          │ Treemap      │
//   │ (8 cols)                    │ (4 cols)     │
//   └─────────────────────────────┴──────────────┘
//
// Responsive:
//   mobile  (default)  → 1 column, all five cards stacked
//   tablet  (md)       → 2 columns; row 1 splits Cobranza/Pendientes,
//                        the other three cards take full width below
//   desktop (xl)       → the 12-col bento above
// ============================================================================

import Link from 'next/link'
import {
  getCollectionHealth,
  getMonthlyIncomeTrend,
  getOperationalTrends,
  getTopLandlords,
} from '@/lib/dashboard/queries'
import { listPendingActions } from '@/lib/pending/queries'
import { getCurrentPeriodLabel } from '@/lib/period'
import { fmtMoney, fmtTime } from '@/lib/format'
import { DashboardCard }    from '@/components/charts/panel/DashboardCard'
import { RadialGauge }      from '@/components/charts/panel/RadialGauge'
import { DonutPanel }       from '@/components/charts/panel/DonutPanel'
import { SparklineGroup }   from '@/components/charts/panel/SparklineGroup'
import { StackedAreaChart } from '@/components/charts/panel/StackedAreaChart'
import { TreemapChart }     from '@/components/charts/panel/TreemapChart'
import { PREMIUM }          from '@/components/charts/theme'

// CSS variable string literals — for chart series colors we need real CSS
// values, not Tailwind class names, since these get passed to ECharts /
// inline style props.
const CSS = {
  danger:  'rgb(var(--color-danger))',
  warn:    'rgb(var(--color-warn))',
  info:    'rgb(var(--color-info))',
  success: 'rgb(var(--color-success))',
}

/** % change from `from` to `to`. Returns null when the base is zero so we
 *  don't render misleading "∞%" trends. */
function pctChange(from: number, to: number): number | null {
  if (from === 0) return null
  return ((to - from) / from) * 100
}

export default async function DashboardPage() {
  const [collection, pending, incomeTrend, opsTrend, topLandlords] = await Promise.all([
    getCollectionHealth(),
    listPendingActions(),
    getMonthlyIncomeTrend(6),
    getOperationalTrends(6),
    getTopLandlords(8),
  ])

  const periodLabel = getCurrentPeriodLabel()

  // ── Cobranza delta vs previous month (from amount trend) ──
  const incomeCurrent  = incomeTrend.at(-1)?.value ?? 0
  const incomePrevious = incomeTrend.at(-2)?.value ?? 0
  const incomeDelta    = incomeCurrent - incomePrevious
  const incomeDeltaPct = pctChange(incomePrevious, incomeCurrent)

  // ── Pendientes donut data ──
  const pendientesItems = [
    { label: 'Cobranza vencida', value: pending.counts.cobranza,   color: CSS.danger },
    { label: 'Aviso de aumento', value: pending.counts.aumento,    color: CSS.warn   },
    { label: 'Renovación',       value: pending.counts.renovacion, color: CSS.info   },
  ].filter(i => i.value > 0)

  // ── Sparklines: three operational metrics derived from the trend rows ──
  const opsFirst   = opsTrend.at(0)
  const opsCurrent = opsTrend.at(-1)
  const opsLabels  = opsTrend.map(t => t.label)

  const pagosSeries        = opsTrend.map(t => t.pagos)
  const avgRentSeries      = opsTrend.map(t => t.pagos > 0 ? t.ingresos / t.pagos : 0)
  const commissionPctSeries = opsTrend.map(t => t.ingresos > 0 ? (t.comisiones / t.ingresos) * 100 : 0)

  const sparkSeries = (opsFirst && opsCurrent) ? [
    {
      label:     '# Pagos del mes',
      color:     PREMIUM.amethyst,
      current:   opsCurrent.pagos.toLocaleString('es-AR'),
      changePct: pctChange(opsFirst.pagos, opsCurrent.pagos),
      values:    pagosSeries,
    },
    {
      label:     'Promedio por pago',
      color:     PREMIUM.gold,
      current:   fmtMoney(avgRentSeries.at(-1) ?? 0),
      changePct: pctChange(avgRentSeries[0] ?? 0, avgRentSeries.at(-1) ?? 0),
      values:    avgRentSeries,
    },
    {
      label:     '% Comisión sobre ingresos',
      color:     PREMIUM.emerald,
      current:   `${(commissionPctSeries.at(-1) ?? 0).toFixed(1)}%`,
      changePct: pctChange(commissionPctSeries[0] ?? 0, commissionPctSeries.at(-1) ?? 0),
      values:    commissionPctSeries,
    },
  ] : []

  // ── Ingresos & Comisiones — two-series stacked area ──
  const ingComisSeries = [
    { name: 'Ingresos',   color: PREMIUM.gold,    values: opsTrend.map(t => t.ingresos)   },
    { name: 'Comisiones', color: PREMIUM.emerald, values: opsTrend.map(t => t.comisiones) },
  ]

  // ── Treemap of top landlords ──
  const landlordTotal = topLandlords.reduce((s, l) => s + l.revenue, 0)
  const treemapItems  = topLandlords.map(l => ({
    name:  l.name,
    value: l.revenue,
    pct:   landlordTotal > 0 ? (l.revenue / landlordTotal) * 100 : 0,
  }))

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5">
        {/* ──────────────────────────────────────────────────────────── */}
        {/*  Cobranza del mes — radial gauge                             */}
        {/*  desktop: 4/12 cols; tablet: 1/2; mobile: full                */}
        {/* ──────────────────────────────────────────────────────────── */}
        <DashboardCard
          className="xl:col-span-4"
          title="Cobranza del mes"
          subtitle={`${collection.paidCount} de ${collection.totalContracts} contratos cobrados`}
        >
          {collection.totalContracts > 0 ? (
            <>
              <RadialGauge pct={collection.collectionRateByCount} status={collection.status} />
              <div className="grid grid-cols-2 gap-3 pt-3 mt-2 border-t border-line">
                <Stat label="Cobrado"   value={fmtMoney(collection.collectedAmount)} />
                <Stat label="Pendiente" value={fmtMoney(collection.pendingAmount)} highlight={collection.pendingAmount > 0} />
              </div>
              {incomeDeltaPct != null && (
                <p className="mt-3 text-[11px] text-slate tabular-nums">
                  Ingresos {incomeDelta >= 0 ? '↑' : '↓'} <span className={incomeDelta >= 0 ? 'text-success' : 'text-danger'}>
                    {Math.abs(incomeDeltaPct).toFixed(0)}%
                  </span> vs mes anterior
                </p>
              )}
              {collection.unpaidCount > 0 && (
                <Link href="/pendientes?tipo=cobranza" className="block mt-2 text-[12px] text-ink hover:underline">
                  Ver {collection.unpaidCount} pendiente{collection.unpaidCount === 1 ? '' : 's'} →
                </Link>
              )}
            </>
          ) : (
            <EmptyState text="Sin contratos activos" />
          )}
        </DashboardCard>

        {/* ──────────────────────────────────────────────────────────── */}
        {/*  Pendientes por categoría — donut                            */}
        {/* ──────────────────────────────────────────────────────────── */}
        <DashboardCard
          className="xl:col-span-4"
          title="Pendientes esta semana"
          subtitle={
            pending.counts.total === 0
              ? 'Sin pendientes — todo al día'
              : `${pending.counts.total} ${pending.counts.total === 1 ? 'acción' : 'acciones'} a resolver`
          }
        >
          {pendientesItems.length > 0 ? (
            <>
              <DonutPanel
                items={pendientesItems}
                legendPosition="bottom"
                totalUnit={pending.counts.total === 1 ? 'pendiente' : 'pendientes'}
              />
              <Link href="/pendientes" className="block mt-3 text-[12px] text-ink hover:underline text-center">
                Ver detalle →
              </Link>
            </>
          ) : (
            <div className="py-10 text-center">
              <p className="text-[13px] text-success font-medium">Todo al día</p>
              <p className="text-[12px] text-slate mt-1">Sin acciones pendientes esta semana</p>
            </div>
          )}
        </DashboardCard>

        {/* ──────────────────────────────────────────────────────────── */}
        {/*  Tendencia operativa — sparklines (line family)              */}
        {/* ──────────────────────────────────────────────────────────── */}
        <DashboardCard
          className="md:col-span-2 xl:col-span-4"
          title="Tendencia operativa"
          subtitle="6 meses · cada serie con su propia escala"
        >
          {sparkSeries.length > 0 ? (
            <SparklineGroup series={sparkSeries} xLabels={opsLabels} />
          ) : (
            <EmptyState text="Sin movimientos registrados" />
          )}
        </DashboardCard>

        {/* ──────────────────────────────────────────────────────────── */}
        {/*  Ingresos & Comisiones — stacked-area lines                  */}
        {/*  This is the wide chart — gets 8/12 cols on desktop          */}
        {/* ──────────────────────────────────────────────────────────── */}
        <DashboardCard
          className="md:col-span-2 xl:col-span-8"
          title="Ingresos y Comisiones"
          subtitle="Últimos 6 meses · ingresos en oro, comisiones en verde"
        >
          {opsTrend.some(t => t.ingresos > 0 || t.comisiones > 0) ? (
            <StackedAreaChart xLabels={opsLabels} series={ingComisSeries} height={280} />
          ) : (
            <EmptyState text="Sin movimientos registrados" />
          )}
        </DashboardCard>

        {/* ──────────────────────────────────────────────────────────── */}
        {/*  Concentración por propietario — treemap                     */}
        {/* ──────────────────────────────────────────────────────────── */}
        <DashboardCard
          className="md:col-span-2 xl:col-span-4"
          title="Concentración"
          subtitle={`Top ${topLandlords.length} propietarios este período`}
        >
          {treemapItems.length > 0 ? (
            <>
              <TreemapChart items={treemapItems} height={260} />
              <p className="text-[11px] text-slate mt-2 text-center">
                Cada rectángulo está dimensionado según el ingreso del propietario
              </p>
            </>
          ) : (
            <EmptyState text="Sin cobros este período" />
          )}
        </DashboardCard>
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="label-cap text-slate mb-1">{label}</p>
      <p className={`font-display text-[15px] font-medium tabular-nums leading-none ${highlight ? 'text-ink' : 'text-slate-dark'}`}>
        {value}
      </p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-[13px] text-slate">{text}</p>
    </div>
  )
}
