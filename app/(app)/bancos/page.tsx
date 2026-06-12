import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { StickyKPIStrip, StickyKPIStripItem } from '@/components/ui/StickyKPIStrip'
import { FilterPill } from '@/components/ui/FilterPill'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { listBanks, listBankAccounts, listBankInstitutions, type BankAccountRow, type BankInstitutionRow } from '@/lib/entities/queries'
import { URGENCY_STYLES } from '@/lib/urgency'
import { fmtMoney }       from '@/lib/format'
import { OWNER_TYPE_LABEL } from '@/lib/owner'

type Categoria = 'todas' | 'admin' | 'administrator' | 'landlord'
type Tab = 'cuentas' | 'instituciones'

interface PageProps {
  searchParams: Promise<{
    categoria?: string
    q?:         string
    tab?:       string
  }>
}

// Bank fees show two decimals because comisiones come with a 0.5%-style precision.
const fmt = (n: number | null) => fmtMoney(n, 2)

export default async function BancosPage({ searchParams }: PageProps) {
  const sp        = await searchParams
  const tab: Tab  = sp.tab === 'instituciones' ? 'instituciones' : 'cuentas'
  const categoria = (sp.categoria as Categoria) ?? 'todas'
  const q         = sp.q?.trim() ?? ''

  // ── Instituciones tab — short-circuit, render a different layout ──
  if (tab === 'instituciones') {
    return <InstitucionesView q={q} />
  }

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
      <Link href="/bancos"                     className={`${base} ${tab === 'cuentas'       ? activeCls : inactiveCls}`}>Cuentas</Link>
      <Link href="/bancos?tab=instituciones"   className={`${base} ${tab === 'instituciones' ? activeCls : inactiveCls}`}>Instituciones</Link>
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

