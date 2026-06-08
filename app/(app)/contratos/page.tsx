import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { listContracts } from '@/lib/entities/queries'

export const revalidate = 0

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const fmtDate = (s: string) => {
  const d = new Date(s)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function ContratosPage() {
  const contracts = await listContracts()

  const total      = contracts.length
  const active     = contracts.filter(c => c.status === 'active').length
  const rescinded  = contracts.filter(c => c.status === 'rescinded').length
  const totalRent  = contracts.filter(c => c.status === 'active').reduce((s, c) => s + c.currentRent, 0)

  // Contracts expiring in next 60 days
  const today      = new Date('2026-06-09')
  const in60days   = new Date(today.getTime() + 60 * 86400000)
  const expiring   = contracts.filter(c => {
    const end = new Date(c.endDate)
    return c.status === 'active' && end >= today && end <= in60days
  }).length

  const kpis = [
    { label: 'Total contratos',  value: total.toString(),      delta: 'todos los estados',     tone: 'neutral'  as const },
    { label: 'Activos',          value: active.toString(),     delta: `${rescinded} rescindidos`, tone: 'positive' as const },
    { label: 'Por vencer',       value: expiring.toString(),   delta: 'en próximos 60 días',   tone: expiring > 0 ? 'negative' as const : 'neutral' as const },
    { label: 'Alquiler mensual', value: '$' + (totalRent / 1_000_000).toFixed(1) + ' M', delta: 'suma de activos', tone: 'positive' as const },
  ]

  return (
    <>
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
        <p className="text-[13px] text-slate-dark">
          <strong className="text-ink font-medium">Contratos</strong> · {total} en total · {active} activos
        </p>
        <p className="label-cap text-slate">Datos en vivo · Mayo 2026</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
        ))}
      </div>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Listado completo</h2>
          <p className="text-[12px] text-slate mt-0.5">Ordenados por fecha de inicio, más recientes primero</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[860px]">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Inquilino</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Propietario</th>
                <th className="text-right px-5 py-2.5 label-cap font-medium">Alquiler</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Cadencia</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Inicio</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Vencimiento</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c, idx) => (
                <tr
                  key={c.id}
                  className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} ${c.status === 'rescinded' ? 'opacity-60' : ''} hover:bg-cream-2 transition-colors`}
                >
                  <td className="px-5 py-3 text-ink font-medium">{c.primaryTenant}</td>
                  <td className="px-5 py-3 text-slate-dark">{c.primaryLandlord}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-ink">{fmt(c.currentRent)}</td>
                  <td className="px-5 py-3 text-slate-dark capitalize">{c.cadence}</td>
                  <td className="px-5 py-3 text-slate-dark tabular-nums">{fmtDate(c.startDate)}</td>
                  <td className="px-5 py-3 text-slate-dark tabular-nums">{fmtDate(c.endDate)}</td>
                  <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':     return <Badge tone="success">Activo</Badge>
    case 'rescinded':  return <Badge tone="danger">Rescindido</Badge>
    case 'ended':      return <Badge tone="neutral">Finalizado</Badge>
    case 'suspended':  return <Badge tone="neutral">Suspendido</Badge>
    default:           return <Badge tone="neutral">{status}</Badge>
  }
}
