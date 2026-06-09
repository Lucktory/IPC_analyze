import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { StickyKPIStrip, StickyKPIStripItem } from '@/components/ui/StickyKPIStrip'
import { FilterPill } from '@/components/ui/FilterPill'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { listTenants, type TenantRow } from '@/lib/entities/queries'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

type Tipo = 'todos' | 'con_contrato' | 'sin_contrato' | 'sin_telefono' | 'sin_email'

interface PageProps {
  searchParams: Promise<{
    tipo?: string
    q?:    string
  }>
}

export default async function InquilinosPage({ searchParams }: PageProps) {
  const sp   = await searchParams
  const tipo = (sp.tipo as Tipo) ?? 'todos'
  const q    = sp.q?.trim() ?? ''

  const all  = await listTenants()

  const match = (t: TenantRow, kind: Tipo) => {
    switch (kind) {
      case 'con_contrato':  return t.contractCount > 0
      case 'sin_contrato':  return t.contractCount === 0
      case 'sin_telefono':  return !t.phone
      case 'sin_email':     return !t.email
      default:              return true
    }
  }

  const counts = {
    todos:         all.length,
    con_contrato:  all.filter(t => match(t, 'con_contrato')).length,
    sin_contrato:  all.filter(t => match(t, 'sin_contrato')).length,
    sin_telefono:  all.filter(t => match(t, 'sin_telefono')).length,
    sin_email:     all.filter(t => match(t, 'sin_email')).length,
  }

  let rows = all.filter(t => match(t, tipo))
  if (q) {
    const ql = q.toLowerCase()
    rows = rows.filter(t =>
      t.name.toLowerCase().includes(ql) ||
      (t.dni?.toLowerCase().includes(ql) ?? false) ||
      (t.phone?.toLowerCase().includes(ql) ?? false),
    )
  }

  const totalRent      = all.reduce((s, t) => s + t.monthlyRent, 0)
  const withPhone      = counts.todos - counts.sin_telefono

  const buildHref = (overrides: Partial<{ tipo: Tipo; q: string }>) => {
    const params = new URLSearchParams()
    const merged = { tipo, q, ...overrides }
    if (merged.tipo && merged.tipo !== 'todos') params.set('tipo', merged.tipo)
    if (merged.q)                                params.set('q',    merged.q)
    const qs = params.toString()
    return qs ? `/inquilinos?${qs}` : '/inquilinos'
  }

  const clearTipoHref = buildHref({ tipo: 'todos' })

  const kpis = [
    {
      label: 'Total inquilinos',
      value: counts.todos.toString(),
      delta: 'en cartera',
      tone:  'neutral' as const,
      href:  buildHref({ tipo: 'todos' }),
      active: tipo === 'todos',
    },
    {
      label: 'Con contrato',
      value: counts.con_contrato.toString(),
      delta: `${counts.sin_contrato} sin contrato actual`,
      tone:  'neutral' as const,
      href:  buildHref({ tipo: 'con_contrato' }),
      clearHref: clearTipoHref,
      active: tipo === 'con_contrato',
    },
    {
      label: 'Con teléfono',
      value: `${withPhone} / ${counts.todos}`,
      delta: counts.sin_telefono > 0 ? `${counts.sin_telefono} sin teléfono — tocá para revisar` : 'todos cargados',
      tone:  counts.sin_telefono > 0 ? 'negative' as const : 'positive' as const,
      href:  buildHref({ tipo: 'sin_telefono' }),
      clearHref: clearTipoHref,
      active: tipo === 'sin_telefono',
    },
    {
      label: 'Alquiler total',
      value: '$' + (totalRent / 1_000_000).toFixed(1) + ' M',
      delta: 'suma de alquileres activos',
      tone:  'positive' as const,
      href:  buildHref({ tipo: 'con_contrato' }),
      clearHref: clearTipoHref,
      active: tipo === 'con_contrato',
    },
  ]

  const activeBits: string[] = []
  if (tipo === 'con_contrato')  activeBits.push('Con contrato')
  if (tipo === 'sin_contrato')  activeBits.push('Sin contrato')
  if (tipo === 'sin_telefono')  activeBits.push('Sin teléfono')
  if (tipo === 'sin_email')     activeBits.push('Sin email')
  const activeSummary = activeBits.join(' · ')

  return (
    <>
      <StickyHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Inquilinos</strong>
            {' · '}
            {rows.length === counts.todos ? `${counts.todos}` : `${rows.length} de ${counts.todos}`}
            {activeSummary && <span className="text-slate"> · {activeSummary}</span>}
          </p>
          <div className="w-full sm:w-72 shrink-0 order-3 sm:order-none">
            <AutoSearchInput initialValue={q} placeholder="Buscar por nombre, DNI o teléfono…" />
          </div>
        </div>
      </StickyHeader>

      <StickyKPIStrip cols={4}>
        {kpis.map((k) => (
          <StickyKPIStripItem key={k.label}>
            <KPICard {...k} deltaTone={k.tone} />
          </StickyKPIStripItem>
        ))}
      </StickyKPIStrip>

      <section className="mt-4 bg-paper border border-line rounded shadow-card p-3 sm:p-4">
        <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <span className="label-cap text-slate mr-1 shrink-0">Filtros extra</span>
          <FilterPill href={buildHref({ tipo: 'sin_contrato' })} clearHref={clearTipoHref} label="Sin contrato" count={counts.sin_contrato} active={tipo === 'sin_contrato'} />
          <FilterPill href={buildHref({ tipo: 'sin_email' })}    clearHref={clearTipoHref} label="Sin email"    count={counts.sin_email}    active={tipo === 'sin_email'} />
        </div>

        {q && (
          <div className="mt-3">
            <Link
              href={buildHref({ q: '' })}
              className="inline-flex items-center px-3 h-8 text-[12px] text-slate hover:text-ink transition-colors"
            >
              ↺ Limpiar búsqueda
            </Link>
          </div>
        )}
      </section>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Listado</h2>
            <p className="text-[12px] text-slate mt-0.5">Datos de contacto y contratos vigentes</p>
          </div>
          <p className="text-[12px] text-slate tabular-nums">{rows.length} resultado{rows.length === 1 ? '' : 's'}</p>
        </div>
        <div className="overflow-x-auto">
          {rows.length > 0 ? (
            <table className="w-full text-[13px] min-w-[720px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Inquilino</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Teléfono</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Email</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">DNI</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Contratos</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium">Alquiler mensual</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t, idx) => (
                  <tr key={t.id} className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} hover:bg-cream-2 transition-colors border-b border-line/30`}>
                    <td className="px-4 py-1.5 text-ink font-medium border-r border-line/30">{t.name}</td>
                    <td className="px-4 py-1.5 text-slate-dark tabular-nums border-r border-line/30">{t.phone ?? <span className="text-slate/50">—</span>}</td>
                    <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{t.email ?? <span className="text-slate/50">—</span>}</td>
                    <td className="px-4 py-1.5 text-slate-dark tabular-nums border-r border-line/30">{t.dni ?? <span className="text-slate/50">—</span>}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-ink border-r border-line/30">{t.contractCount}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-ink">{t.monthlyRent > 0 ? fmt(t.monthlyRent) : <span className="text-slate/50">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate">Ningún inquilino coincide con los filtros aplicados</p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
