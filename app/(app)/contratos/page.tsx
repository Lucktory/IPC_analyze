import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { FilterPill } from '@/components/ui/FilterPill'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { StickyKPIStrip, StickyKPIStripItem } from '@/components/ui/StickyKPIStrip'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { listContracts, type ContractListFilters, type ContractRow } from '@/lib/entities/queries'
import { URGENCY_STYLES } from '@/lib/contract/urgency'

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
    estado?:     string
    cadencia?:   string
    q?:          string
    orden?:      string
    pendientes?: string
  }>
}

export default async function ContratosPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const orden      = sp.orden === 'fecha' ? 'fecha' : 'urgencia'
  const pendientes = sp.pendientes === '1'
  const filters: ContractListFilters = {
    estado:     (sp.estado as any) ?? 'todos',
    cadencia:   sp.cadencia ?? 'todas',
    q:          sp.q ?? '',
    orden,
    pendientes,
  }

  const { rows, counts } = await listContracts(filters)

  const totalRent = rows.filter(c => c.status === 'active').reduce((s, c) => s + c.currentRent, 0)
  const pendientesCount = rows.filter(c => c.urgency !== 'ok').length

  // Build href preserving other filters; one helper so KPIs / pills share logic
  const buildHref = (overrides: Partial<Record<string, string>>) => {
    const params = new URLSearchParams()
    const merged: Record<string, string> = {
      ...filters,
      orden,
      pendientes: pendientes ? '1' : '',
      ...overrides,
    } as any
    if (merged.estado     && merged.estado     !== 'todos')   params.set('estado',     merged.estado)
    if (merged.cadencia   && merged.cadencia   !== 'todas')   params.set('cadencia',   merged.cadencia)
    if (merged.q)                                              params.set('q',          merged.q)
    if (merged.orden      && merged.orden      !== 'urgencia') params.set('orden',      merged.orden)
    if (merged.pendientes === '1')                             params.set('pendientes', '1')
    const qs = params.toString()
    return qs ? `/contratos?${qs}` : '/contratos'
  }

  // Toggle-off URL for any estado-related card or pill
  const clearEstadoHref = buildHref({ estado: 'todos' })

  // KPIs become clickable filter chips; click an active one to toggle off
  const kpis = [
    {
      label: 'Total contratos',
      value: counts.todos.toString(),
      delta: 'todos los estados',
      tone:  'neutral' as const,
      href:  buildHref({ estado: 'todos' }),
      active: filters.estado === 'todos' || !filters.estado,
      // No clearHref — "Total contratos" IS the cleared state
    },
    {
      label: 'Activos',
      value: counts.activo.toString(),
      delta: `${counts.rescindido} rescindidos`,
      tone:  'positive' as const,
      href:  buildHref({ estado: 'activo' }),
      clearHref: clearEstadoHref,
      active: filters.estado === 'activo',
    },
    {
      // "Por vencer" links straight to the renovación action queue —
      // same contracts, but in a context where the action ("ask landlord
      // renew or rescind?") is explicit.
      label: 'Por vencer',
      value: counts.por_vencer.toString(),
      delta: 'tocá para acción',
      tone:  counts.por_vencer > 0 ? 'negative' as const : 'neutral' as const,
      href:  '/pendientes?tipo=renovacion',
      active: false,
    },
    {
      label: 'Alquiler activos',
      value: '$' + (totalRent / 1_000_000).toFixed(1) + ' M',
      delta: 'suma alquileres',
      tone:  'positive' as const,
      href:  buildHref({ estado: 'activo' }),
      clearHref: clearEstadoHref,
      active: filters.estado === 'activo',
    },
  ]

  const hasSecondaryFilter = filters.q || (filters.cadencia && filters.cadencia !== 'todas')

  // Short summary of currently active filters — shown in the condensed header
  const activeBits: string[] = []
  if (filters.estado === 'activo')     activeBits.push('Activos')
  if (filters.estado === 'por_vencer') activeBits.push('Por vencer')
  if (filters.estado === 'rescindido') activeBits.push('Rescindidos')
  if (filters.cadencia && filters.cadencia !== 'todas') activeBits.push(cap(filters.cadencia))
  const activeSummary = activeBits.join(' · ')

  return (
    <>
      <StickyHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap mb-2">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Contratos</strong>
            {' · '}
            {rows.length === counts.todos
              ? `${counts.todos}`
              : `${rows.length} de ${counts.todos}`}
            {activeSummary && <span className="text-slate"> · {activeSummary}</span>}
          </p>
          <div className="w-full sm:w-72 shrink-0 order-3 sm:order-none">
            <AutoSearchInput
              initialValue={filters.q ?? ''}
              placeholder="Buscar por inquilino o propietario…"
            />
          </div>
        </div>

        <StickyKPIStrip cols={4}>
          {kpis.map((k) => (
            <StickyKPIStripItem key={k.label}>
              <KPICard {...k} deltaTone={k.tone} />
            </StickyKPIStripItem>
          ))}
        </StickyKPIStrip>
      </StickyHeader>

      {/* FILTER STRIP — pill rows scroll naturally with the page */}
      <section className="mt-4 bg-paper border border-line rounded shadow-card p-3 sm:p-4">
        <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <span className="label-cap text-slate mr-1 shrink-0">Estado</span>
          <FilterPill
            href={buildHref({ estado: 'rescindido' })}
            clearHref={clearEstadoHref}
            label="Rescindidos"
            count={counts.rescindido}
            active={filters.estado === 'rescindido'}
          />
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto sm:flex-wrap pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <span className="label-cap text-slate mr-1 shrink-0">Cadencia</span>
          <FilterPill href={buildHref({ cadencia: 'todas' })} label="Todas" active={!filters.cadencia || filters.cadencia === 'todas'} />
          {CADENCES.map(c => (
            <FilterPill
              key={c}
              href={buildHref({ cadencia: c })}
              clearHref={buildHref({ cadencia: 'todas' })}
              label={cap(c)}
              active={filters.cadencia === c}
            />
          ))}
        </div>

        {/* Audit row: sort + Solo pendientes — the encargada's controls */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto sm:flex-wrap pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <span className="label-cap text-slate mr-1 shrink-0">Orden</span>
          <FilterPill href={buildHref({ orden: 'urgencia' })} label="Por urgencia" active={orden === 'urgencia'} />
          <FilterPill href={buildHref({ orden: 'fecha' })}    label="Por vencimiento" active={orden === 'fecha'} />
          <span className="label-cap text-slate ml-3 mr-1 shrink-0">Vista</span>
          <FilterPill
            href={buildHref({ pendientes: pendientes ? '' : '1' })}
            label="Solo pendientes"
            count={pendientesCount}
            active={pendientes}
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
                {rows.map((c, idx) => {
                  const u = URGENCY_STYLES[c.urgency]
                  const tinted   = !!u.row
                  const zebra    = tinted ? '' : (idx % 2 === 0 ? 'bg-cream/40' : '')
                  const cellTint = (c.urgency === 'critical' || c.urgency === 'warning')
                  const rentMissingClass = cellTint && !c.hasRentThisMonth ? u.cellTint : ''
                  const noteMissingClass = cellTint && !c.hasNoteThisMonth ? u.cellTint : ''
                  return (
                    <ClickableRow
                      key={c.id}
                      href={`/contratos/${c.id}`}
                      title={c.urgencyReasons.length ? c.urgencyReasons.join(' · ') : undefined}
                      className={[
                        zebra,
                        c.status === 'rescinded' ? 'opacity-60' : '',
                        u.row,
                        tinted ? '' : 'hover:bg-cream-2',
                        'transition-colors border-b border-line/30',
                      ].join(' ')}
                    >
                      <td className={`px-4 py-1.5 text-ink font-medium border-l-[4px] ${u.borderLeft} border-r border-line/30`}>
                        {c.primaryTenant}
                      </td>
                      <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{c.primaryLandlord}</td>
                      <td className={`px-4 py-1.5 text-right tabular-nums text-ink border-r border-line/30 ${rentMissingClass}`}>
                        {c.hasRentThisMonth ? fmt(c.currentRent) : <span className="text-danger font-medium">sin pago</span>}
                      </td>
                      <td className="px-4 py-1.5 text-slate-dark capitalize border-r border-line/30">{c.cadence}</td>
                      <td className="px-4 py-1.5 border-r border-line/30"><NextAdjustment date={c.nextAdjustment} /></td>
                      <td className="px-4 py-1.5 text-slate-dark tabular-nums border-r border-line/30">{fmtDate(c.endDate)}</td>
                      <td className={`px-4 py-1.5 ${noteMissingClass}`}>
                        <RowStatusBadge row={c} />
                      </td>
                    </ClickableRow>
                  )
                })}
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

/**
 * Status column for a contract row. Surfaces the urgency reason in the
 * badge when there is one so the badge always matches the row tint.
 *
 * Text color is forced light/dark to keep contrast against the row tint:
 *   - On a critical (orange-400) row, default text-danger red doesn't read.
 *     Force WHITE.
 *   - On a warning (yellow-300) row, default text-warn orange doesn't read.
 *     Force INK (dark).
 */
function RowStatusBadge({ row }: { row: ContractRow }) {
  // Non-active statuses short-circuit before the urgency switch.
  // (Schema enum: draft | active | suspended | ended | rescinded.)
  if (row.status === 'rescinded') return <Badge tone="danger">Rescindido</Badge>
  if (row.status === 'ended')     return <Badge tone="neutral">Finalizado</Badge>
  if (row.status === 'draft')     return <Badge tone="neutral">Borrador</Badge>
  if (row.status === 'suspended') return <Badge tone="warn">Suspendido</Badge>

  switch (row.urgency) {
    case 'critical':
      if (!row.hasRentThisMonth) return <Badge tone="danger">Sin pago</Badge>
      return <Badge tone="danger">Vence pronto</Badge>
    case 'warning':
      if (!row.hasRentThisMonth) return <Badge tone="warn">Sin pago</Badge>
      if (!row.hasNoteThisMonth) return <Badge tone="warn">Sin nota</Badge>
      return <Badge tone="warn">Por vencer</Badge>
    case 'recent':
      return <Badge tone="info">Activo · cambios</Badge>
    case 'upcoming':
      return <Badge tone="info">Aumento próximo</Badge>
    default:
      return <Badge tone="success">Activo</Badge>
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
