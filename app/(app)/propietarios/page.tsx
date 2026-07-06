import Link from 'next/link'
import { Users, CircleCheck, Coins, TriangleAlert, SlidersHorizontal, Plus, ChevronRight } from 'lucide-react'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { FilterPill } from '@/components/ui/FilterPill'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { TablePagination } from '@/components/ui/TablePagination'
import { StatCard } from '@/components/ui/StatCard'
import { listLandlords } from '@/lib/entities/queries'
import { getDashboardPeriod } from '@/lib/dashboard/queries'
import { fmtMoney as fmt } from '@/lib/format'
import { periodLabel } from '@/lib/period'

const PER_PAGE = 12

// tax_category -> Argentine fiscal condition label + accent color
const TAX: Record<string, { label: string; color: string }> = {
  RI:          { label: 'Responsable Insc.', color: '#16A34A' },
  MONOTRIBUTO: { label: 'Monotributo',        color: '#F59E0B' },
  CF:          { label: 'Cons. Final',        color: '#8B5CF6' },
  EXENTO:      { label: 'Exento',             color: '#8A93A5' },
}
const AVATAR_COLORS = ['#3B82F6', '#16A34A', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899']
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const colorFor = (s: string) => AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]

interface PageProps {
  searchParams: Promise<{ tipo?: string; q?: string; pagina?: string }>
}

