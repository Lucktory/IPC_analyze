import Link from 'next/link'
import { Building2, Home, DoorOpen, Building, SlidersHorizontal, Plus, ChevronRight } from 'lucide-react'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { FilterPill } from '@/components/ui/FilterPill'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { TablePagination } from '@/components/ui/TablePagination'
import { StatCard } from '@/components/ui/StatCard'
import { listProperties } from '@/lib/entities/queries'
import { fmtMoney as fmt, fmtInt } from '@/lib/format'

const PER_PAGE = 12
const TYPE: Record<string, { label: string; color: string }> = {
  vivienda: { label: 'Vivienda', color: '#3B82F6' },
  local:    { label: 'Local',    color: '#8B5CF6' },
  cochera:  { label: 'Cochera',  color: '#F59E0B' },
  oficina:  { label: 'Oficina',  color: '#06B6D4' },
  deposito: { label: 'Depósito', color: '#8A93A5' },
}
const TYPE_ORDER = ['vivienda', 'local', 'cochera', 'oficina', 'deposito']
const cleanAddress = (s: string) => s.replace(/\s*\(vacante\)\s*$/i, '')

interface PageProps {
  searchParams: Promise<{ estado?: string; tipo?: string; q?: string; pagina?: string }>
}

export default async function PropiedadesPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const estado = sp.estado ?? 'todos'
  const tipoF  = sp.tipo ?? 'todos'
  const q      = (sp.q ?? '').trim().toLowerCase()

  const all = await listProperties()
  // Properties dadas de baja leave the active portfolio: they don't count in
  // the stats and are hidden from the default list. estado='inactivas' shows
  // exactly those (to reactivate them).
  const activeProps     = all.filter(p => p.isActive)
  const inactiveProps   = all.filter(p => !p.isActive)
  const viewingInactive = estado === 'inactivas'

  const total    = activeProps.length
  const ocupadas = activeProps.filter(p => !p.isVacant).length
  const vacantes = total - ocupadas
  const typeCounts: Record<string, number> = {}
  for (const p of activeProps) typeCounts[p.propertyType] = (typeCounts[p.propertyType] ?? 0) + 1
  const viviendas = typeCounts.vivienda ?? 0
  const locales   = typeCounts.local ?? 0
  const donutItems = TYPE_ORDER.filter(t => typeCounts[t]).map(t => ({
    label: TYPE[t].label, color: TYPE[t].color, value: typeCounts[t],
    pct: total > 0 ? Math.round((typeCounts[t] / total) * 100) : 0,
  }))

  let rows = viewingInactive ? inactiveProps : activeProps
  if (!viewingInactive) {
    if (estado === 'ocupadas')      rows = rows.filter(p => !p.isVacant)
    else if (estado === 'vacantes') rows = rows.filter(p => p.isVacant)
  }
  if (tipoF !== 'todos') rows = rows.filter(p => p.propertyType === tipoF)
  if (q) {
    rows = rows.filter(p =>
      cleanAddress(p.address).toLowerCase().includes(q) ||
      (p.landlord ?? '').toLowerCase().includes(q) ||
      (p.tenant ?? '').toLowerCase().includes(q))
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const page       = Math.min(Math.max(1, parseInt(sp.pagina ?? '1', 10) || 1), totalPages)
  const pageRows   = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const fromN      = rows.length === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const toN        = Math.min(page * PER_PAGE, rows.length)

  const buildHref = (o: Partial<Record<string, string>>) => {
    const params = new URLSearchParams()
    const m = { estado, tipo: tipoF, q, ...o }
    if (m.estado && m.estado !== 'todos') params.set('estado', m.estado)
    if (m.tipo && m.tipo !== 'todos')     params.set('tipo', m.tipo)
    if (m.q) params.set('q', m.q)
    const qs = params.toString()
    return qs ? `/propiedades?${qs}` : '/propiedades'
  }
  const pageHref = (n: number) => {
    const base = buildHref({})
    const sep = base.includes('?') ? '&' : '?'
    return n <= 1 ? base : `${base}${sep}pagina=${n}`
  }

  const pctOcup = total > 0 ? (ocupadas / total) * 100 : 0
  const pctVac  = total > 0 ? (vacantes / total) * 100 : 0
  const stats = [
    { key: 'total',  label: 'Propiedades', value: fmtInt(total),    sub: 'Total de unidades',                     Icon: Building2, color: '#3B82F6', href: buildHref({ estado: 'todos' }),    active: estado === 'todos' },
    { key: 'ocup',   label: 'Ocupadas',    value: fmtInt(ocupadas), sub: `${pctOcup.toFixed(1).replace('.', ',')}% del total`, Icon: Home,      color: '#16A34A', href: buildHref({ estado: 'ocupadas' }), active: estado === 'ocupadas' },
    { key: 'vac',    label: 'Vacantes',    value: fmtInt(vacantes), sub: `${pctVac.toFixed(1).replace('.', ',')}% del total`,  Icon: DoorOpen,  color: '#F59E0B', href: buildHref({ estado: 'vacantes' }), active: estado === 'vacantes' },
    { key: 'vivloc', label: 'Viviendas / Locales', value: `${viviendas} / ${locales}`, sub: `${total ? Math.round(viviendas / total * 100) : 0}% viv. / ${total ? Math.round(locales / total * 100) : 0}% loc.`, Icon: Building, color: '#8B5CF6', href: buildHref({ tipo: 'vivienda' }), active: tipoF === 'vivienda' },
  ]

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
      <header className="shrink-0">
        <h1 className="text-[24px] font-semibold text-ink tracking-tight">Propiedades</h1>
        <nav className="text-[12px] text-slate mt-1 flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Propiedades</span>
        </nav>
      </header>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="flex-1 min-w-[220px]">
          <AutoSearchInput initialValue={sp.q ?? ''} placeholder="Buscar por dirección, propietario o inquilino…" resetParams={['pagina']} />
        </div>
        <details className="relative">
          <summary className={`list-none inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] cursor-pointer transition-colors [&::-webkit-details-marker]:hidden ${
            tipoF !== 'todos' ? 'border-info text-info bg-info/5' : 'border-line text-ink bg-paper hover:border-info/40'
          }`}>
            <SlidersHorizontal size={15} /> Filtros
          </summary>
          <div className="absolute right-0 mt-2 z-30 w-[260px] bg-paper border border-line rounded-xl shadow-lg p-3.5">
            <span className="label-cap text-slate">Tipo</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {TYPE_ORDER.filter(t => typeCounts[t]).map(t => (
                <FilterPill key={t} href={buildHref({ tipo: t })} clearHref={buildHref({ tipo: 'todos' })} label={TYPE[t].label} active={tipoF === t} />
              ))}
            </div>
          </div>
        </details>
        {/* Inactivas toggle — only when there are dadas de baja. */}
        {(inactiveProps.length > 0 || viewingInactive) && (
          <Link
            href={viewingInactive ? buildHref({ estado: 'todos' }) : buildHref({ estado: 'inactivas' })}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] transition-colors shrink-0 ${
              viewingInactive ? 'border-info text-info bg-info/5' : 'border-line text-slate-dark bg-paper hover:border-info/40'
            }`}
          >
            {viewingInactive ? '← Ver activas' : `Inactivas (${inactiveProps.length})`}
          </Link>
        )}
        <Link href="/propiedades/nuevo" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-info text-white text-[13px] font-medium hover:brightness-110 transition-all shrink-0">
          <Plus size={16} /> Nueva propiedad
        </Link>
      </div>

      {/* KPI row */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
        {stats.map(s => (
          <StatCard key={s.key} Icon={s.Icon} color={s.color} label={s.label} value={s.value} sub={s.sub} href={s.href} active={s.active} />
        ))}
        {/* Por tipo donut */}
        <div className="rounded-xl border border-line bg-paper p-4 flex flex-col gap-2">
          <span className="text-[12px] font-medium text-slate">Por tipo</span>
          <TypeDonut items={donutItems} />
        </div>
      </section>

      {/* Table */}
      <section className="bg-paper border border-line rounded-xl shadow-card overflow-hidden lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
        <div className="overflow-auto lg:flex-1 lg:min-h-0">
          {pageRows.length > 0 ? (
            <table className="w-full text-[13px] min-w-[940px]">
              <thead className="sticky top-0 z-10 bg-paper">
                <tr className="border-b border-line">
                  {['Dirección', 'Tipo', 'Propietario', 'Inquilino actual', 'Alquiler', 'Estado', ''].map((h, i) => (
                    <th key={i} className={`label-cap font-medium text-slate px-4 py-2.5 ${h === 'Alquiler' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(p => {
                  const t = TYPE[p.propertyType] ?? { label: p.propertyType, color: '#8A93A5' }
                  return (
                    <ClickableRow key={p.id} href={`/propiedades/${p.id}`} className="border-b border-line/60 last:border-0 hover:bg-cream-2 transition-colors">
                      <td className="px-4 py-3">
                        <div className="leading-tight min-w-0">
                          <div className="text-ink truncate max-w-[220px]">{cleanAddress(p.address)}{p.unit ? ` ${p.unit}` : ''}</div>
                          {p.city && <div className="text-slate text-[11px] truncate">{p.city}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: t.color + '1f', color: t.color }}>{t.label}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-dark truncate max-w-[160px]">{p.landlord ?? <span className="text-slate/50">—</span>}</td>
                      <td className="px-4 py-3 text-slate-dark truncate max-w-[160px]">{p.tenant ?? <span className="text-slate/50">—</span>}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink whitespace-nowrap">{p.currentRent > 0 ? fmt(p.currentRent) : <span className="text-slate/50">—</span>}</td>
                      <td className="px-4 py-3">
                        {!p.isActive
                          ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate/15 text-slate-dark">Inactiva</span>
                          : p.isVacant
                            ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-warn/15 text-warn">Vacante</span>
                            : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-success/15 text-success">Ocupada</span>}
                      </td>
                      <td className="px-4 py-3 text-right"><ChevronRight size={16} className="text-slate/50 inline" /></td>
                    </ClickableRow>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-[14px] text-slate">Ninguna propiedad coincide con la búsqueda</div>
          )}
        </div>
        {rows.length > 0 && (
          <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-3 flex-wrap shrink-0">
            <p className="text-[12px] text-slate tabular-nums">Mostrando {fromN} a {toN} de {rows.length} propiedad{rows.length === 1 ? '' : 'es'}</p>
            <TablePagination page={page} totalPages={totalPages} hrefFor={pageHref} />
          </div>
        )}
      </section>
    </div>
  )
}

// Compact conic-gradient donut + legend for the "Por tipo" KPI card.
function TypeDonut({ items }: { items: { label: string; color: string; value: number; pct: number }[] }) {
  if (items.length === 0) return <p className="text-[12px] text-slate">Sin datos</p>
  let acc = 0
  const stops = items.map(i => { const from = acc; acc += i.pct; return `${i.color} ${from}% ${acc}%` }).join(', ')
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-12 h-12 rounded-full shrink-0" style={{ background: `conic-gradient(${stops})` }}>
        <div className="absolute inset-[7px] rounded-full bg-paper" />
      </div>
      <ul className="text-[10px] space-y-0.5 min-w-0 flex-1">
        {items.map(i => (
          <li key={i.label} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: i.color }} />
            <span className="text-slate-dark truncate">{i.label}</span>
            <span className="text-slate tabular-nums ml-auto whitespace-nowrap">{i.value} · {i.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
