import Link from 'next/link'
import { Building2, Landmark, ChevronRight } from 'lucide-react'
import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { StickyKPIStrip, StickyKPIStripItem } from '@/components/ui/StickyKPIStrip'
import { FilterPill } from '@/components/ui/FilterPill'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { TablePagination } from '@/components/ui/TablePagination'
import { PeriodSelect } from '@/components/charts/panel/PeriodSelect'
import { DonutPanel } from '@/components/charts/panel/DonutPanel'
import { listBanks, listBankAccounts, listBankInstitutions, type BankAccountRow, type BankInstitutionRow } from '@/lib/entities/queries'
import { getCommissionByDestination, getDashboardPeriod, getPeriodsWithData } from '@/lib/dashboard/queries'
import { getCommissionByContract, getCommissionByBankMonthly, type BankDest } from '@/lib/bancos/queries'
import { URGENCY_STYLES } from '@/lib/urgency'
import { fmtMoney }       from '@/lib/format'
import { buildPeriodTabs, periodLabel } from '@/lib/period'
import { OWNER_TYPE_LABEL } from '@/lib/owner'

type Categoria = 'todas' | 'admin' | 'administrator' | 'landlord'
type Tab = 'comisiones' | 'cuentas' | 'instituciones'

interface PageProps {
  searchParams: Promise<{
    categoria?: string
    q?:         string
    tab?:       string
    period?:    string
    pagina?:    string
  }>
}

// Bank fees show two decimals because comisiones come with a 0.5%-style precision.
const fmt = (n: number | null) => fmtMoney(n, 2)

