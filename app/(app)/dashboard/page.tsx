import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
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

export const revalidate = 0  // SSR every request — data changes when seed re-runs

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

  // Donut data: property types
  const propTypeColors: Record<string, string> = {
    vivienda: '#4A4F58',
    local:    '#7D8491',
    cochera:  '#D6CFC1',
    oficina:  '#B8B8B8',
    deposito: '#9CA3AF',
  }
  const propTypeDonut = propTypes.map(p => ({
    name:  p.type[0].toUpperCase() + p.type.slice(1),
    value: p.count,
    color: propTypeColors[p.type] ?? '#7D8491',
  }))

  return (
    <>
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
        <p className="text-[13px] text-slate-dark">
          Período actual: <strong className="text-ink font-medium">Mayo 2026</strong>
        </p>
        <p className="label-cap text-slate">Datos en vivo desde Supabase</p>
      </div>

      {/* KPIs row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard
          label="Contratos activos"
          value={kpis.activeContracts.toString()}
          delta={kpis.rescindedContracts + ' rescindidos'}
          deltaTone="neutral"
        />
        <KPICard
          label="Sin pago de mayo"
          value={unpaid.length.toString()}
          delta={unpaid.length > 0 ? 'requieren atención' : 'todo cobrado'}
          deltaTone={unpaid.length > 0 ? 'negative' : 'positive'}
        />
        <KPICard
          label="Ingresos del mes"
          value={fmtCompactARS(kpis.monthlyIncome)}
          delta="alquileres de mayo"
          deltaTone="neutral"
        />
        <KPICard
          label="Comisión del mes"
          value={fmtCompactARS(kpis.monthlyCommission)}
          delta="ADMI total"
          deltaTone="positive"
        />
      </div>

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
                  totalLabel="Comisión total mayo"
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
            <p className="text-[12px] text-slate mt-0.5">Propiedades en administración</p>
          </div>
          <div className="p-5">
            {propTypeDonut.length > 0 ? (
              <DonutChart
                data={propTypeDonut}
                totalLabel="Propiedades"
                unit="propiedad"
                unitPlural="propiedades"
                height={240}
              />
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
              Propietarios con mayor ingreso (mayo)
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

      {/* Unpaid contracts (atrasados proxy) */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">
              Contratos sin pago de mayo
            </h2>
            <p className="text-[12px] text-slate mt-0.5">
              Activos que aún no registran RENT_IN del período actual
            </p>
          </div>
          <Badge tone={unpaid.length > 0 ? 'danger' : 'success'}>
            {unpaid.length} {unpaid.length === 1 ? 'pendiente' : 'pendientes'}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          {unpaid.length > 0 ? (
            <table className="w-full text-[13px] min-w-[640px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Inquilino</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Propietario</th>
                  <th className="text-right px-5 py-2.5 label-cap font-medium">Alquiler esperado</th>
                </tr>
              </thead>
              <tbody>
                {unpaid.slice(0, 15).map((u, i) => (
                  <tr
                    key={u.contractId}
                    className={i % 2 === 0 ? 'bg-danger/[0.08]' : 'bg-danger/[0.04]'}
                  >
                    <td className="px-5 py-3 text-ink font-medium">{u.tenantName}</td>
                    <td className="px-5 py-3 text-slate-dark">{u.landlordName}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink">{fmt(u.expectedRent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-5">
              <EmptyState text="Todos los contratos activos tienen el alquiler de mayo cobrado" />
            </div>
          )}
        </div>
      </section>

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
