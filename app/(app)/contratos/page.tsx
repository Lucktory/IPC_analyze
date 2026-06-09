import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { FilterPill } from '@/components/ui/FilterPill'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { listContracts, type ContractListFilters } from '@/lib/entities/queries'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const fmtDate = (s: string) => {
  const d = new Date(s)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

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
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

interface PageProps {
  searchParams: Promise<{
    estado?:    string
    cadencia?: string
    q?:        string
  }>
}

export default async function ContratosPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filters: ContractListFilters = {
    estado:    (sp.estado as any) ?? 'todos',
    cadencia:  sp.cadencia ?? 'todas',
    q:         sp.q ?? '',
  }

  const { rows, counts } = await listContracts(filters)

  const totalRent = rows.filter(c => c.status === 'active').reduce((s, c) => s + c.currentRent, 0)

  // Build href preserving other filters; one helper so KPIs / pills share logic
  const buildHref = (overrides: Partial<Record<string, string>>) => {
    const params = new URLSearchParams()
    const merged = { ...filters, ...overrides }
    if (merged.estado   && merged.estado   !== 'todos') params.set('estado',   merged.estado)
    if (merged.cadencia && merged.cadencia !== 'todas') params.set('cadencia', merged.cadencia)
    if (merged.q)                                       params.set('q',        merged.q)
    const qs = params.toString()
    return qs ? `/contratos?${qs}` : '/contratos'
  }

  // KPIs become clickable filter chips (active state mirrors the current ?estado)
  const kpis = [
    {
      label: 'Total contratos',
      value: counts.todos.toString(),
      delta: 'todos los estados',
      tone:  'neutral' as const,
      href:  buildHref({ estado: 'todos' }),
      active: filters.estado === 'todos' || !filters.estado,
    },
    {
      label: 'Activos',
      value: counts.activo.toString(),
      delta: `${counts.rescindido} rescindidos`,
      tone:  'positive' as const,
      href:  buildHref({ estado: 'activo' }),
      active: filters.estado === 'activo',
    },
    {
      label: 'Por vencer',
      value: counts.por_vencer.toString(),
      delta: 'en próximos 60 días',
      tone:  counts.por_vencer > 0 ? 'negative' as const : 'neutral' as const,
      href:  buildHref({ estado: 'por_vencer' }),
      active: filters.estado === 'por_vencer',
    },
    {
      label: 'Alquiler activos',
      value: '$' + (totalRent / 1_000_000).toFixed(1) + ' M',
      delta: 'suma alquileres',
      tone:  'positive' as const,
      href:  buildHref({ estado: 'activo' }),
      active: filters.estado === 'activo',
    },
  ]

  const hasSecondaryFilter = filters.q || (filters.cadencia && filters.cadencia !== 'todas')

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
            <KPICard key={k.label} {...k} deltaTone={k.tone} />
          ))}
        </div>
      </StickyHeader>

      {/* FILTER STRIP — pills (no dropdowns) + auto-applying search */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card p-4 sm:p-5">
        {/* Rescindidos — only state without a KPI card, surfaced as a small pill row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label-cap text-slate mr-1">Estado</span>
          <FilterPill href={buildHref({ estado: 'rescindido' })} label="Rescindidos" count={counts.rescindido} active={filters.estado === 'rescindido'} />
          <span className="text-[11px] text-slate ml-1">— el resto se elige tocando una tarjeta arriba</span>
        </div>

        {/* Cadencia pills — replaces the dropdown */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="label-cap text-slate mr-1">Cadencia</span>
          <FilterPill href={buildHref({ cadencia: 'todas' })} label="Todas" active={!filters.cadencia || filters.cadencia === 'todas'} />
          {CADENCES.map(c => (
            <FilterPill key={c} href={buildHref({ cadencia: c })} label={cap(c)} active={filters.cadencia === c} />
          ))}
        </div>

        {/* Search — auto-applies as you type (300ms debounce) */}
        <div className="mt-4 flex flex-col gap-1.5 max-w-xl">
          <span className="label-cap">Búsqueda</span>
          <AutoSearchInput
            initialValue={filters.q ?? ''}
            placeholder="Buscar por inquilino o propietario… (se aplica al instante)"
          />
        </div>

        {hasSecondaryFilter && (
          <div className="mt-3">
            <Link
              href={buildHref({ q: '', cadencia: 'todas' })}
              className="inline-flex items-center px-3 h-8 text-[12px] text-slate hover:text-ink transition-colors"
            >
              ↺ Limpiar búsqueda y cadencia
            </Link>
          </div>
        )}
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
            <table className="w-full text-[13px] min-w-[980px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Inquilino</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Propietario</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Alquiler</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Cadencia</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Próx. aumento</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Vencimiento</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} ${c.status === 'rescinded' ? 'opacity-60' : ''} hover:bg-cream-2 transition-colors border-b border-line/30`}
                  >
                    <td className="px-4 py-1.5 text-ink font-medium border-r border-line/30">
                      <Link href={`/contratos/${c.id}`} className="hover:underline underline-offset-4 decoration-slate/40">
                        {c.primaryTenant}
                      </Link>
                    </td>
                    <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{c.primaryLandlord}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-ink border-r border-line/30">{fmt(c.currentRent)}</td>
                    <td className="px-4 py-1.5 text-slate-dark capitalize border-r border-line/30">{c.cadence}</td>
                    <td className="px-4 py-1.5 border-r border-line/30"><NextAdjustment date={c.nextAdjustment} /></td>
                    <td className="px-4 py-1.5 text-slate-dark tabular-nums border-r border-line/30">{fmtDate(c.endDate)}</td>
                    <td className="px-4 py-1.5"><StatusBadge status={c.status} /></td>
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

function NextAdjustment({ date }: { date: string | null }) {
  if (!date) return <span className="text-slate/50">—</span>
  const d = daysUntil(date)
  if (d <= 30) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded bg-cream-2 border border-line text-ink font-medium tabular-nums">
        {fmtMonthYear(date)}
      </span>
    )
  }
  return <span className="text-slate-dark tabular-nums">{fmtMonthYear(date)}</span>
}
