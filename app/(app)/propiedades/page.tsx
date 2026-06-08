import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { listProperties } from '@/lib/entities/queries'

export const revalidate = 0

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

const TYPE_LABEL: Record<string, string> = {
  vivienda: 'Vivienda',
  local:    'Local',
  cochera:  'Cochera',
  oficina:  'Oficina',
  deposito: 'Depósito',
}

export default async function PropiedadesPage() {
  const props = await listProperties()

  const total      = props.length
  const occupied   = props.filter(p => p.hasContract && !p.isVacant).length
  const vacant     = props.filter(p => p.isVacant).length

  // Type breakdown
  const byType = new Map<string, number>()
  for (const p of props) byType.set(p.propertyType, (byType.get(p.propertyType) ?? 0) + 1)

  const kpis = [
    { label: 'Total propiedades', value: total.toString(),    delta: 'en cartera',                    tone: 'neutral'  as const },
    { label: 'Ocupadas',          value: occupied.toString(), delta: `${Math.round((occupied / total) * 100)}% ocupación`, tone: 'positive' as const },
    { label: 'Vacantes',          value: vacant.toString(),   delta: 'requieren ocupar',              tone: vacant > 0 ? 'negative' as const : 'neutral' as const },
    { label: 'Locales / oficinas', value: ((byType.get('local') ?? 0) + (byType.get('oficina') ?? 0)).toString(), delta: 'comerciales', tone: 'neutral' as const },
  ]

  // Sort: occupied first, then vacant (Alejandro wants to see vacancies clearly grouped)
  const sortedProps = [...props].sort((a, b) => {
    if (a.isVacant !== b.isVacant) return a.isVacant ? 1 : -1
    return a.address.localeCompare(b.address)
  })

  return (
    <>
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
        <p className="text-[13px] text-slate-dark">
          <strong className="text-ink font-medium">Propiedades</strong> · {total} en cartera · {vacant} vacantes
        </p>
        <p className="label-cap text-slate">Datos en vivo</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
        ))}
      </div>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Catálogo completo</h2>
          <p className="text-[12px] text-slate mt-0.5">Propiedades ocupadas primero, luego vacantes</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[860px]">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Dirección</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Tipo</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Propietario</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Inquilino</th>
                <th className="text-right px-5 py-2.5 label-cap font-medium">Alquiler</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {sortedProps.map((p, idx) => (
                <tr
                  key={p.id}
                  className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} ${p.isVacant ? 'opacity-65' : ''} hover:bg-cream-2 transition-colors`}
                >
                  <td className="px-5 py-3 text-ink font-medium">{cleanAddress(p.address)}</td>
                  <td className="px-5 py-3 text-slate-dark">{TYPE_LABEL[p.propertyType] ?? p.propertyType}</td>
                  <td className="px-5 py-3 text-slate-dark">{p.landlord ?? <span className="text-slate/50">—</span>}</td>
                  <td className="px-5 py-3 text-slate-dark">{p.tenant ?? <span className="text-slate/50">—</span>}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-ink">
                    {p.currentRent > 0 ? fmt(p.currentRent) : <span className="text-slate/50">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    {p.isVacant
                      ? <Badge tone="danger">Vacante</Badge>
                      : <Badge tone="success">Ocupada</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

// Strip the "(vacante)" suffix from address text for the display column —
// the Estado badge already conveys vacancy.
function cleanAddress(s: string) {
  return s.replace(/\s*\(vacante\)\s*$/i, '')
}
