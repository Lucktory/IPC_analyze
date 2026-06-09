import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { FilterPill } from '@/components/ui/FilterPill'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { listBanks, listBankAccounts, type BankAccountRow } from '@/lib/entities/queries'

type Categoria = 'todas' | 'admin' | 'administrator' | 'landlord'

interface PageProps {
  searchParams: Promise<{
    categoria?: string
    q?:         string
  }>
}

export default async function BancosPage({ searchParams }: PageProps) {
  const sp        = await searchParams
  const categoria = (sp.categoria as Categoria) ?? 'todas'
  const q         = sp.q?.trim() ?? ''

  const [banks, all] = await Promise.all([listBanks(), listBankAccounts()])

  const match = (a: BankAccountRow, c: Categoria) => {
    if (c === 'todas') return true
    return a.ownerType === c
  }

  const counts = {
    todas:         all.length,
    admin:         all.filter(a => match(a, 'admin')).length,
    administrator: all.filter(a => match(a, 'administrator')).length,
    landlord:      all.filter(a => match(a, 'landlord')).length,
  }

  let rows = all.filter(a => match(a, categoria))
  if (q) {
    const ql = q.toLowerCase()
    rows = rows.filter(a =>
      a.alias.toLowerCase().includes(ql) ||
      a.bankName.toLowerCase().includes(ql) ||
      a.ownerLabel.toLowerCase().includes(ql) ||
      (a.cbu?.toLowerCase().includes(ql) ?? false),
    )
  }

  const totalBanks       = banks.length
  const totalAccounts    = counts.todas
  const adminAccounts    = counts.admin
  const landlordAccounts = counts.landlord

  const buildHref = (overrides: Partial<{ categoria: Categoria; q: string }>) => {
    const params = new URLSearchParams()
    const merged = { categoria, q, ...overrides }
    if (merged.categoria && merged.categoria !== 'todas') params.set('categoria', merged.categoria)
    if (merged.q)                                          params.set('q',         merged.q)
    const qs = params.toString()
    return qs ? `/bancos?${qs}` : '/bancos'
  }

  const clearCategoriaHref = buildHref({ categoria: 'todas' })

  const kpis = [
    {
      label: 'Bancos disponibles',
      value: totalBanks.toString(),
      delta: 'lista maestra',
      tone:  'neutral' as const,
      // Not a filter — informational
    },
    {
      label: 'Cuentas registradas',
      value: totalAccounts.toString(),
      delta: 'todas las cuentas',
      tone:  'neutral' as const,
      href:  buildHref({ categoria: 'todas' }),
      active: categoria === 'todas',
    },
    {
      label: 'De la administración',
      value: adminAccounts.toString(),
      delta: 'cuentas operativas',
      tone:  'positive' as const,
      href:  buildHref({ categoria: 'admin' }),
      clearHref: clearCategoriaHref,
      active: categoria === 'admin',
    },
    {
      label: 'De propietarios',
      value: landlordAccounts.toString(),
      delta: 'CBUs para transferir',
      tone:  'neutral' as const,
      href:  buildHref({ categoria: 'landlord' }),
      clearHref: clearCategoriaHref,
      active: categoria === 'landlord',
    },
  ]

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] text-slate-dark">
            <strong className="text-ink font-medium">Bancos y cuentas</strong> ·{' '}
            {rows.length === counts.todas
              ? `${counts.todas} cuentas`
              : `${rows.length} de ${counts.todas} filtradas`}
          </p>
          <p className="label-cap text-slate">Datos en vivo</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <KPICard key={k.label} {...k} deltaTone={k.tone} />
          ))}
        </div>
      </StickyHeader>

      {/* FILTER STRIP — only Socios needs a dedicated pill (admin / landlord are KPIs) */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card p-4 sm:p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label-cap text-slate mr-1">Filtros extra</span>
          <FilterPill href={buildHref({ categoria: 'administrator' })} clearHref={clearCategoriaHref} label="Socios" count={counts.administrator} active={categoria === 'administrator'} />
        </div>

        <div className="mt-4 flex flex-col gap-1.5 max-w-xl">
          <span className="label-cap">Búsqueda</span>
          <AutoSearchInput
            initialValue={q}
            placeholder="Buscar por alias, banco, titular o CBU… (se aplica al instante)"
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
            <h2 className="font-display text-[15px] font-medium text-ink">Cuentas bancarias</h2>
            <p className="text-[12px] text-slate mt-0.5">
              Las cuentas operativas reciben las comisiones; las de propietarios reciben las transferencias.
            </p>
          </div>
          <p className="text-[12px] text-slate tabular-nums">{rows.length} resultado{rows.length === 1 ? '' : 's'}</p>
        </div>
        <div className="overflow-x-auto">
          {rows.length > 0 ? (
            <table className="w-full text-[13px] min-w-[860px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Alias</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Banco</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Tipo</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">CBU</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Titular</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium">Categoría</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, idx) => (
                  <tr key={a.id} className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} hover:bg-cream-2 transition-colors border-b border-line/30`}>
                    <td className="px-4 py-1.5 text-ink font-medium border-r border-line/30">
                      <Link href={`/bancos/${a.id}`} className="hover:underline underline-offset-4 decoration-slate/40">
                        {a.alias}
                      </Link>
                    </td>
                    <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{a.bankName}</td>
                    <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{a.accountType}</td>
                    <td className="px-4 py-1.5 text-slate-dark tabular-nums border-r border-line/30">{a.cbu ?? <span className="text-slate/50">—</span>}</td>
                    <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{a.ownerLabel}</td>
                    <td className="px-4 py-1.5 text-slate-dark capitalize">{categoryLabel(a.ownerType)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate">Ninguna cuenta coincide con los filtros aplicados</p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Lista maestra de bancos</h2>
          <p className="text-[12px] text-slate mt-0.5">
            {banks.length} bancos disponibles para crear cuentas
          </p>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {banks.map((b) => (
              <span
                key={b.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cream-2 border border-line text-[12px] text-slate-dark"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-dark/40" />
                {b.name}
                {b.shortCode && (
                  <span className="text-[10px] text-slate ml-1 uppercase tracking-wider">{b.shortCode}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function categoryLabel(t: 'admin' | 'administrator' | 'landlord' | 'unknown') {
  switch (t) {
    case 'admin':         return 'Administración'
    case 'administrator': return 'Socio'
    case 'landlord':      return 'Propietario'
    default:              return '—'
  }
}
