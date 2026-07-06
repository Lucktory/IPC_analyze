import Link from 'next/link'
import { Users, CalendarClock, RefreshCw, XCircle, Layers, SlidersHorizontal, Plus, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { FilterPill } from '@/components/ui/FilterPill'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { listContracts, type ContractListFilters, type ContractRow } from '@/lib/entities/queries'
import { fmtMoney as fmt, fmtDate } from '@/lib/format'

const CADENCES = ['mensual', 'bimestral', 'trimestral', 'cuatrimestral', 'semestral', 'anual']
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const PER_PAGE = 10

interface PageProps {
  searchParams: Promise<{
    estado?:     string
    cadencia?:   string
    q?:          string
    orden?:      string
    pendientes?: string
    pagina?:     string
  }>
}

export default async function ContratosPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const orden      = sp.orden === 'fecha' ? 'fecha' : 'urgencia'
  const pendientes = sp.pendientes === '1'
  const filters: ContractListFilters = {
    estado:   (sp.estado as any) ?? 'todos',
    cadencia: sp.cadencia ?? 'todas',
    q:        sp.q ?? '',
    orden,
    pendientes,
  }

  const { rows, counts } = await listContracts(filters)

  // Pagination (in-memory slice; listContracts returns the full filtered set)
  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const page       = Math.min(Math.max(1, parseInt(sp.pagina ?? '1', 10) || 1), totalPages)
  const pageRows   = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const fromN      = rows.length === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const toN        = Math.min(page * PER_PAGE, rows.length)

  // Filter href — never carries `pagina`, so changing a filter resets to page 1
  const buildHref = (overrides: Partial<Record<string, string>>) => {
    const p = new URLSearchParams()
    const m: Record<string, string> = {
      estado: filters.estado as string, cadencia: filters.cadencia as string,
      q: filters.q as string, orden, pendientes: pendientes ? '1' : '', ...overrides,
    }
    if (m.estado     && m.estado     !== 'todos')    p.set('estado',     m.estado)
    if (m.cadencia   && m.cadencia   !== 'todas')    p.set('cadencia',   m.cadencia)
    if (m.q)                                          p.set('q',          m.q)
    if (m.orden      && m.orden      !== 'urgencia')  p.set('orden',      m.orden)
    if (m.pendientes === '1')                         p.set('pendientes', '1')
    const qs = p.toString()
    return qs ? `/contratos?${qs}` : '/contratos'
  }
  // Page href — keeps the current filters and sets `pagina`
  const pageHref = (n: number) => {
    const base = buildHref({})
    const sep  = base.includes('?') ? '&' : '?'
    return n <= 1 ? base : `${base}${sep}pagina=${n}`
  }
  const clearEstado = buildHref({ estado: 'todos' })

  const stats = [
    { key: 'activo',  label: 'Activos',         value: counts.activo,     sub: `de ${counts.todos} contratos`, Icon: Users,         color: '#3B82F6', href: buildHref({ estado: 'activo' }),      active: filters.estado === 'activo' },
    { key: 'vence',   label: 'Vencen este mes', value: counts.vence_mes,  sub: 'próximos 30 días',             Icon: CalendarClock, color: '#F59E0B', href: buildHref({ estado: 'por_vencer' }),  active: false },
    { key: 'renovar', label: 'Renovar',         value: counts.por_vencer, sub: 'próximos 60 días',             Icon: RefreshCw,     color: '#16A34A', href: '/pendientes?tipo=renovacion',        active: false },
    { key: 'resc',    label: 'Rescindidos',     value: counts.rescindido, sub: 'histórico',                    Icon: XCircle,       color: '#EF4444', href: buildHref({ estado: 'rescindido' }),  active: filters.estado === 'rescindido' },
    { key: 'total',   label: 'Total',           value: counts.todos,      sub: 'todos los estados',            Icon: Layers,        color: '#8B5CF6', href: buildHref({ estado: 'todos' }),       active: !filters.estado || filters.estado === 'todos' },
  ]

  const secondaryActive = (filters.cadencia && filters.cadencia !== 'todas') || orden === 'fecha' || pendientes

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight">Contratos</h1>
        <nav className="text-[12px] text-slate mt-1 flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Contratos</span>
        </nav>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map(s => (
          <Link
            key={s.key}
            href={s.href}
            className={`rounded-xl border bg-paper p-4 flex flex-col gap-3 transition-colors ${
              s.active ? 'border-info ring-1 ring-info/30' : 'border-line hover:border-info/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0" style={{ backgroundColor: s.color + '1f', color: s.color }}>
                <s.Icon size={18} />
              </span>
              <span className="text-[12px] font-medium text-slate leading-tight">{s.label}</span>
            </div>
            <div>
              <p className="text-[26px] font-semibold text-ink leading-none tabular-nums">{s.value.toLocaleString('es-AR')}</p>
              <p className="text-[11px] text-slate mt-1.5">{s.sub}</p>
            </div>
          </Link>
        ))}
      </section>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <AutoSearchInput initialValue={filters.q ?? ''} placeholder="Buscar por propietario o inquilino…" resetParams={['pagina']} />
        </div>

        <details className="relative">
          <summary className={`list-none inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] cursor-pointer transition-colors [&::-webkit-details-marker]:hidden ${
            secondaryActive ? 'border-info text-info bg-info/5' : 'border-line text-ink bg-paper hover:border-info/40'
          }`}>
            <SlidersHorizontal size={15} /> Filtros
          </summary>
          <div className="absolute right-0 mt-2 z-30 w-[320px] bg-paper border border-line rounded-xl shadow-lg p-3.5 space-y-3">
            <div>
              <span className="label-cap text-slate">Cadencia</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <FilterPill href={buildHref({ cadencia: 'todas' })} label="Todas" active={!filters.cadencia || filters.cadencia === 'todas'} />
                {CADENCES.map(c => (
                  <FilterPill key={c} href={buildHref({ cadencia: c })} clearHref={buildHref({ cadencia: 'todas' })} label={cap(c)} active={filters.cadencia === c} />
                ))}
              </div>
            </div>
            <div>
              <span className="label-cap text-slate">Orden</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <FilterPill href={buildHref({ orden: 'urgencia' })} label="Por urgencia" active={orden === 'urgencia'} />
                <FilterPill href={buildHref({ orden: 'fecha' })} label="Por vencimiento" active={orden === 'fecha'} />
              </div>
            </div>
            <div>
              <span className="label-cap text-slate">Vista</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <FilterPill href={buildHref({ pendientes: pendientes ? '' : '1' })} label="Solo pendientes" active={pendientes} />
              </div>
            </div>
          </div>
        </details>

        <Link
          href="/contratos/nuevo"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-info text-white text-[13px] font-medium hover:brightness-110 transition-all shrink-0"
        >
          <Plus size={16} /> Nuevo contrato
        </Link>
      </div>

      {/* Table */}
      <section className="bg-paper border border-line rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          {pageRows.length > 0 ? (
            <table className="w-full text-[13px] min-w-[940px]">
              <thead>
                <tr className="border-b border-line">
                  {['ID Contrato', 'Propietario', 'Inquilino', 'Propiedad', 'Alquiler', 'Cadencia', 'Vigencia', 'Estado', ''].map((h, i) => (
                    <th key={i} className={`label-cap font-medium text-slate px-4 py-2.5 ${h === 'Alquiler' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(c => (
                  <ClickableRow
                    key={c.id}
                    href={`/contratos/${c.id}`}
                    className={`border-b border-line/60 last:border-0 hover:bg-cream-2 transition-colors ${c.status === 'rescinded' ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-ink tabular-nums whitespace-nowrap">
                      {c.contractNumber ?? <span className="text-slate">#{c.id.slice(0, 8)}</span>}
                    </td>
                    <td className="px-4 py-3 text-ink truncate max-w-[170px]">{c.primaryLandlord}</td>
                    <td className="px-4 py-3 text-slate-dark truncate max-w-[170px]">{c.primaryTenant}</td>
                    <td className="px-4 py-3">
                      <div className="leading-tight min-w-0">
                        <div className="text-ink truncate max-w-[200px]">{c.propertyAddress ?? '—'}{c.propertyUnit ? ` ${c.propertyUnit}` : ''}</div>
                        {c.propertyCity && <div className="text-slate text-[11px] truncate">{c.propertyCity}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink whitespace-nowrap">{fmt(c.currentRent)}</td>
                    <td className="px-4 py-3 text-slate-dark">{cap(c.cadence)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${vigenciaDot(c)}`} />
                        <div className="leading-tight tabular-nums">
                          <div className="text-slate-dark">{fmtDate(c.startDate)}</div>
                          <div className="text-slate">{fmtDate(c.endDate)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><EstadoBadge c={c} /></td>
                    <td className="px-4 py-3 text-right"><ChevronRight size={16} className="text-slate/50 inline" /></td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-[14px] text-slate">Ningún contrato coincide con los filtros aplicados</div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[12px] text-slate tabular-nums">
              Mostrando {fromN} a {toN} de {rows.length} contrato{rows.length === 1 ? '' : 's'}
            </p>
            <Pagination page={page} totalPages={totalPages} hrefFor={pageHref} />
          </div>
        )}
      </section>
    </div>
  )
}

// ── Vigencia dot: green active, amber vence ≤60d, red vencido, gray inactive ──
function vigenciaDot(c: ContractRow): string {
  if (c.status !== 'active') return 'bg-slate/40'
  const end = new Date(c.endDate).getTime()
  const now = Date.now()
  if (end < now) return 'bg-danger'
  if (end - now <= 60 * 86400000) return 'bg-warn'
  return 'bg-success'
}

// ── Estado badge — matches the mockup's Activo / Por vencer / Vencido set ──
function EstadoBadge({ c }: { c: ContractRow }) {
  if (c.status === 'rescinded') return <Badge tone="danger">Rescindido</Badge>
  if (c.status === 'ended')     return <Badge tone="neutral">Finalizado</Badge>
  if (c.status === 'draft')     return <Badge tone="neutral">Borrador</Badge>
  if (c.status === 'suspended') return <Badge tone="warn">Suspendido</Badge>
  const end = new Date(c.endDate).getTime()
  const now = Date.now()
  if (end < now) return <Badge tone="danger">Vencido</Badge>
  if (end - now <= 60 * 86400000) return <Badge tone="warn">Por vencer</Badge>
  return <Badge tone="success">Activo</Badge>
}

// ── Pagination — first / neighbors / last with ellipses ──
function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (n: number) => string }) {
  if (totalPages <= 1) return null
  const nums: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) nums.push(i)
  } else {
    nums.push(1)
    if (page > 3) nums.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) nums.push(i)
    if (page < totalPages - 2) nums.push('…')
    nums.push(totalPages)
  }
  const arrow = (label: string, to: number, disabled: boolean) =>
    disabled
      ? <span className="min-w-8 h-8 grid place-items-center text-slate/30 text-[13px]">{label}</span>
      : <Link href={hrefFor(to)} className="min-w-8 h-8 grid place-items-center rounded-md text-slate-dark hover:bg-cream-2 text-[13px]">{label}</Link>
  return (
    <div className="flex items-center gap-1">
      {arrow('‹', page - 1, page <= 1)}
      {nums.map((n, i) => n === '…'
        ? <span key={`e${i}`} className="px-1.5 text-slate">…</span>
        : <Link key={n} href={hrefFor(n)} className={`min-w-8 h-8 px-2 grid place-items-center rounded-md text-[13px] tabular-nums transition-colors ${
            n === page ? 'bg-info text-white font-medium' : 'text-slate-dark hover:bg-cream-2'
          }`}>{n}</Link>)}
      {arrow('›', page + 1, page >= totalPages)}
    </div>
  )
}