export default async function PropietariosPage({ searchParams }: PageProps) {
  const sp   = await searchParams
  const tipo = sp.tipo ?? 'todos'
  const q    = (sp.q ?? '').trim().toLowerCase()

  const dashPeriod = await getDashboardPeriod()
  const all = await listLandlords(dashPeriod)

  // KPI counts (over the full set)
  const total       = all.length
  const conContrato = all.filter(l => l.contractCount > 0).length
  const cobradoMes  = all.reduce((s, l) => s + l.monthlyRevenue, 0)
  const sinCuit     = all.filter(l => !l.dniOrCuit).length
  const pctContrato = total > 0 ? (conContrato / total) * 100 : 0

  // Filter + search
  let rows = all
  if (tipo === 'con_contrato')      rows = rows.filter(l => l.contractCount > 0)
  else if (tipo === 'sin_contrato') rows = rows.filter(l => l.contractCount === 0)
  else if (tipo === 'sin_cuit')     rows = rows.filter(l => !l.dniOrCuit)
  else if (tipo === 'sin_email')    rows = rows.filter(l => !l.email)
  if (q) {
    rows = rows.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.dniOrCuit ?? '').toLowerCase().includes(q) ||
      (l.email ?? '').toLowerCase().includes(q) ||
      (l.phone ?? '').toLowerCase().includes(q))
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const page       = Math.min(Math.max(1, parseInt(sp.pagina ?? '1', 10) || 1), totalPages)
  const pageRows   = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const fromN      = rows.length === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const toN        = Math.min(page * PER_PAGE, rows.length)

  const buildHref = (o: Partial<Record<string, string>>) => {
    const p = new URLSearchParams()
    const m = { tipo, q, ...o }
    if (m.tipo && m.tipo !== 'todos') p.set('tipo', m.tipo)
    if (m.q) p.set('q', m.q)
    const qs = p.toString()
    return qs ? `/propietarios?${qs}` : '/propietarios'
  }
  const pageHref = (n: number) => {
    const base = buildHref({})
    const sep = base.includes('?') ? '&' : '?'
    return n <= 1 ? base : `${base}${sep}pagina=${n}`
  }

  const stats = [
    { key: 'total',   label: 'Propietarios',    value: total.toLocaleString('es-AR'),       sub: 'en la administración',                                Icon: Users,         color: '#3B82F6', href: buildHref({ tipo: 'todos' }),        active: tipo === 'todos' },
    { key: 'contr',   label: 'Con contratos',   value: conContrato.toLocaleString('es-AR'), sub: `${pctContrato.toFixed(1).replace('.', ',')}% del total`, Icon: CircleCheck,  color: '#16A34A', href: buildHref({ tipo: 'con_contrato' }), active: tipo === 'con_contrato' },
    { key: 'cobrado', label: 'Cobrado del mes', value: fmt(cobradoMes),                     sub: periodLabel(dashPeriod),                               Icon: Coins,         color: '#F59E0B', href: buildHref({ tipo: 'todos' }),        active: false },
    { key: 'sincuit', label: 'Sin CUIT',        value: sinCuit.toLocaleString('es-AR'),     sub: 'requieren validación',                                Icon: TriangleAlert, color: '#8B5CF6', href: buildHref({ tipo: 'sin_cuit' }),     active: tipo === 'sin_cuit' },
  ]

  const filtrosActive = tipo === 'sin_email' || tipo === 'sin_contrato'

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
      <header className="shrink-0">
        <h1 className="text-[24px] font-semibold text-ink tracking-tight">Propietarios</h1>
        <nav className="text-[12px] text-slate mt-1 flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Propietarios</span>
        </nav>
      </header>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="flex-1 min-w-[220px]">
          <AutoSearchInput initialValue={sp.q ?? ''} placeholder="Buscar por nombre, CUIT o contacto…" resetParams={['pagina']} />
        </div>
        <details className="relative">
          <summary className={`list-none inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] cursor-pointer transition-colors [&::-webkit-details-marker]:hidden ${
            filtrosActive ? 'border-info text-info bg-info/5' : 'border-line text-ink bg-paper hover:border-info/40'
          }`}>
            <SlidersHorizontal size={15} /> Filtros
          </summary>
          <div className="absolute right-0 mt-2 z-30 w-[260px] bg-paper border border-line rounded-xl shadow-lg p-3.5 space-y-3">
            <div>
              <span className="label-cap text-slate">Cartera</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <FilterPill href={buildHref({ tipo: 'sin_contrato' })} clearHref={buildHref({ tipo: 'todos' })} label="Sin contratos" active={tipo === 'sin_contrato'} />
                <FilterPill href={buildHref({ tipo: 'sin_email' })} clearHref={buildHref({ tipo: 'todos' })} label="Sin email" active={tipo === 'sin_email'} />
              </div>
            </div>
          </div>
        </details>
        <Link href="/propietarios/nuevo" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-info text-white text-[13px] font-medium hover:brightness-110 transition-all shrink-0">
          <Plus size={16} /> Nuevo propietario
        </Link>
      </div>

      {/* KPI row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {stats.map(s => (
          <StatCard key={s.key} Icon={s.Icon} color={s.color} label={s.label} value={s.value} sub={s.sub} href={s.href} active={s.active} />
        ))}
      </section>

      {/* Table */}
      <section className="bg-paper border border-line rounded-xl shadow-card overflow-hidden lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
        <div className="overflow-auto lg:flex-1 lg:min-h-0">
          {pageRows.length > 0 ? (
            <table className="w-full text-[13px] min-w-[920px]">
              <thead className="sticky top-0 z-10 bg-paper">
                <tr className="border-b border-line">
                  {['Propietario', 'CUIT', 'Contacto', 'Contratos', 'Propiedades', 'Cobrado del mes', 'Condición', ''].map((h, i) => (
                    <th key={i} className={`label-cap font-medium text-slate px-4 py-2.5 ${['Contratos', 'Propiedades'].includes(h) ? 'text-center' : h === 'Cobrado del mes' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(l => {
                  const t = TAX[l.taxCategory] ?? TAX.CF
                  const col = colorFor(l.name)
                  return (
                    <ClickableRow key={l.id} href={`/propietarios/${l.id}`} className="border-b border-line/60 last:border-0 hover:bg-cream-2 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-semibold shrink-0" style={{ backgroundColor: col + '22', color: col }}>{initials(l.name)}</span>
                          <span className="text-ink truncate">{l.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-dark tabular-nums whitespace-nowrap">{l.dniOrCuit ?? <span className="text-slate/50">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="leading-tight min-w-0">
                          <div className="text-slate-dark truncate max-w-[220px]">{l.email ?? <span className="text-slate/50">sin email</span>}</div>
                          {l.phone && <div className="text-slate text-[11px] tabular-nums">{l.phone}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-ink">{l.contractCount}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-slate-dark">{l.propertyCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink whitespace-nowrap">{l.monthlyRevenue > 0 ? fmt(l.monthlyRevenue) : <span className="text-slate/50">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ backgroundColor: t.color + '1f', color: t.color }}>{t.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right"><ChevronRight size={16} className="text-slate/50 inline" /></td>
                    </ClickableRow>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-[14px] text-slate">Ningún propietario coincide con la búsqueda</div>
          )}
        </div>
        {rows.length > 0 && (
          <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-3 flex-wrap shrink-0">
            <p className="text-[12px] text-slate tabular-nums">Mostrando {fromN} a {toN} de {rows.length} propietario{rows.length === 1 ? '' : 's'}</p>
            <TablePagination page={page} totalPages={totalPages} hrefFor={pageHref} />
          </div>
        )}
      </section>
    </div>
  )
}
