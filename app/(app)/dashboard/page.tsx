import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { DonutChart } from '@/components/charts/DonutChart'
import { BarHorizontal } from '@/components/charts/BarHorizontal'
import { fmtCompactARS, accentInk } from '@/components/charts/theme'
import {
  getDashboardKpis,
  getCommissionByDestination,
  getTopLandlords,
  getPropertyTypeBreakdown,
  getContractsWithoutPayment,
} from '@/lib/dashboard/queries'
import { getCurrentPeriodLabel } from '@/lib/period'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

export default async function DashboardPage() {
  // Fetch everything in parallel
  const [kpis, byDest, topLandlords, propTypes, unpaid] = await Promise.all([
    getDashboardKpis(),
    getCommissionByDestination(),
    getTopLandlords(10),
    getPropertyTypeBreakdown(),
    getContractsWithoutPayment(),
  ])

  const periodLabel = getCurrentPeriodLabel()
  const periodMonth = periodLabel.split(' ')[0].toLowerCase()   // "junio" for "Junio 2026"

  // Donut data: commission by destination
  const donutColors: Record<string, string> = {
    ADM_GALICIA:      '#4A4F58',
    ADM_FRANCES_50_9: '#7D8491',
    ADM_FRANCES_51_6: '#D6CFC1',
    OTHER:            '#E5E5E5',
  }
  const cobroMes = byDest.map(d => ({
    name:  d.label.split('·')[0].trim(),
    value: d.total,
    color: donutColors[d.destination] ?? '#7D8491',
  }))

  // Bar chart: top landlords
  const topLandlordsBar = topLandlords.slice(0, 6).map(l => ({
    name:  l.name.length > 24 ? l.name.slice(0, 22) + '…' : l.name,
    value: l.revenue,
  }))

  // Property type breakdown — capped at top 2 for the dashboard tile.
  // Plural labels are domain-correct (vivienda/local → viviendas/locales).
  const PROP_PLURAL: Record<string, string> = {
    vivienda: 'Viviendas',
    local:    'Locales',
    cochera:  'Cocheras',
    oficina:  'Oficinas',
    deposito: 'Depósitos',
  }
  const propTypesTop  = propTypes.slice(0, 2)
  const propTypeTotal = propTypes.reduce((s, p) => s + p.count, 0)
  const propTypesView = propTypesTop.map(p => ({
    label: PROP_PLURAL[p.type] ?? p.type,
    count: p.count,
    pct:   propTypeTotal > 0 ? (p.count / propTypeTotal) * 100 : 0,
  }))

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] text-slate-dark">
            Período actual: <strong className="text-ink font-medium">{periodLabel}</strong>
          </p>
          <p className="label-cap text-slate">Datos en vivo desde Supabase</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard
            label="Contratos activos"
            value={kpis.activeContracts.toString()}
            delta={kpis.rescindedContracts + ' rescindidos'}
            deltaTone="neutral"
          />
          <KPICard
            label={`Sin pago de ${periodMonth}`}
            value={unpaid.length.toString()}
            delta={unpaid.length > 0 ? 'tocá para ver pendientes' : 'todo cobrado'}
            deltaTone={unpaid.length > 0 ? 'negative' : 'positive'}
            href="/pendientes?tipo=cobranza"
            active={false}
          />
          <KPICard
            label="Ingresos del mes"
            value={fmtCompactARS(kpis.monthlyIncome)}
            delta={`alquileres de ${periodMonth}`}
            deltaTone="neutral"
          />
          <KPICard
            label="Comisión del mes"
            value={fmtCompactARS(kpis.monthlyCommission)}
            delta="ADMI total"
            deltaTone="positive"
          />
        </div>
      </StickyHeader>

      {/* Commission by destination — the section chief's reconciliation view */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 bg-paper border border-line rounded shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[15px] font-medium text-ink">
              Comisión por cuenta destino
            </h2>
            <p className="text-[12px] text-slate mt-0.5">
              Vista de conciliación bancaria — cuánto debería figurar en cada cuenta de Pampa
            </p>
          </div>
          <div className="p-5">
            {cobroMes.length > 0 ? (
              <>
                <DonutChart
                  data={cobroMes}
                  totalLabel={`Comisión total ${periodMonth}`}
                  totalOverride={fmtCompactARS(kpis.monthlyCommission)}
                  height={240}
                />
                <div className="mt-4 space-y-2">
                  {byDest.map((d) => (
                    <div
                      key={d.destination}
                      className="flex items-center justify-between border-l-2 pl-3 py-1"
                      style={{ borderColor: donutColors[d.destination] }}
                    >
                      <div>
                        <p className="text-[13px] text-ink">{d.label}</p>
                        <p className="text-[11px] text-slate">{d.txCount} movimientos</p>
                      </div>
                      <p className="font-display text-[14px] font-medium tabular-nums text-ink">
                        {fmt(d.total)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState text="No hay comisiones registradas para este período" />
            )}
          </div>
        </section>

        <section className="lg:col-span-2 bg-paper border border-line rounded shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[15px] font-medium text-ink">Cartera por tipo</h2>
            <p className="text-[12px] text-slate mt-0.5">{propTypeTotal} propiedades en administración</p>
          </div>
          <div className="p-5">
            {propTypesView.length > 0 ? (
              <>
                {/* Single proportion bar showing both segments */}
                <div className="flex h-2 rounded-full overflow-hidden bg-cream-2">
                  {propTypesView.map((p, i) => (
                    <div
                      key={p.label}
                      style={{ width: `${p.pct}%`, backgroundColor: i === 0 ? '#4A4F58' : '#D6CFC1' }}
                      title={`${p.label}: ${p.pct.toFixed(0)}%`}
                    />
                  ))}
                </div>

                {/* Two big stats side by side */}
                <div className="mt-5 grid grid-cols-2 divide-x divide-line">
                  {propTypesView.map((p, i) => (
                    <div key={p.label} className={i === 0 ? 'pr-4' : 'pl-4'}>
                      <p className="font-display text-[32px] font-medium tabular-nums text-ink leading-none">{p.count}</p>
                      <p className="label-cap mt-2">{p.label}</p>
                      <p className="text-[11px] text-slate mt-0.5 tabular-nums">{p.pct.toFixed(0)}%</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState text="Sin propiedades cargadas" />
            )}
          </div>
        </section>
      </div>

      {/* Top landlords */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">
              Propietarios con mayor ingreso ({periodMonth})
            </h2>
            <p className="text-[12px] text-slate mt-0.5">Top 6 por alquileres cobrados</p>
          </div>
          <Badge tone="neutral">{topLandlords.length} con cobros</Badge>
        </div>
        <div className="p-5">
          {topLandlordsBar.length > 0 ? (
            <BarHorizontal
              data={topLandlordsBar}
              height={Math.max(180, topLandlordsBar.length * 32)}
              preserveOrder
              barColor={accentInk}
            />
          ) : (
            <EmptyState text="Sin cobros registrados" />
          )}
        </div>
      </section>

      {/* Operational queue — replaces the redundant unpaid table.
          The full list with categories, plazos, and email status lives in
          /pendientes. This card is just a doorway. */}
      {unpaid.length > 0 && (
        <Link
          href="/pendientes?tipo=cobranza"
          className="mt-6 block bg-paper border border-line border-l-[4px] border-l-danger rounded shadow-card p-5 hover:shadow-cardHover hover:border-ink/30 transition-all"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="label-cap text-danger">Acción requerida</p>
              <h2 className="font-display text-[18px] font-medium text-ink mt-1">
                {unpaid.length} {unpaid.length === 1 ? 'contrato' : 'contratos'} sin pago de {periodMonth}
              </h2>
              <p className="text-[13px] text-slate-dark mt-1">
                Tocá para ver la lista completa con datos de contacto.
              </p>
            </div>
            <span className="text-slate hover:text-ink transition-colors text-[13px]">Ir a Pendientes →</span>
          </div>
        </Link>
      )}

      {/* Footer note about Phase D features that need IPC engine */}
      <section className="mt-10">
        <p className="label-cap mb-3">Próximas integraciones (Fase D)</p>
        <div className="flex flex-wrap gap-2">
          <FuturePill title="Próximos aumentos" desc="Requiere conexión a INDEC para calcular fechas y factores" />
          <FuturePill title="Liquidaciones gris/verde/azul" desc="Workflow de envío y conciliación con propietario" />
          <FuturePill title="Recordatorios automáticos" desc="WhatsApp + email vía Resend" />
        </div>
      </section>
    </>
  )
}

// ---------------------------------------------------------------------------
function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-[13px] text-slate">{text}</p>
    </div>
  )
}

function FuturePill({ title, desc }: { title: string; desc: string }) {
  return (
    <span
      title={desc}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cream-2 border border-line text-[12px] text-slate-dark"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-dark/40" />
      {title}
      <span className="text-[10px] text-slate ml-1 uppercase tracking-wider">Próx.</span>
    </span>
  )
}
