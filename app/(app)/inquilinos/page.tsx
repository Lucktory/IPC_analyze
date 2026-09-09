import Link from 'next/link'
import { Users, CircleCheck, CircleAlert, UserX, SlidersHorizontal, Plus, ChevronRight } from 'lucide-react'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { FilterPill } from '@/components/ui/FilterPill'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { TablePagination } from '@/components/ui/TablePagination'
import { StatCard } from '@/components/ui/StatCard'
import { listTenants, type EstadoPago } from '@/lib/entities/queries'
import { getDashboardPeriod } from '@/lib/dashboard/queries'
import { fmtMoney as fmt, fmtInt } from '@/lib/format'

const PER_PAGE = 12
const AVATAR_COLORS = ['#3B82F6', '#16A34A', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899']
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const colorFor = (s: string) => AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]

interface PageProps {
  searchParams: Promise<{ tipo?: string; q?: string; pagina?: string }>
}

export default async function InquilinosPage({ searchParams }: PageProps) {
  const sp   = await searchParams
  const tipo = sp.tipo ?? 'todos'
  const q    = (sp.q ?? '').trim().toLowerCase()

  const dashPeriod = await getDashboardPeriod()
  const all = await listTenants(dashPeriod)

  const total    = all.length
  const alDia     = all.filter(t => t.estadoPago === 'al_dia').length
  const enMoraSet = all.filter(t => t.estadoPago === 'en_mora' || t.estadoPago === 'sin_pago')
  const enMora    = enMoraSet.length
  // Sum the shortfall per DISTINCT contract (co-tenants share one contract, so
  // don't count the same debt twice).
  const moraByContract = new Map<string, number>()
  for (const t of enMoraSet) if (t.contractId) moraByContract.set(t.contractId, t.debtAmount)
  const moraMonto = [...moraByContract.values()].reduce((s, v) => s + v, 0)
  const sinContrato = all.filter(t => t.estadoPago === 'sin_contrato').length
  const pctAlDia  = total > 0 ? (alDia / total) * 100 : 0

  let rows = all
  if (tipo === 'al_dia')          rows = rows.filter(t => t.estadoPago === 'al_dia')
  else if (tipo === 'en_mora')    rows = rows.filter(t => t.estadoPago === 'en_mora' || t.estadoPago === 'sin_pago')
  else if (tipo === 'sin_contrato') rows = rows.filter(t => t.estadoPago === 'sin_contrato')
  if (q) {
    rows = rows.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.dni ?? '').toLowerCase().includes(q) ||
      (t.contractNumber ?? '').toLowerCase().includes(q) ||
      (t.propertyAddress ?? '').toLowerCase().includes(q) ||
      (t.phone ?? '').toLowerCase().includes(q) ||
      (t.email ?? '').toLowerCase().includes(q))
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const page       = Math.min(Math.max(1, parseInt(sp.pagina ?? '1', 10) || 1), totalPages)
  const pageRows   = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const fromN      = rows.length === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const toN        = Math.min(page * PER_PAGE, rows.length)

  const buildHref = (o: Partial<Record<string, string>>) => {
    const params = new URLSearchParams()
    const m = { tipo, q, ...o }
    if (m.tipo && m.tipo !== 'todos') params.set('tipo', m.tipo)
    if (m.q) params.set('q', m.q)
    const qs = params.toString()
    return qs ? `/inquilinos?${qs}` : '/inquilinos'
  }
  const pageHref = (n: number) => {
    const base = buildHref({})
    const sep = base.includes('?') ? '&' : '?'
    return n <= 1 ? base : `${base}${sep}pagina=${n}`
  }

  const stats = [
    { key: 'total',   label: 'Inquilinos',   value: fmtInt(total),      sub: 'Total registrados',       Icon: Users,       color: '#3B82F6', href: buildHref({ tipo: 'todos' }),        active: tipo === 'todos' },
    { key: 'aldia',   label: 'Al día',       value: fmtInt(alDia),      sub: `${pctAlDia.toFixed(0)}% del total`, Icon: CircleCheck, color: '#16A34A', href: buildHref({ tipo: 'al_dia' }),       active: tipo === 'al_dia' },
    { key: 'mora',    label: 'En mora',      value: fmtInt(enMora),     sub: fmt(moraMonto),            Icon: CircleAlert, color: '#EF4444', href: buildHref({ tipo: 'en_mora' }),      active: tipo === 'en_mora' },
    { key: 'sincon',  label: 'Sin contrato', value: fmtInt(sinContrato), sub: 'Sin contrato vigente',    Icon: UserX,       color: '#8A93A5', href: buildHref({ tipo: 'sin_contrato' }), active: tipo === 'sin_contrato' },
  ]

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
      <header className="shrink-0">
        <h1 className="text-[24px] font-semibold text-ink tracking-tight">Inquilinos</h1>
        <nav className="text-[12px] text-slate mt-1 flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Inquilinos</span>
        </nav>
      </header>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="flex-1 min-w-[220px]">
          <AutoSearchInput initialValue={sp.q ?? ''} placeholder="Buscar inquilino, DNI, contrato o propiedad…" resetParams={['pagina']} />
        </div>
        <details className="relative">
          <summary className="list-none inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-ink bg-paper hover:border-info/40 text-[13px] cursor-pointer transition-colors [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal size={15} /> Filtros
          </summary>
          <div className="absolute right-0 mt-2 z-30 w-[240px] bg-paper border border-line rounded-xl shadow-lg p-3.5">
            <span className="label-cap text-slate">Estado de pago</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <FilterPill href={buildHref({ tipo: 'al_dia' })}   clearHref={buildHref({ tipo: 'todos' })} label="Al día"       active={tipo === 'al_dia'} />
              <FilterPill href={buildHref({ tipo: 'en_mora' })}  clearHref={buildHref({ tipo: 'todos' })} label="En mora"      active={tipo === 'en_mora'} />
              <FilterPill href={buildHref({ tipo: 'sin_contrato' })} clearHref={buildHref({ tipo: 'todos' })} label="Sin contrato" active={tipo === 'sin_contrato'} />
            </div>
          </div>
        </details>
        <Link href="/inquilinos/nuevo" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-info text-white text-[13px] font-medium hover:brightness-110 transition-all shrink-0">
          <Plus size={16} /> Nuevo inquilino
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
            <table className="w-full text-[13px] min-w-[980px]">
              <thead className="sticky top-0 z-10 bg-paper">
                <tr className="border-b border-line">
                  {['Inquilino', 'DNI', 'Contacto', 'Contrato', 'Propiedad', 'Alquiler', 'Estado de pago', ''].map((h, i) => (
                    <th key={i} className={`label-cap font-medium text-slate px-4 py-2.5 ${h === 'Alquiler' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(t => {
                  const col = colorFor(t.name)
                  return (
                    <ClickableRow key={t.id} href={`/inquilinos/${t.id}`} className="border-b border-line/60 last:border-0 hover:bg-cream-2 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-semibold shrink-0" style={{ backgroundColor: col + '22', color: col }}>{initials(t.name)}</span>
                          <span className="text-ink truncate">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-dark tabular-nums whitespace-nowrap">{t.dni ?? <span className="text-slate/50">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="leading-tight min-w-0">
                          {t.phone && <div className="text-slate-dark tabular-nums">{t.phone}</div>}
                          <div className="text-slate text-[11px] truncate max-w-[200px]">{t.email ?? 'sin email'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-dark whitespace-nowrap">{t.contractNumber ?? <span className="text-slate/50">—</span>}</td>
                      <td className="px-4 py-3">
                        {t.propertyAddress ? (
                          <div className="leading-tight min-w-0">
                            <div className="text-ink truncate max-w-[190px]">{t.propertyAddress}</div>
                            {t.propertyCity && <div className="text-slate text-[11px] truncate">{t.propertyCity}</div>}
                          </div>
                        ) : <span className="text-slate/50">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink whitespace-nowrap">{t.rent > 0 ? fmt(t.rent) : <span className="text-slate/50">—</span>}</td>
                      <td className="px-4 py-3"><EstadoBadge estado={t.estadoPago} /></td>
                      <td className="px-4 py-3 text-right"><ChevronRight size={16} className="text-slate/50 inline" /></td>
                    </ClickableRow>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-[14px] text-slate">Ningún inquilino coincide con la búsqueda</div>
          )}
        </div>
        {rows.length > 0 && (
          <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-3 flex-wrap shrink-0">
            <p className="text-[12px] text-slate tabular-nums">Mostrando {fromN} a {toN} de {rows.length} inquilino{rows.length === 1 ? '' : 's'}</p>
            <TablePagination page={page} totalPages={totalPages} hrefFor={pageHref} />
          </div>
        )}
      </section>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: EstadoPago }) {
  const map: Record<EstadoPago, { label: string; cls: string }> = {
    al_dia:       { label: 'Al día',       cls: 'bg-success/15 text-success' },
    en_mora:      { label: 'En mora',      cls: 'bg-danger/15 text-danger' },
    sin_pago:     { label: 'Sin pago',     cls: 'border border-danger/50 text-danger' },
    sin_contrato: { label: 'Sin contrato', cls: 'bg-slate/15 text-slate' },
  }
  const s = map[estado]
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${s.cls}`}>{s.label}</span>
}
