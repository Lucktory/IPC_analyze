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
import { TintCard }         from '@/components/charts/panel/TintCard'
import { PREMIUM }          from '@/components/charts/theme'

// Pendientes category colors — vibrant saturated hex (not CSS variables)
// so they render through ECharts cleanly and read with equal weight on
// both light + dark surfaces. Categories carry MEANING — red = urgent —
// so these stay fixed regardless of theme.
const PENDIENTES_CATEGORIES = [
  { key: 'cobranza'   as const, label: 'Cobranza',     sublabel: 'vencidas',     color: '#E63946', href: '/pendientes?tipo=cobranza'   },
  { key: 'aumento'    as const, label: 'Aumentos',     sublabel: 'a notificar',  color: '#F39C12', href: '/pendientes?tipo=aumento'    },
  { key: 'renovacion' as const, label: 'Renovaciones', sublabel: 'a confirmar',  color: '#3B82F6', href: '/pendientes?tipo=renovacion' },
]

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

  // ── Pendientes donut data (only non-zero shows in the ring) ──
  const pendientesItems = PENDIENTES_CATEGORIES
    .map(cat => ({
      label: cat.label,
      value: pending.counts[cat.key],
      color: cat.color,
    }))
    .filter(i => i.value > 0)

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

  // ── Ingresos & Comisiones — two-series stacked area + monthly deltas ──
  const ingComisSeries = [
    { name: 'Ingresos',   color: PREMIUM.gold,    values: opsTrend.map(t => t.ingresos)   },
    { name: 'Comisiones', color: PREMIUM.emerald, values: opsTrend.map(t => t.comisiones) },
  ]
  const opsPrev            = opsTrend.at(-2)
  const ingresosDeltaPct   = opsPrev ? pctChange(opsPrev.ingresos,   opsCurrent?.ingresos   ?? 0) : null
  const comisionesDeltaPct = opsPrev ? pctChange(opsPrev.comisiones, opsCurrent?.comisiones ?? 0) : null

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
              {/* Tinted Cobrado / Pendiente cards — match the design language
                  of the Pendientes cards below. Green for cobrado; red when
                  there's still money outstanding, muted slate when 0. */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <TintCard
                  accent="#16A34A"
                  label="Cobrado"
                  value={fmtMoney(collection.collectedAmount)}
                />
                <TintCard
                  accent={collection.pendingAmount > 0 ? '#DC2626' : '#7E8696'}
                  label="Pendiente"
                  value={fmtMoney(collection.pendingAmount)}
                  muted={collection.pendingAmount === 0}
                />
              </div>
              {incomeDeltaPct != null && (
                <div className="mt-3 flex items-center justify-center">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tabular-nums ${incomeDelta >= 0 ? 'text-success' : 'text-danger'}`}
                    style={{ backgroundColor: incomeDelta >= 0 ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.10)' }}
                  >
                    Ingresos {incomeDelta >= 0 ? '↑' : '↓'} {Math.abs(incomeDeltaPct).toFixed(0)}% vs mes anterior
                  </span>
                </div>
              )}
              {collection.unpaidCount > 0 && (
                <Link href="/pendientes?tipo=cobranza" className="block mt-3 text-[12px] text-ink hover:underline text-center">
                  Ver {collection.unpaidCount} pendiente{collection.unpaidCount === 1 ? '' : 's'} →
                </Link>
              )}
            </>
          ) : (
            <EmptyState text="Sin contratos activos" />
          )}
        </DashboardCard>

        {/* ──────────────────────────────────────────────────────────── */}
        {/*  Pendientes por categoría — donut + colored category cards   */}
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
              {/* Three vibrant per-category cards — each clicks through
                  to the filtered Pendientes list. */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                {PENDIENTES_CATEGORIES.map(cat => (
                  <TintCard
                    key={cat.key}
                    accent={cat.color}
                    label={cat.label}
                    value={pending.counts[cat.key]}
                    sublabel={cat.sublabel}
                    href={cat.href}
                  />
                ))}
              </div>
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
            <>
              {/* KPI cards above the chart — same accent colors as the
                  area lines, so the eye links card → chart immediately. */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <TintCard
                  accent={PREMIUM.gold}
                  label="Ingresos este mes"
                  value={fmtMoney(opsCurrent?.ingresos ?? 0)}
                  sublabel={
                    ingresosDeltaPct == null ? undefined :
                    `${ingresosDeltaPct >= 0 ? '↑' : '↓'} ${Math.abs(ingresosDeltaPct).toFixed(0)}% vs mes anterior`
                  }
                />
                <TintCard
                  accent={PREMIUM.emerald}
                  label="Comisiones este mes"
                  value={fmtMoney(opsCurrent?.comisiones ?? 0)}
                  sublabel={
                    comisionesDeltaPct == null ? undefined :
                    `${comisionesDeltaPct >= 0 ? '↑' : '↓'} ${Math.abs(comisionesDeltaPct).toFixed(0)}% vs mes anterior`
                  }
                />
              </div>
              <StackedAreaChart xLabels={opsLabels} series={ingComisSeries} height={260} />
            </>
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-[13px] text-slate">{text}</p>
    </div>
  )
}
