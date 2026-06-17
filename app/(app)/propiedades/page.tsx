import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { StickyKPIStrip, StickyKPIStripItem } from '@/components/ui/StickyKPIStrip'
import { FilterPill } from '@/components/ui/FilterPill'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { listProperties, type PropertyRow } from '@/lib/entities/queries'
import { URGENCY_STYLES } from '@/lib/urgency'
import { fmtMoney as fmt } from '@/lib/format'

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
      p.landlords.some(l => l.name.toLowerCase().includes(ql)) ||
      p.tenants.some(t => t.name.toLowerCase().includes(ql)),
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

  const buildHref = (overrides: Partial<{ estado: Estado; tipo: string; q: string }>) => {
    const params = new URLSearchParams()
    const merged = { estado, tipo, q, ...overrides }
    if (merged.estado && merged.estado !== 'todos') params.set('estado', merged.estado)
    if (merged.tipo   && merged.tipo   !== 'todos') params.set('tipo',   merged.tipo)
    if (merged.q)                                    params.set('q',      merged.q)
    const qs = params.toString()
    return qs ? `/propiedades?${qs}` : '/propiedades'
  }

  const clearEstadoHref = buildHref({ estado: 'todos' })
  const clearTipoHref   = buildHref({ tipo:   'todos' })

  const kpis = [
    {
      label: 'Total propiedades',
      value: counts.todos.toString(),
      delta: 'en cartera',
      tone:  'neutral' as const,
      href:  buildHref({ estado: 'todos' }),
      active: estado === 'todos',
    },
    {
      label: 'Ocupadas',
      value: counts.ocupadas.toString(),
      delta: counts.todos > 0 ? `${Math.round((counts.ocupadas / counts.todos) * 100)}% ocupación` : 'sin datos',
      tone:  'positive' as const,
      href:  buildHref({ estado: 'ocupadas' }),
      clearHref: clearEstadoHref,
      active: estado === 'ocupadas',
    },
    {
      label: 'Vacantes',
      value: counts.vacantes.toString(),
      delta: 'requieren ocupar',
      tone:  counts.vacantes > 0 ? 'negative' as const : 'neutral' as const,
      href:  buildHref({ estado: 'vacantes' }),
      clearHref: clearEstadoHref,
      active: estado === 'vacantes',
    },
    {
      label: 'Locales',
      value: (byType.get('local') ?? 0).toString(),
      delta: 'comerciales',
      tone:  'neutral' as const,
      href:  buildHref({ tipo: 'local' }),
      clearHref: clearTipoHref,
      active: tipo === 'local',
    },
  ]

  const activeBits: string[] = []
  if (estado === 'ocupadas') activeBits.push('Ocupadas')
  if (estado === 'vacantes') activeBits.push('Vacantes')
  if (tipo !== 'todos')      activeBits.push(TYPE_LABEL[tipo] ?? tipo)
  const activeSummary = activeBits.join(' · ')

  return (
    <>
      <StickyHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap mb-2">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Propiedades</strong>
            {' · '}
            {sortedRows.length === counts.todos ? `${counts.todos}` : `${sortedRows.length} de ${counts.todos}`}
            {activeSummary && <span className="text-slate"> · {activeSummary}</span>}
          </p>
          <div className="flex items-center gap-2 order-3 sm:order-none">
            <div className="w-full sm:w-72 shrink-0">
              <AutoSearchInput initialValue={q} placeholder="Buscar por dirección, propietario o inquilino…" />
            </div>
            <Link
              href="/propiedades/nuevo"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-ink text-paper text-[12px] font-medium hover:opacity-90 transition-opacity shrink-0"
            >
              + Nueva
            </Link>
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

      <section className="mt-4 bg-paper border border-line rounded shadow-card p-3 sm:p-4">
        <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <span className="label-cap text-slate mr-1 shrink-0">Tipo</span>
          <FilterPill href={buildHref({ tipo: 'todos' })} label="Todos" active={!tipo || tipo === 'todos'} />
          {TYPES.map(t => (
            <FilterPill key={t} href={buildHref({ tipo: t })} clearHref={clearTipoHref} label={TYPE_LABEL[t]} active={tipo === t} />
          ))}
        </div>

        {(q || tipo !== 'todos') && (
          <div className="mt-3">
            <Link
              href={buildHref({ q: '', tipo: 'todos' })}
              className="inline-flex items-center px-3 h-8 text-[12px] text-slate hover:text-ink transition-colors"
            >
              ↺ Limpiar búsqueda y tipo
            </Link>
          </div>
        )}
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
            <table className="w-full text-[13px] min-w-[960px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Dirección</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Tipo</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Propietarios</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Inquilinos</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Alquiler</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((p, idx) => {
                  const u = URGENCY_STYLES[p.urgency]
                  const tinted = !!u.row
                  const zebra  = tinted ? '' : (idx % 2 === 0 ? 'bg-cream/40' : '')
                  return (
                    <ClickableRow
                      key={p.id}
                      href={`/propiedades/${p.id}`}
                      title={p.urgencyReasons.length ? p.urgencyReasons.join(' · ') : undefined}
                      className={`${zebra} ${u.row} ${tinted ? '' : 'hover:bg-cream-2'} transition-colors border-b border-line/30 align-top`}
                    >
                      <td className={`px-4 py-1.5 text-ink font-medium border-l-[4px] ${u.borderLeft} border-r border-line/30`}>{cleanAddress(p.address)}</td>
                      <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{TYPE_LABEL[p.propertyType] ?? p.propertyType}</td>
                      <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">
                        <NamesCell
                          count={p.landlords.length}
                          items={p.landlords.map(l => ({ id: l.id, name: l.name, pct: l.ownershipPct }))}
                        />
                      </td>
                      <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">
                        <NamesCell
                          count={p.tenants.length}
                          items={p.tenants.map(t => ({ id: t.id, name: t.name, pct: t.sharePct }))}
                        />
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-ink border-r border-line/30">
                        {p.currentRent > 0 ? fmt(p.currentRent) : ''}
                      </td>
                      <td className="px-4 py-1.5">
                        {p.isVacant
                          ? <Badge tone="warn">Vacante</Badge>
                          : <Badge tone="success">Ocupada</Badge>}
                      </td>
                    </ClickableRow>
                  )
                })}
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

// ────────────────────────────────────────────────────────────────────────────
// NamesCell — stacked-names list inside a single cell.
//
// Rule (saved memory: ui_multi_name_cell_display.md): when multiple people
// of the same kind belong to one row, each name renders on its own line
// inside the cell. Never comma-separated, never truncated with "y N más",
// never hidden behind a tooltip. The count is shown as a small badge so
// the encargada can scan how many at a glance.
// ────────────────────────────────────────────────────────────────────────────
function NamesCell({
  count,
  items,
}: {
  count: number
  items: { id: string; name: string; pct: number }[]
}) {
  if (count === 0) {
    return <span className="text-slate/50">—</span>
  }
  return (
    <div>
      <p className="text-[10px] text-slate font-medium tracking-wider uppercase mb-0.5">
        {count} {count === 1 ? 'persona' : 'personas'}
      </p>
      {items.map(it => (
        <div key={it.id} className="flex items-baseline justify-between gap-2">
          <span className="text-ink leading-snug">{it.name}</span>
          <span className="text-[10px] text-slate tabular-nums shrink-0">
            {it.pct.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  )
}
