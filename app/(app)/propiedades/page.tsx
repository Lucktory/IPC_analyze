import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { FilterPill } from '@/components/ui/FilterPill'
import { listProperties, type PropertyRow } from '@/lib/entities/queries'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

const TYPE_LABEL: Record<string, string> = {
  vivienda: 'Vivienda',
  local:    'Local',
  cochera:  'Cochera',
  oficina:  'Oficina',
  deposito: 'Depósito',
}
const TYPES = Object.keys(TYPE_LABEL)

type Estado = 'todos' | 'ocupadas' | 'vacantes'

interface PageProps {
  searchParams: Promise<{
    estado?: string
    tipo?:   string
    q?:      string
  }>
}

export default async function PropiedadesPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const estado = (sp.estado as Estado) ?? 'todos'
  const tipo   = sp.tipo ?? 'todos'
  const q      = sp.q?.trim() ?? ''

  const all = await listProperties()

  const match = (p: PropertyRow, e: Estado) => {
    if (e === 'ocupadas') return !p.isVacant
    if (e === 'vacantes') return p.isVacant
    return true
  }

  const counts = {
    todos:    all.length,
    ocupadas: all.filter(p => match(p, 'ocupadas')).length,
    vacantes: all.filter(p => match(p, 'vacantes')).length,
  }

  let rows = all.filter(p => match(p, estado))
  if (tipo !== 'todos') rows = rows.filter(p => p.propertyType === tipo)
  if (q) {
    const ql = q.toLowerCase()
    rows = rows.filter(p =>
      p.address.toLowerCase().includes(ql) ||
      (p.landlord?.toLowerCase().includes(ql) ?? false) ||
      (p.tenant?.toLowerCase().includes(ql) ?? false),
    )
  }

  // Sort: occupied first, then vacant — same intent as before
  const sortedRows = rows.slice().sort((a, b) => {
    if (a.isVacant !== b.isVacant) return a.isVacant ? 1 : -1
    return a.address.localeCompare(b.address)
  })

  // Type breakdown (over the full set, for the KPI)
  const byType = new Map<string, number>()
  for (const p of all) byType.set(p.propertyType, (byType.get(p.propertyType) ?? 0) + 1)

  const kpis = [
    { label: 'Total propiedades', value: counts.todos.toString(),    delta: 'en cartera',                    tone: 'neutral'  as const },
    { label: 'Ocupadas',          value: counts.ocupadas.toString(), delta: counts.todos > 0 ? `${Math.round((counts.ocupadas / counts.todos) * 100)}% ocupación` : 'sin datos', tone: 'positive' as const },
    { label: 'Vacantes',          value: counts.vacantes.toString(), delta: 'requieren ocupar',              tone: counts.vacantes > 0 ? 'negative' as const : 'neutral' as const },
    { label: 'Locales / oficinas', value: ((byType.get('local') ?? 0) + (byType.get('oficina') ?? 0)).toString(), delta: 'comerciales', tone: 'neutral' as const },
  ]

  const buildHref = (overrides: Partial<{ estado: Estado; tipo: string; q: string }>) => {
    const params = new URLSearchParams()
    const merged = { estado, tipo, q, ...overrides }
    if (merged.estado && merged.estado !== 'todos') params.set('estado', merged.estado)
    if (merged.tipo   && merged.tipo   !== 'todos') params.set('tipo',   merged.tipo)
    if (merged.q)                                    params.set('q',      merged.q)
    const qs = params.toString()
    return qs ? `/propiedades?${qs}` : '/propiedades'
  }

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] text-slate-dark">
            <strong className="text-ink font-medium">Propiedades</strong> ·{' '}
            {sortedRows.length === counts.todos
              ? `${counts.todos} en cartera · ${counts.vacantes} vacantes`
              : `${sortedRows.length} de ${counts.todos} filtradas`}
          </p>
          <p className="label-cap text-slate">Datos en vivo</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
          ))}
        </div>
      </StickyHeader>

      {/* FILTER STRIP */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card p-4 sm:p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label-cap text-slate mr-1">Estado</span>
          <FilterPill href={buildHref({ estado: 'todos' })}    label="Todas"    count={counts.todos}    active={estado === 'todos'} />
          <FilterPill href={buildHref({ estado: 'ocupadas' })} label="Ocupadas" count={counts.ocupadas} active={estado === 'ocupadas'} />
          <FilterPill href={buildHref({ estado: 'vacantes' })} label="Vacantes" count={counts.vacantes} active={estado === 'vacantes'} />
        </div>

        <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
          {estado && estado !== 'todos' && <input type="hidden" name="estado" value={estado} />}

          <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <span className="label-cap">Búsqueda</span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Buscar por dirección, propietario o inquilino…"
              className="h-9 px-3 rounded border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label-cap">Tipo</span>
            <select
              name="tipo"
              defaultValue={tipo}
              className="h-9 px-3 rounded border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors"
            >
              <option value="todos">Todos</option>
              {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </label>

          <button
            type="submit"
            className="h-9 px-4 bg-ink text-paper rounded text-[12px] font-medium hover:opacity-90 transition-opacity"
          >
            Filtrar
          </button>

          {(q || tipo !== 'todos') && (
            <Link
              href={buildHref({ q: '', tipo: 'todos' })}
              className="h-9 inline-flex items-center px-3 text-[12px] text-slate hover:text-ink transition-colors"
            >
              Limpiar
            </Link>
          )}
        </form>
      </section>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Catálogo</h2>
            <p className="text-[12px] text-slate mt-0.5">Propiedades ocupadas primero, luego vacantes</p>
          </div>
          <p className="text-[12px] text-slate tabular-nums">{sortedRows.length} resultado{sortedRows.length === 1 ? '' : 's'}</p>
        </div>
        <div className="overflow-x-auto">
          {sortedRows.length > 0 ? (
            <table className="w-full text-[13px] min-w-[860px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Dirección</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Tipo</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Propietario</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Inquilino</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Alquiler</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} ${p.isVacant ? 'opacity-65' : ''} hover:bg-cream-2 transition-colors border-b border-line/30`}
                  >
                    <td className="px-4 py-1.5 text-ink font-medium border-r border-line/30">{cleanAddress(p.address)}</td>
                    <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{TYPE_LABEL[p.propertyType] ?? p.propertyType}</td>
                    <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{p.landlord ?? <span className="text-slate/50">—</span>}</td>
                    <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{p.tenant ?? <span className="text-slate/50">—</span>}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-ink border-r border-line/30">
                      {p.currentRent > 0 ? fmt(p.currentRent) : <span className="text-slate/50">—</span>}
                    </td>
                    <td className="px-4 py-1.5">
                      {p.isVacant
                        ? <Badge tone="danger">Vacante</Badge>
                        : <Badge tone="success">Ocupada</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate">Ninguna propiedad coincide con los filtros aplicados</p>
            </div>
          )}
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