export default async function BancosPage({ searchParams }: PageProps) {
  const sp        = await searchParams
  const tab: Tab  = sp.tab === 'cuentas' ? 'cuentas' : sp.tab === 'instituciones' ? 'instituciones' : 'comisiones'
  const categoria = (sp.categoria as Categoria) ?? 'todas'
  const q         = sp.q?.trim() ?? ''

  // ── Comisiones (default) + Instituciones — short-circuit to their layouts ──
  if (tab === 'comisiones')    return <ComisionesView sp={sp} />
  if (tab === 'instituciones') return <InstitucionesView q={q} />

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

  const activeBits: string[] = []
  if (categoria === 'admin')         activeBits.push('Administración')
  if (categoria === 'administrator') activeBits.push('Socios')
  if (categoria === 'landlord')      activeBits.push('Propietarios')
  const activeSummary = activeBits.join(' · ')

  return (
    <>
      <StickyHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap mb-2">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Bancos y cuentas</strong>
            {' · '}
            {rows.length === counts.todas ? `${counts.todas}` : `${rows.length} de ${counts.todas}`}
            {activeSummary && <span className="text-slate"> · {activeSummary}</span>}
          </p>
          <div className="w-full sm:w-72 shrink-0 order-3 sm:order-none">
            <AutoSearchInput initialValue={q} placeholder="Buscar por alias, banco, titular o CBU…" />
          </div>
        </div>

        <TabSwitcher tab="cuentas" />

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
          <span className="label-cap text-slate mr-1 shrink-0">Filtros extra</span>
          <FilterPill href={buildHref({ categoria: 'administrator' })} clearHref={clearCategoriaHref} label="Socios" count={counts.administrator} active={categoria === 'administrator'} />
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
                {rows.map((a, idx) => {
                  const u = URGENCY_STYLES[a.urgency]
                  const tinted   = !!u.row
                  const zebra    = tinted ? '' : (idx % 2 === 0 ? 'bg-cream/40' : '')
                  const cellTint = (a.urgency === 'critical' || a.urgency === 'warning')
                  const cbuMissing = cellTint && !a.cbu ? u.cellTint : ''
                  return (
                    <ClickableRow
                      key={a.id}
                      href={`/bancos/${a.id}`}
                      title={a.urgencyReasons.length ? a.urgencyReasons.join(' · ') : undefined}
                      className={`${zebra} ${u.row} ${tinted ? '' : 'hover:bg-cream-2'} transition-colors border-b border-line/30`}
                    >
                      <td className={`px-4 py-1.5 text-ink font-medium border-l-[4px] ${u.borderLeft} border-r border-line/30`}>
                        {a.alias}
                      </td>
                      <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{a.bankName}</td>
                      <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{a.accountType}</td>
                      <td className={`px-4 py-1.5 text-slate-dark tabular-nums border-r border-line/30 ${cbuMissing}`}>{a.cbu ?? ''}</td>
                      <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{a.ownerLabel}</td>
                      <td className="px-4 py-1.5 text-slate-dark">{OWNER_TYPE_LABEL[a.ownerType]}</td>
                    </ClickableRow>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate">Ninguna cuenta coincide con los filtros aplicados</p>
            </div>
          )}
        </div>
      </section>

    </>
  )
}

// ============================================================================
// Tab switcher — shared between the Cuentas and Instituciones views
// ============================================================================
function TabSwitcher({ tab }: { tab: Tab }) {
  const base = 'inline-flex items-center px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors'
  const activeCls   = 'bg-ink text-paper border-ink'
  const inactiveCls = 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30'
  return (
    <div className="flex items-center gap-2 mb-2">
      <Link href="/bancos"                     className={`${base} ${tab === 'comisiones'    ? activeCls : inactiveCls}`}>Comisiones</Link>
      <Link href="/bancos?tab=cuentas"         className={`${base} ${tab === 'cuentas'       ? activeCls : inactiveCls}`}>Cuentas</Link>
      <Link href="/bancos?tab=instituciones"   className={`${base} ${tab === 'instituciones' ? activeCls : inactiveCls}`}>Instituciones</Link>
    </div>
  )
}

// ============================================================================
// Comisiones view — commission split across the 3 bank destinations (default).
// ============================================================================
const BANKS: { code: BankDest; name: string; sub: string; color: string }[] = [
  { code: 'ADM_GALICIA',      name: 'Galicia',           sub: '',                 color: '#3B82F6' },
  { code: 'ADM_FRANCES_50_9', name: 'BBVA Francés 50-9', sub: 'DONDE.LISA.VALOR', color: '#06B6D4' },
  { code: 'ADM_FRANCES_51_6', name: 'BBVA Francés 51-6', sub: 'DORSO.LISA.VALOR', color: '#8B5CF6' },
]
const BANK_BY_CODE = Object.fromEntries(BANKS.map(b => [b.code, b])) as Record<BankDest, typeof BANKS[number]>
const cleanAddr = (s: string | null) => (s ?? '').replace(/\s*\(vacante\)\s*$/i, '')
const PER_PAGE = 8

async function ComisionesView({ sp }: { sp: { period?: string; pagina?: string } }) {
  const [latest, dataPeriods] = await Promise.all([getDashboardPeriod(), getPeriodsWithData()])
  const validReq = sp.period && /^\d{4}-\d{2}-01$/.test(sp.period) ? sp.period : null
  const period = validReq ?? latest
  const selectorPeriods = buildPeriodTabs(dataPeriods, period, 3)

  const [byDest, monthly, byContract] = await Promise.all([
    getCommissionByDestination(period),
    getCommissionByBankMonthly(12, period),
    getCommissionByContract(period),
  ])
  const total = byDest.reduce((s, b) => s + b.total, 0)

  const cards = BANKS.map(b => {
    const amount = byDest.find(x => x.destination === b.code)?.total ?? 0
    return { ...b, amount, pct: total > 0 ? (amount / total) * 100 : 0, bars: monthly.byDest[b.code] ?? [] }
  })
  const donutItems = cards.filter(c => c.amount > 0).map(c => ({ label: c.name, value: c.amount, color: c.color }))

  // Table pagination
  const totalPages = Math.max(1, Math.ceil(byContract.length / PER_PAGE))
  const page       = Math.min(Math.max(1, parseInt(sp.pagina ?? '1', 10) || 1), totalPages)
  const pageRows   = byContract.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const fromN      = byContract.length === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const toN        = Math.min(page * PER_PAGE, byContract.length)
  const pageHref   = (n: number) => {
    const p = new URLSearchParams()
    if (validReq) p.set('period', period)
    if (n > 1)    p.set('pagina', String(n))
    const qs = p.toString()
    return qs ? `/bancos?${qs}` : '/bancos'
  }
  const donutCenter = total >= 1_000_000 ? `$${(total / 1_000_000).toFixed(1).replace('.', ',')} M` : fmtMoney(total)

  return (
    <div className="space-y-5 pb-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[24px] font-semibold text-ink tracking-tight">Bancos</h1>
          <nav className="text-[12px] text-slate mt-1 flex items-center gap-1.5">
            <Link href="/dashboard" className="text-info hover:underline">Inicio</Link>
            <span className="text-slate/50">/</span>
            <span className="text-slate-dark">Bancos</span>
          </nav>
        </div>
        <PeriodSelect current={period} periods={selectorPeriods} basePath="/bancos" />
      </header>

      <TabSwitcher tab="comisiones" />

      {/* 3 bank cards */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.code} className="rounded-2xl border border-line bg-paper p-4 shadow-card">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0 text-white" style={{ backgroundColor: c.color }}>
                <Landmark size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-ink leading-tight">{c.name}</p>
                {c.sub && <p className="text-[11px] text-slate">{c.sub}</p>}
                <p className="text-[11px] text-slate mt-1">Comisión del mes</p>
                <p className="text-[22px] font-bold text-ink tabular-nums leading-tight">{fmtMoney(c.amount)}</p>
                <p className="text-[12px] font-medium tabular-nums" style={{ color: c.color }}>{c.pct.toFixed(1).replace('.', ',')}% <span className="text-slate font-normal">del total</span></p>
              </div>
            </div>
            <MiniBars values={c.bars} labels={monthly.labels} color={c.color} />
          </div>
        ))}
      </section>

      {/* Table + donut */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        {/* Comisiones por banco y contrato */}
        <div className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-line">
            <h2 className="font-display text-[15px] font-medium text-ink">Comisiones por banco y contrato</h2>
          </div>
          <div className="overflow-x-auto">
            {pageRows.length > 0 ? (
              <table className="w-full text-[13px] min-w-[640px]">
                <thead>
                  <tr className="border-b border-line">
                    {['Contrato', 'Propiedad', 'Banco destino', 'Comisión $', '%', ''].map((h, i) => (
                      <th key={i} className={`label-cap font-medium text-slate px-4 py-2 ${h === 'Comisión $' || h === '%' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(r => {
                    const b = BANK_BY_CODE[r.destination] ?? { name: 'Sin destino', color: '#8A93A5' }
                    return (
                      <tr key={r.txId} className="border-b border-line/60 last:border-0 hover:bg-cream-2 transition-colors">
                        <td className="px-4 py-2.5">
                          {r.contractId
                            ? <Link href={`/contratos/${r.contractId}`} className="text-info hover:underline tabular-nums">{r.contractNumber ?? '—'}</Link>
                            : <span className="text-slate tabular-nums">{r.contractNumber ?? '—'}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-dark truncate max-w-[200px]">{cleanAddr(r.propertyAddress) || '—'}{r.propertyCity ? `, ${r.propertyCity}` : ''}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-slate-dark">
                            <Landmark size={14} style={{ color: b.color }} /> {b.name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink whitespace-nowrap">{fmtMoney(r.amount)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-dark">{r.pct.toFixed(1).replace('.', ',')}%</td>
                        <td className="px-4 py-2.5 text-right"><ChevronRight size={15} className="text-slate/40 inline" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p className="p-8 text-center text-[14px] text-slate">Sin comisiones registradas en {periodLabel(period)}</p>
            )}
          </div>
          {byContract.length > 0 && (
            <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[12px] text-slate tabular-nums">Mostrando {fromN} a {toN} de {byContract.length} comisiones</p>
              <TablePagination page={page} totalPages={totalPages} hrefFor={pageHref} />
            </div>
          )}
        </div>

        {/* Distribución de comisiones */}
        <div className="bg-paper border border-line rounded-2xl shadow-card p-5">
          <h2 className="font-display text-[15px] font-medium text-ink mb-3">Distribución de comisiones</h2>
          {donutItems.length > 0 ? (
            <>
              <DonutPanel items={donutItems} totalUnit="Total" valueFormat="money" centerText={donutCenter} />
              <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[13px]">
                <span className="text-slate">Total comisiones</span>
                <span className="tabular-nums font-semibold text-ink">{fmtMoney(total)}</span>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-[14px] text-slate">Sin datos para {periodLabel(period)}</p>
          )}
        </div>
      </section>
    </div>
  )
}

// Compact monthly bar chart for the bank cards.
function MiniBars({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(1, ...values)
  return (
    <div className="mt-3">
      <div className="flex items-end gap-[3px] h-12">
        {values.map((v, i) => (
          <div key={i} className="flex-1 rounded-t transition-all" title={`${labels[i]}: ${fmtMoney(v)}`}
               style={{ height: `${Math.max(3, (v / max) * 100)}%`, backgroundColor: color, opacity: i === values.length - 1 ? 1 : 0.45 }} />
        ))}
      </div>
      <div className="flex gap-[3px] mt-1">
        {labels.map((l, i) => <span key={i} className="flex-1 text-center text-[8px] text-slate capitalize truncate">{l}</span>)}
      </div>
    </div>
  )
}

// ============================================================================
// Instituciones view — separate layout from the Cuentas tab
// ============================================================================
async function InstitucionesView({ q }: { q: string }) {
  const all = await listBankInstitutions()

  let rows = all
  if (q) {
    const ql = q.toLowerCase()
    rows = rows.filter(b =>
      b.name.toLowerCase().includes(ql) ||
      (b.shortCode?.toLowerCase().includes(ql)    ?? false) ||
      (b.contactName?.toLowerCase().includes(ql)  ?? false) ||
      (b.contactEmail?.toLowerCase().includes(ql) ?? false),
    )
  }

  const totalBanks    = all.length
  const withFees      = all.filter(b => b.monthlyFee != null || b.transferFeePct != null || b.transferFeeFixed != null).length
  const withAccounts  = all.filter(b => b.accountCount > 0).length
  const unused        = all.filter(b => b.accountCount === 0).length

  return (
    <>
      <StickyHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap mb-2">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Bancos y cuentas</strong>
            {' · '}
            {rows.length === totalBanks ? `${totalBanks} instituciones` : `${rows.length} de ${totalBanks}`}
          </p>
          <div className="w-full sm:w-72 shrink-0 order-3 sm:order-none">
            <AutoSearchInput initialValue={q} placeholder="Buscar por nombre, código o contacto…" />
          </div>
        </div>

        <TabSwitcher tab="instituciones" />

        <StickyKPIStrip cols={4}>
          <StickyKPIStripItem>
            <KPICard label="Bancos registrados" value={totalBanks.toString()} delta="lista maestra" deltaTone="neutral" />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard label="Con comisiones cargadas" value={withFees.toString()} delta={`${totalBanks - withFees} sin datos`} deltaTone="positive" />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard label="En uso" value={withAccounts.toString()} delta="al menos 1 cuenta" deltaTone="neutral" />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard label="Sin cuentas" value={unused.toString()} delta="candidatos a archivar" deltaTone={unused > 0 ? 'negative' : 'neutral'} />
          </StickyKPIStripItem>
        </StickyKPIStrip>
      </StickyHeader>

      <section className="mt-4 bg-paper border border-line rounded shadow-card p-3 sm:p-4 flex items-center justify-between flex-wrap gap-3">
        <p className="text-[12px] text-slate">
          Cada banco guarda sus comisiones, contacto comercial y notas operativas. Los datos alimentan las pantallas de liquidación y conciliación.
        </p>
        <Link
          href="/bancos/institucion/nuevo"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-ink text-paper text-[12px] font-medium hover:opacity-90 transition-opacity"
        >
          + Nuevo banco
        </Link>
      </section>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Instituciones bancarias</h2>
            <p className="text-[12px] text-slate mt-0.5">
              Tocá una fila para ver y editar comisiones, contactos y notas.
            </p>
          </div>
          <p className="text-[12px] text-slate tabular-nums">{rows.length} resultado{rows.length === 1 ? '' : 's'}</p>
        </div>
        <div className="overflow-x-auto">
          {rows.length > 0 ? (
            <table className="w-full text-[13px] min-w-[860px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Banco</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Código</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Mantenimiento</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Transferencia</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Contacto</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium">Cuentas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b, idx) => {
                  const zebra = idx % 2 === 0 ? 'bg-cream/40' : ''
                  const transferLabel = b.transferFeePct != null && b.transferFeeFixed != null
                    ? `${b.transferFeePct}% + ${fmt(b.transferFeeFixed)}`
                    : b.transferFeePct != null
                      ? `${b.transferFeePct}%`
                      : b.transferFeeFixed != null
                        ? fmt(b.transferFeeFixed)
                        : ''
                  return (
                    <ClickableRow
                      key={b.id}
                      href={`/bancos/institucion/${b.id}`}
                      className={`${zebra} hover:bg-cream-2 transition-colors border-b border-line/30`}
                    >
                      <td className="px-4 py-1.5 text-ink font-medium border-r border-line/30">{b.name}</td>
                      <td className="px-4 py-1.5 text-slate-dark uppercase tracking-wider border-r border-line/30">{b.shortCode ?? ''}</td>
                      <td className="px-4 py-1.5 text-slate-dark tabular-nums text-right border-r border-line/30">{fmt(b.monthlyFee)}</td>
                      <td className="px-4 py-1.5 text-slate-dark tabular-nums text-right border-r border-line/30">{transferLabel}</td>
                      <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">
                        {b.contactName ?? ''}
                        {b.contactPhone && <span className="text-slate ml-1">· {b.contactPhone}</span>}
                      </td>
                      <td className="px-4 py-1.5 text-slate-dark tabular-nums text-right">{b.accountCount}</td>
                    </ClickableRow>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate">Ninguna institución coincide con la búsqueda</p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

