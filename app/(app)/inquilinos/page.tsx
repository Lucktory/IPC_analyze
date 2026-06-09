import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
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

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] text-slate-dark">
            <strong className="text-ink font-medium">Inquilinos</strong> ·{' '}
            {rows.length === counts.todos
              ? `${counts.todos} en cartera`
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

      {/* FILTER STRIP — pills for secondary states, auto-applying search */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card p-4 sm:p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label-cap text-slate mr-1">Filtros extra</span>
          <FilterPill href={buildHref({ tipo: 'sin_contrato' })} clearHref={clearTipoHref} label="Sin contrato" count={counts.sin_contrato} active={tipo === 'sin_contrato'} />
          <FilterPill href={buildHref({ tipo: 'sin_email' })}    clearHref={clearTipoHref} label="Sin email"    count={counts.sin_email}    active={tipo === 'sin_email'} />
        </div>

        <div className="mt-4 flex flex-col gap-1.5 max-w-xl">
          <span className="label-cap">Búsqueda</span>
          <AutoSearchInput
            initialValue={q}
            placeholder="Buscar por nombre, DNI o teléfono… (se aplica al instante)"
          />
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
