import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { listLandlords } from '@/lib/entities/queries'

export const revalidate = 0

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

export default async function PropietariosPage() {
  const landlords = await listLandlords()

  const totalLandlords    = landlords.length
  const totalContracts    = landlords.reduce((s, l) => s + l.contractCount, 0)
  const totalRevenue      = landlords.reduce((s, l) => s + l.monthlyRevenue, 0)
  const withCuit          = landlords.filter(l => l.dniOrCuit).length

  const kpis = [
    { label: 'Total propietarios',  value: totalLandlords.toString(),    delta: 'en cartera',                       tone: 'neutral'  as const },
    { label: 'Contratos vigentes',  value: totalContracts.toString(),    delta: 'sumando todos los propietarios',   tone: 'neutral'  as const },
    { label: 'Ingresos del mes',    value: '$' + (totalRevenue / 1_000_000).toFixed(1) + ' M', delta: 'alquileres mayo', tone: 'positive' as const },
    { label: 'Con CUIT cargado',    value: `${withCuit} / ${totalLandlords}`,   delta: 'datos fiscales',           tone: 'neutral'  as const },
  ]

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] text-slate-dark">
            <strong className="text-ink font-medium">Propietarios</strong> · {totalLandlords} en cartera · {totalContracts} contratos
          </p>
          <p className="label-cap text-slate">Datos en vivo · Mayo 2026</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
          ))}
        </div>
      </StickyHeader>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Listado completo</h2>
            <p className="text-[12px] text-slate mt-0.5">Datos fiscales y operativos por propietario</p>
          </div>
          <p className="text-[12px] text-slate">{totalLandlords} propietarios</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[720px] border-collapse">
            <thead className="bg-cream-2/60">
              <tr className="border-b border-line">
                <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Propietario</th>
                <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">CUIT / DNI</th>
                <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Teléfono</th>
                <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Contratos</th>
                <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Propiedades</th>
                <th className="text-right px-4 py-1.5 label-cap font-medium">Ingresos mayo</th>
              </tr>
            </thead>
            <tbody>
              {landlords.map((l, idx) => (
                <tr key={l.id} className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} hover:bg-cream-2 transition-colors border-b border-line/30`}>
                  <td className="px-4 py-1.5 text-ink font-medium border-r border-line/30">
                    <Link href={`/propietarios/${l.id}`} className="hover:underline underline-offset-4 decoration-slate/40">
                      {l.name}
                    </Link>
                  </td>
                  <td className="px-4 py-1.5 text-slate-dark tabular-nums border-r border-line/30">{l.dniOrCuit ?? <span className="text-slate/50">—</span>}</td>
                  <td className="px-4 py-1.5 text-slate-dark tabular-nums border-r border-line/30">{l.phone ?? <span className="text-slate/50">—</span>}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-ink border-r border-line/30">{l.contractCount}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-slate-dark border-r border-line/30">{l.propertyCount}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-ink">{l.monthlyRevenue > 0 ? fmt(l.monthlyRevenue) : <span className="text-slate/50">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
