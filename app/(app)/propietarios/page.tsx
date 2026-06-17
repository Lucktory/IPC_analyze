import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { StickyKPIStrip, StickyKPIStripItem } from '@/components/ui/StickyKPIStrip'
import { FilterPill } from '@/components/ui/FilterPill'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { listLandlords, type LandlordRow } from '@/lib/entities/queries'
import { URGENCY_STYLES } from '@/lib/urgency'
import { fmtMoney as fmt } from '@/lib/format'
import { getCurrentPeriodLabel } from '@/lib/period'

type Tipo = 'todos' | 'con_contrato' | 'sin_contratos' | 'sin_cuit' | 'sin_email'

interface PageProps {
  searchParams: Promise<{
    tipo?: string
    q?:    string
  }>
}

export default async function PropietariosPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const tipo   = (sp.tipo as Tipo) ?? 'todos'
  const q      = sp.q?.trim() ?? ''

  const all    = await listLandlords()

  // Filter helpers — small enough dataset (~60) to keep this in the page
  const match = (l: LandlordRow, t: Tipo) => {
    switch (t) {
      case 'con_contrato':   return l.contractCount > 0
      case 'sin_contratos': return l.contractCount === 0
      case 'sin_cuit':       return !l.dniOrCuit
      case 'sin_email':      return !l.email
      default:               return true
    }
  }

  const counts = {
    todos:          all.length,
    con_contrato:   all.filter(l => match(l, 'con_contrato')).length,
    sin_contratos: all.filter(l => match(l, 'sin_contratos')).length,
    sin_cuit:       all.filter(l => match(l, 'sin_cuit')).length,
    sin_email:      all.filter(l => match(l, 'sin_email')).length,
  }

  let rows = all.filter(l => match(l, tipo))
  if (q) {
    const ql = q.toLowerCase()
    rows = rows.filter(l =>
      l.name.toLowerCase().includes(ql) ||
      (l.dniOrCuit?.toLowerCase().includes(ql) ?? false),
    )
  }

  const totalContracts   = all.reduce((s, l) => s + l.contractCount, 0)
  const totalRevenue     = all.reduce((s, l) => s + l.monthlyRevenue, 0)
  const withCuit         = counts.todos - counts.sin_cuit
  // "Junio 2026" — derived from getCurrentPeriod(), never hardcoded.
  const currentMonthLabel = getCurrentPeriodLabel()

  const buildHref = (overrides: Partial<{ tipo: Tipo; q: string }>) => {
    const params = new URLSearchParams()
    const merged = { tipo, q, ...overrides }
    if (merged.tipo && merged.tipo !== 'todos') params.set('tipo', merged.tipo)
    if (merged.q)                                params.set('q',    merged.q)
    const qs = params.toString()
    return qs ? `/propietarios?${qs}` : '/propietarios'
  }

  const clearTipoHref = buildHref({ tipo: 'todos' })

  const kpis = [
    {
      label: 'Total propietarios',
      value: counts.todos.toString(),
      delta: 'en cartera',
      tone:  'neutral' as const,
      href:  buildHref({ tipo: 'todos' }),
      active: tipo === 'todos',
    },
    {
      label: 'Contratos vigentes',
      value: totalContracts.toString(),
      delta: 'propietarios con contrato',
      tone:  'neutral' as const,
      href:  buildHref({ tipo: 'con_contrato' }),
      clearHref: clearTipoHref,
      active: tipo === 'con_contrato',
    },
    {
      label: 'Ingresos del mes',
      value: '$' + (totalRevenue / 1_000_000).toFixed(1) + ' M',
      delta: `alquileres ${currentMonthLabel.toLowerCase()}`,
      tone:  'positive' as const,
      href:  buildHref({ tipo: 'con_contrato' }),
      clearHref: clearTipoHref,
      active: tipo === 'con_contrato',
    },
    {
      label: 'Con CUIT cargado',
      value: `${withCuit} / ${counts.todos}`,
      delta: counts.sin_cuit > 0 ? `${counts.sin_cuit} sin CUIT — tocá para revisar` : 'todos cargados',
      tone:  counts.sin_cuit > 0 ? 'negative' as const : 'positive' as const,
      href:  buildHref({ tipo: 'sin_cuit' }),
      clearHref: clearTipoHref,
      active: tipo === 'sin_cuit',
    },
  ]

  // Active filter summary for the condensed header
  const activeBits: string[] = []
  if (tipo === 'con_contrato')   activeBits.push('Con contrato')
  if (tipo === 'sin_contratos') activeBits.push('Sin contratos')
  if (tipo === 'sin_cuit')       activeBits.push('Sin CUIT')
  if (tipo === 'sin_email')      activeBits.push('Sin email')
  const activeSummary = activeBits.join(' · ')

  return (
    <>
      <StickyHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap mb-2">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Propietarios</strong>
            {' · '}
            {rows.length === counts.todos ? `${counts.todos}` : `${rows.length} de ${counts.todos}`}
            {activeSummary && <span className="text-slate"> · {activeSummary}</span>}
          </p>
          <div className="flex items-center gap-2 order-3 sm:order-none">
            <div className="w-full sm:w-72 shrink-0">
              <AutoSearchInput initialValue={q} placeholder="Buscar por nombre o CUIT…" />
            </div>
            <Link
              href="/propietarios/nuevo"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-ink text-paper text-[12px] font-medium hover:opacity-90 transition-opacity shrink-0"
            >
              + Nuevo
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

      {/* FILTER STRIP — secondary pill row, scrolls naturally with the page */}
      <section className="mt-4 bg-paper border border-line rounded shadow-card p-3 sm:p-4">
        <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <span className="label-cap text-slate mr-1 shrink-0">Filtros extra</span>
          <FilterPill href={buildHref({ tipo: 'sin_contratos' })} clearHref={clearTipoHref} label="Sin contratos" count={counts.sin_contratos} active={tipo === 'sin_contratos'} />
          <FilterPill href={buildHref({ tipo: 'sin_email' })}      clearHref={clearTipoHref} label="Sin email"      count={counts.sin_email}      active={tipo === 'sin_email'} />
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
            <p className="text-[12px] text-slate mt-0.5">Datos fiscales y operativos por propietario</p>
          </div>
          <p className="text-[12px] text-slate tabular-nums">{rows.length} resultado{rows.length === 1 ? '' : 's'}</p>
        </div>
        <div className="overflow-x-auto">
          {rows.length > 0 ? (
            <table className="w-full text-[13px] min-w-[860px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Propietario</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">CUIT / DNI</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Teléfono</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Email</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Contratos</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Propiedades</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium" title={`Alquiler cobrado en ${currentMonthLabel}`}>
                    Ingresos {currentMonthLabel.toLowerCase()}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l, idx) => {
                  const u = URGENCY_STYLES[l.urgency]
                  const tinted   = !!u.row
                  const zebra    = tinted ? '' : (idx % 2 === 0 ? 'bg-cream/40' : '')
                  const cellTint = (l.urgency === 'critical' || l.urgency === 'warning')
                  const cuitMissing  = cellTint && !l.dniOrCuit ? u.cellTint : ''
                  const phoneMissing = cellTint && !l.phone     ? u.cellTint : ''
                  const emailMissing = cellTint && !l.email     ? u.cellTint : ''
                  return (
                    <ClickableRow
                      key={l.id}
                      href={`/propietarios/${l.id}`}
                      title={l.urgencyReasons.length ? l.urgencyReasons.join(' · ') : undefined}
                      className={`${zebra} ${u.row} ${tinted ? '' : 'hover:bg-cream-2'} transition-colors border-b border-line/30`}
                    >
                      <td className={`px-4 py-1.5 text-ink font-medium border-l-[4px] ${u.borderLeft} border-r border-line/30`}>
                        {l.name}
                      </td>
                      <td className={`px-4 py-1.5 text-slate-dark tabular-nums border-r border-line/30 ${cuitMissing}`}>{l.dniOrCuit ?? ''}</td>
                      <td className={`px-4 py-1.5 text-slate-dark tabular-nums border-r border-line/30 ${phoneMissing}`}>{l.phone ?? ''}</td>
                      <td className={`px-4 py-1.5 text-slate-dark border-r border-line/30 ${emailMissing}`}>{l.email ?? ''}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-ink border-r border-line/30">{l.contractCount}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-slate-dark border-r border-line/30">{l.propertyCount}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-ink">{l.monthlyRevenue > 0 ? fmt(l.monthlyRevenue) : ''}</td>
                    </ClickableRow>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate">Ningún propietario coincide con los filtros aplicados</p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
