import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { FilterPill } from '@/components/ui/FilterPill'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { listContracts, listLandlords, type ContractListFilters } from '@/lib/entities/queries'

export const revalidate = 0

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const fmtDate = (s: string) => {
  const d = new Date(s)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// "Mayo 2026" — matches the manual "PROX. AUMENTO MAYO 2026" notation
// Alejandro uses on ~50 rows of his ledger.
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const fmtMonthYear = (s: string) => {
  const d = new Date(s)
  return `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`
}
const daysUntil = (s: string) => {
  const target = new Date(s)
  const today  = new Date()
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

const CADENCES = ['mensual', 'bimestral', 'trimestral', 'cuatrimestral', 'semestral', 'anual']

interface PageProps {
  searchParams: Promise<{
    estado?:     string
    cadencia?:  string
    propietario?: string
    q?:         string
  }>
}

export default async function ContratosPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filters: ContractListFilters = {
    estado:     (sp.estado as any) ?? 'todos',
    cadencia:   sp.cadencia ?? 'todas',
    landlordId: sp.propietario ?? 'todos',
    q:          sp.q ?? '',
  }

  const [{ rows, counts }, landlords] = await Promise.all([
    listContracts(filters),
    listLandlords(),
  ])

  const totalRent = rows.filter(c => c.status === 'active').reduce((s, c) => s + c.currentRent, 0)

  const kpis = [
    { label: 'Total contratos',  value: counts.todos.toString(),       delta: 'todos los estados',         tone: 'neutral'  as const },
    { label: 'Activos',          value: counts.activo.toString(),      delta: `${counts.rescindido} rescindidos`, tone: 'positive' as const },
    { label: 'Por vencer',       value: counts.por_vencer.toString(),  delta: 'en próximos 60 días',       tone: counts.por_vencer > 0 ? 'negative' as const : 'neutral' as const },
    { label: 'Alquiler activos', value: '$' + (totalRent / 1_000_000).toFixed(1) + ' M', delta: 'suma alquileres', tone: 'positive' as const },
  ]

  // Build href helpers that preserve other filters when one changes
  const buildHref = (overrides: Partial<Record<string, string>>) => {
    const params = new URLSearchParams()
    const merged = { ...filters, ...overrides }
    if (merged.estado     && merged.estado     !== 'todos') params.set('estado',      merged.estado)
    if (merged.cadencia   && merged.cadencia   !== 'todas') params.set('cadencia',    merged.cadencia)
    if (merged.landlordId && merged.landlordId !== 'todos') params.set('propietario', merged.landlordId)
    if (merged.q)                                            params.set('q',          merged.q)
    const qs = params.toString()
    return qs ? `/contratos?${qs}` : '/contratos'
  }

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] text-slate-dark">
            <strong className="text-ink font-medium">Contratos</strong> ·{' '}
            {rows.length === counts.todos
              ? `${counts.todos} en total`
              : `${rows.length} de ${counts.todos} filtrados`}
          </p>
          <p className="label-cap text-slate">Datos en vivo · Mayo 2026</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
          ))}
        </div>
      </StickyHeader>

      {/* FILTER STRIP */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card p-4 sm:p-5">
        {/* Row 1: status pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label-cap text-slate mr-1">Estado</span>
          <FilterPill href={buildHref({ estado: 'todos' })}      label="Todos"       count={counts.todos}      active={filters.estado === 'todos'      || !filters.estado} />
          <FilterPill href={buildHref({ estado: 'activo' })}     label="Activos"     count={counts.activo}     active={filters.estado === 'activo'} />
          <FilterPill href={buildHref({ estado: 'por_vencer' })} label="Por vencer"  count={counts.por_vencer} active={filters.estado === 'por_vencer'} />
          <FilterPill href={buildHref({ estado: 'rescindido' })} label="Rescindidos" count={counts.rescindido} active={filters.estado === 'rescindido'} />
        </div>

        {/* Row 2: search + secondary filters */}
        <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
          {/* Preserve other filters across form submit */}
          {filters.estado     && filters.estado     !== 'todos' && <input type="hidden" name="estado"      value={filters.estado} />}

          <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <span className="label-cap">Búsqueda</span>
            <input
              type="text"
              name="q"
              defaultValue={filters.q ?? ''}
              placeholder="Buscar por inquilino o propietario…"
              className="h-9 px-3 rounded border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label-cap">Cadencia</span>
            <select
              name="cadencia"
              defaultValue={filters.cadencia ?? 'todas'}
              className="h-9 px-3 rounded border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors capitalize"
            >
              <option value="todas">Todas</option>
              {CADENCES.map(c => <option key={c} value={c} className="capitalize">{c[0].toUpperCase() + c.slice(1)}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label-cap">Propietario</span>
            <select
              name="propietario"
              defaultValue={filters.landlordId ?? 'todos'}
              className="h-9 px-3 rounded border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors max-w-[220px]"
            >
              <option value="todos">Todos</option>
              {landlords.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>

          <button
            type="submit"
            className="h-9 px-4 bg-ink text-paper rounded text-[12px] font-medium hover:opacity-90 transition-opacity"
          >
            Filtrar
          </button>

          {(filters.q || (filters.cadencia && filters.cadencia !== 'todas') || (filters.landlordId && filters.landlordId !== 'todos')) && (
            <Link
              href={buildHref({ q: '', cadencia: 'todas', propietario: 'todos' })}
              className="h-9 inline-flex items-center px-3 text-[12px] text-slate hover:text-ink transition-colors"
            >
              Limpiar
            </Link>
          )}
        </form>
      </section>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Listado</h2>
            <p className="text-[12px] text-slate mt-0.5">Ordenados por fecha de inicio descendente</p>
          </div>
          <p className="text-[12px] text-slate tabular-nums">{rows.length} resultado{rows.length === 1 ? '' : 's'}</p>
        </div>
        <div className="overflow-x-auto">
          {rows.length > 0 ? (
            <table className="w-full text-[13px] min-w-[980px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Inquilino</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Propietario</th>
                  <th className="text-right px-5 py-2.5 label-cap font-medium">Alquiler</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Cadencia</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Próx. aumento</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Vencimiento</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} ${c.status === 'rescinded' ? 'opacity-60' : ''} hover:bg-cream-2 transition-colors`}
                  >
                    <td className="px-5 py-3 text-ink font-medium">
                      <Link href={`/contratos/${c.id}`} className="hover:underline underline-offset-4 decoration-slate/40">
                        {c.primaryTenant}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-dark">{c.primaryLandlord}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink">{fmt(c.currentRent)}</td>
                    <td className="px-5 py-3 text-slate-dark capitalize">{c.cadence}</td>
                    <td className="px-5 py-3"><NextAdjustment date={c.nextAdjustment} /></td>
                    <td className="px-5 py-3 text-slate-dark tabular-nums">{fmtDate(c.endDate)}</td>
                    <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate">Ningún contrato coincide con los filtros aplicados</p>
            </div>
          )}
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
    default:           return <Badge tone="neutral">{status}</Badge>
  }
}

// "Próx. aumento" cell. Surfaces what Alejandro tracks manually as
// "PROX. AUMENTO MAYO 2026" in the spreadsheet. Visual emphasis grows as the
// adjustment date approaches.
function NextAdjustment({ date }: { date: string | null }) {
  if (!date) return <span className="text-slate/50">—</span>
  const d = daysUntil(date)
  // ≤ 30 days → ink + soft cream-2 pill (eye magnet for Alejandro's reminder)
  if (d <= 30) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded bg-cream-2 border border-line text-ink font-medium tabular-nums">
        {fmtMonthYear(date)}
      </span>
    )
  }
  // > 30 days → muted, no emphasis
  return <span className="text-slate-dark tabular-nums">{fmtMonthYear(date)}</span>
}
