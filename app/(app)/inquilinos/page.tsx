import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { listTenants } from '@/lib/entities/queries'

export const revalidate = 0

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

export default async function InquilinosPage() {
  const tenants = await listTenants()

  const total           = tenants.length
  const withContract    = tenants.filter(t => t.contractCount > 0).length
  const withPhone       = tenants.filter(t => t.phone).length
  const totalRent       = tenants.reduce((s, t) => s + t.monthlyRent, 0)

  const kpis = [
    { label: 'Total inquilinos', value: total.toString(),         delta: 'en cartera',                        tone: 'neutral'  as const },
    { label: 'Con contrato',     value: withContract.toString(),  delta: `${total - withContract} sin contrato actual`, tone: 'neutral' as const },
    { label: 'Con teléfono',     value: `${withPhone} / ${total}`, delta: 'datos de contacto',                tone: 'neutral'  as const },
    { label: 'Alquiler total',   value: '$' + (totalRent / 1_000_000).toFixed(1) + ' M', delta: 'suma de alquileres activos', tone: 'positive' as const },
  ]

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] text-slate-dark">
            <strong className="text-ink font-medium">Inquilinos</strong> · {total} en cartera
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
            <p className="text-[12px] text-slate mt-0.5">Datos de contacto y contratos vigentes</p>
          </div>
          <p className="text-[12px] text-slate">{total} inquilinos</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[720px]">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Inquilino</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Teléfono</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Email</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">DNI</th>
                <th className="text-right px-5 py-2.5 label-cap font-medium">Contratos</th>
                <th className="text-right px-5 py-2.5 label-cap font-medium">Alquiler mensual</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, idx) => (
                <tr key={t.id} className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} hover:bg-cream-2 transition-colors`}>
                  <td className="px-5 py-3 text-ink font-medium">{t.name}</td>
                  <td className="px-5 py-3 text-slate-dark tabular-nums">{t.phone ?? <span className="text-slate/50">—</span>}</td>
                  <td className="px-5 py-3 text-slate-dark">{t.email ?? <span className="text-slate/50">—</span>}</td>
                  <td className="px-5 py-3 text-slate-dark tabular-nums">{t.dni ?? <span className="text-slate/50">—</span>}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-ink">{t.contractCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-ink">{t.monthlyRent > 0 ? fmt(t.monthlyRent) : <span className="text-slate/50">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
