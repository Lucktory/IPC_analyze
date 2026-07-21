import Link from 'next/link'
import { Receipt, ShieldCheck, Users, CheckCircle2 } from 'lucide-react'
import { PeriodSelect } from '@/components/charts/panel/PeriodSelect'
import { listTransactionPeriods, listTransactions } from '@/lib/entities/queries'

// Force dynamic rendering on every request — the planilla shows the
// encargada's edits, and Next.js 15's default RSC cache occasionally
// serves stale data after `router.refresh()` even when revalidatePath
// has been called from a Server Action. Marking this page explicitly
// dynamic guarantees a fresh server query every time the route is
// requested. The page already uses await searchParams + cookies, but
// the explicit directive is a defensive guard.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
import { getCurrentPeriod, buildPeriodTabs, periodLabel, periodShort } from '@/lib/period'
import { getLiquidacionGridForPeriod, getGridDiagnostic, sumGridTotals, type LiquidacionStatus } from '@/lib/liquidacion/queries'
import { getReconciliationByDestination } from '@/lib/reconciliation/queries'
import { listLandlordOptions } from '@/lib/landlord/queries'
import { listTenantOptions } from '@/lib/tenant/queries'
import { listPropertyOptions } from '@/lib/property/queries'
import { getHonorariosForPeriod, type HonorariosPeriod } from '@/lib/contract/events-bulk'
import { LiquidacionGrid } from '@/components/liquidacion/LiquidacionGrid'
import { EmptyGridDiagnostic } from '@/components/liquidacion/EmptyGridDiagnostic'
import { HighlightScroller } from '@/components/liquidacion/HighlightScroller'
import { NewContractModal } from '@/components/liquidacion/NewContractModal'
import { CalcularTodasComisionesButton } from '@/components/liquidacion/CalcularTodasComisionesButton'
import { ResumenView } from '@/components/liquidacion/ResumenView'
import { MovimientosView } from '@/components/liquidacion/MovimientosView'
import { DestinosView } from '@/components/liquidacion/DestinosView'
import { TokenSearchInput } from '@/components/ui/TokenSearchInput'
import { fmtMoney as fmt } from '@/lib/format'

type StatusFilter = 'todas' | LiquidacionStatus
type View         = 'grilla' | 'resumen' | 'movimientos' | 'destinos'

interface PageProps {
  searchParams: Promise<{ period?: string; status?: string; view?: string; q?: string }>
}

const VIEWS: { key: View; label: string }[] = [
  { key: 'grilla',      label: 'Grilla' },
  { key: 'resumen',     label: 'Resumen del período' },
  { key: 'movimientos', label: 'Movimientos' },
  { key: 'destinos',    label: 'Por cuenta destino' },
]

export default async function LiquidacionPage({ searchParams }: PageProps) {
  const { period: paramPeriod, status: paramStatus, view: paramView, q: paramQ } = await searchParams
  // Free-text search over the planilla — owner / tenant / contract number.
  // qRaw keeps the user's casing for the URL + input value; q is normalized
  // for matching.
  const qRaw   = (paramQ ?? '').trim()
  const q      = qRaw.toLowerCase()
  const period = paramPeriod ?? getCurrentPeriod()
  const statusFilter: StatusFilter =
    paramStatus === 'draft' || paramStatus === 'sent' || paramStatus === 'paid'
      ? paramStatus
      : 'todas'
  const view: View =
    paramView === 'resumen' || paramView === 'movimientos' || paramView === 'destinos'
      ? paramView
      : 'grilla'

  // The grid data is needed for the grid view AND for the resumen view
  // (totals derive from the same rows). Periods always. Landlord/tenant
  // option lists feed the autocomplete in the editable Propietario/Inquilino
  // cells — only loaded when the grilla tab is active.
  //
  // Each fetch is wrapped in its OWN try/catch so that:
  //   1. One failing query doesn't take down the whole page (the planilla
  //      can still render with the data that DID load).
  //   2. The actual error message + stack survive into the UI. Next.js's
  //      default error boundary strips messages in production builds; by
  //      catching here we bypass that and can show Alejandro / us exactly
  //      what threw.
  //
  // `pageErrors` collects {source, message, stack} for any failed fetch.
  // The render block displays them in a bright red banner at the top of
  // the page so a single broken query is obvious and actionable.
  type PageError = { source: string; message: string; stack: string | null }
  const pageErrors: PageError[] = []

  async function safe<T>(source: string, fallback: T, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const stack   = err instanceof Error ? (err.stack ?? null) : null
      pageErrors.push({ source, message, stack })
      console.error(`[/liquidacion] ${source} threw:`, err)
      return fallback
    }
  }

  const needsGrid = view === 'grilla' || view === 'resumen'
  const EMPTY_HON: HonorariosPeriod = { total: 0, lines: [] }
  const [periods, allRows, txns, buckets, landlordOptions, tenantOptions, propertyOptions, honorarios] = await Promise.all([
    safe('listTransactionPeriods',    [],   () => listTransactionPeriods()),
    safe('getLiquidacionGridForPeriod', [], () => needsGrid              ? getLiquidacionGridForPeriod(period)   : Promise.resolve([])),
    safe('listTransactions',          [],   () => view === 'movimientos' ? listTransactions(period)               : Promise.resolve([])),
    safe('getReconciliationByDestination', [], () => view === 'destinos' ? getReconciliationByDestination(period) : Promise.resolve([])),
    safe('listLandlordOptions',       [],   () => view === 'grilla'      ? listLandlordOptions()                  : Promise.resolve([])),
    safe('listTenantOptions',         [],   () => view === 'grilla'      ? listTenantOptions()                    : Promise.resolve([])),
    safe('listPropertyOptions',       [],   () => view === 'grilla'      ? listPropertyOptions()                  : Promise.resolve([])),
    safe('getHonorariosForPeriod',    EMPTY_HON, () => view === 'resumen' ? getHonorariosForPeriod(period)        : Promise.resolve(EMPTY_HON)),
  ])

  // When the grid returns zero rows, fetch the diagnostic snapshot so the
  // empty state can surface WHY (no contracts / no active / no junctions / …).
  const gridDiagnostic = needsGrid && allRows.length === 0
    ? await safe('getGridDiagnostic', null, () => getGridDiagnostic(period))
    : null

  // Text search — matches owner / tenant / contract number (plus co-owners,
  // co-tenants and LFA code). The query is split into space-separated tokens
  // and a row matches only when EVERY token is found in some field (AND), so
  // the user can stack conditions (owner + contract + tenant) in any order.
  // Matching is accent- AND case-insensitive so "perez" finds "Perez".
  // Applied BEFORE the status split so the Estado counts and the KPI strip
  // below track the search exactly the way they already track the status
  // filter.
  const fold        = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const searchTokens = fold(qRaw).split(/\s+/).filter(Boolean)
  const searchedRows = searchTokens.length
    ? allRows.filter(r => {
        const hay = [
          r.propietario, r.inquilino, r.contrato, r.lfa,
          ...r.landlordsList.map(l => l.name),
          ...r.tenantsList.map(t => t.name),
        ].map(v => fold(v ?? ''))
        return searchTokens.every(tok => hay.some(v => v.includes(tok)))
      })
    : allRows

  // Status filter — applies to the grid view (only)
  const counts = {
    todas: searchedRows.length,
    draft: searchedRows.filter(r => r.status === 'draft').length,
    sent:  searchedRows.filter(r => r.status === 'sent').length,
    paid:  searchedRows.filter(r => r.status === 'paid').length,
  }
  const rows = statusFilter === 'todas' ? searchedRows : searchedRows.filter(r => r.status === statusFilter)

  // KPIs — header strip uses the grid totals when available, falls back when not
  const baseRows      = view === 'grilla' ? rows : allRows
  const cobrados      = baseRows.filter(r => !!r.fechaBanco).length
  const pendientes    = baseRows.length - cobrados
  const totalIngresos = baseRows.reduce((s, r) => s + r.ingresos, 0)
  const totalAdmi     = baseRows.reduce((s, r) => s + r.admi, 0)
  const totalTransfer = baseRows.reduce((s, r) => s + r.transferencia, 0)
  // Descuadre = the real control: sum of the recorded-transfer vs computed-recibo
  // mismatches the validator flags (TRANSFERENCIA_IMBALANCE). $0 = books balance.
  const descuadre     = Math.round(baseRows.reduce((s, r) =>
    s + (r.validationIssues ?? [])
      .filter(i => i.code === 'TRANSFERENCIA_IMBALANCE')
      .reduce((a, i) => a + Math.abs(i.diff ?? 0), 0), 0))
  const balanceado    = descuadre === 0

  // Period tabs: current month + recent + months-with-data (see buildPeriodTabs).
  const periodTabs = buildPeriodTabs(periods, period)
  // Preserve the current view + status when switching month via the dropdown.
  const periodExtra = new URLSearchParams()
  if (view !== 'grilla')          periodExtra.set('view', view)
  if (statusFilter !== 'todas')   periodExtra.set('status', statusFilter)
  if (qRaw)                       periodExtra.set('q', qRaw)
  const periodExtraQuery = periodExtra.toString()

  const linkWith = (overrides: Partial<{ period: string; status: StatusFilter; view: View }>) => {
    const merged = { period, status: statusFilter, view, ...overrides }
    const qs = new URLSearchParams()
    if (merged.period)                                  qs.set('period', merged.period)
    if (merged.status && merged.status !== 'todas')     qs.set('status', merged.status)
    if (merged.view   && merged.view   !== 'grilla')    qs.set('view',   merged.view)
    if (qRaw)                                           qs.set('q', qRaw)
    return qs.size > 0 ? `/liquidacion?${qs.toString()}` : '/liquidacion'
  }

  return (
    <>
      {/* ─── Diagnostic banner: visible only when one of the data fetches
              threw. Surfaces the real error message + stack (which
              Next.js's default production error page strips) so the
              actual bug is one click away — instead of a cryptic digest. */}
      {pageErrors.length > 0 && (
        <div className="bg-danger/10 border border-danger/40 rounded p-3 mb-3 text-[12px]">
          <p className="font-medium text-danger mb-1">
            ⚠ {pageErrors.length} {pageErrors.length === 1 ? 'consulta falló' : 'consultas fallaron'} al armar esta página
          </p>
          <ul className="space-y-2">
            {pageErrors.map((e, i) => (
              <li key={i} className="border-t border-danger/20 pt-2 first:border-t-0 first:pt-0">
                <p className="font-mono text-[11px] text-ink">
                  <strong>{e.source}:</strong> {e.message}
                </p>
                {e.stack && (
                  <details className="mt-1">
                    <summary className="text-[10px] text-slate cursor-pointer">stack trace</summary>
                    <pre className="text-[10px] text-slate-dark whitespace-pre-wrap break-words mt-1 max-h-40 overflow-auto">
                      {e.stack}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Top section: ALWAYS-VISIBLE header. Filter strip lives here too
              so it never scrolls away (the user complaint about the
              `+ Nuevo contrato` row disappearing when scrolling). The
              wrapper is `flex-none` inside the page's flex column, so it
              takes its natural height and the grid below takes the rest. */}
      <div className="flex-none">
        <div className="flex items-baseline justify-between gap-3 flex-wrap sm:flex-nowrap mb-1">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Liquidación</strong>
            {' · '}
            {periodLabel(period)}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden mb-1.5">
          {VIEWS.map(v => (
            <Link
              key={v.key}
              href={linkWith({ view: v.key })}
              className={[
                'inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors shrink-0 border',
                v.key === view
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-slate-dark border-line hover:bg-cream-2 hover:text-ink',
              ].join(' ')}
            >
              {v.label}
            </Link>
          ))}
        </div>

        {/* Summary strip — the period's money in one line, ending in the
            Descuadre control (green $0 when the books balance). */}
        {view !== 'movimientos' && view !== 'destinos' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <SummaryChip Icon={Receipt}      color="#16A34A" label="Total cobrado" value={fmt(totalIngresos)} hint={`${cobrados}/${baseRows.length} cobrados`} />
            <SummaryChip Icon={ShieldCheck}  color="#8B5CF6" label="Comisión"      value={fmt(totalAdmi)}     hint={totalIngresos > 0 ? `${(totalAdmi / totalIngresos * 100).toFixed(1)}% · ${periodShort(period)}` : periodShort(period)} />
            <SummaryChip Icon={Users}        color="#3B82F6" label="A transferir"  value={fmt(totalTransfer)} hint="neto a propietarios" />
            <SummaryChip Icon={CheckCircle2} color={balanceado ? '#16A34A' : '#EF4444'} label="Descuadre" value={fmt(descuadre)} valueClass={balanceado ? 'text-success' : 'text-danger'} hint={balanceado ? 'las cuentas cuadran' : 'revisar liquidación'} />
          </div>
        )}

        {/* Inline filter strip — Period always; Estado + Nuevo on grilla only. */}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11.5px] pb-2">
          <span className="label-cap text-slate shrink-0">Período</span>
          <PeriodSelect current={period} periods={periodTabs} basePath="/liquidacion" extraQuery={periodExtraQuery} />

          {view === 'grilla' && (
            <>
              <span className="label-cap text-slate shrink-0 ml-3">Buscar</span>
              <div className="w-56 sm:w-72">
                <TokenSearchInput
                  initialValue={qRaw}
                  placeholder="Propietario, inquilino o contrato..."
                />
              </div>

              <span className="label-cap text-slate shrink-0 ml-3">Estado</span>
              <div className="flex items-center gap-1 flex-wrap">
                <StatusPill href={linkWith({ status: 'todas' })} active={statusFilter === 'todas'} label="Todas"    count={counts.todas} />
                <StatusPill href={linkWith({ status: 'draft' })} active={statusFilter === 'draft'} label="Borrador" count={counts.draft} tone="slate" />
                <StatusPill href={linkWith({ status: 'sent'  })} active={statusFilter === 'sent'}  label="Enviadas" count={counts.sent}  tone="success" />
                <StatusPill href={linkWith({ status: 'paid'  })} active={statusFilter === 'paid'}  label="Pagadas"  count={counts.paid}  tone="info" />
              </div>

              <div className="ml-auto flex items-center gap-2">
                <CalcularTodasComisionesButton period={period} />
                <NewContractModal
                  landlordOptions={landlordOptions}
                  tenantOptions={tenantOptions}
                  propertyOptions={propertyOptions}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Bottom section: the planilla / view content. Takes all remaining
              vertical space (min-h-0 is required so the flex child can
              shrink and contain its own scroll). */}
      <div className="flex-1 min-h-0">
        {/* Diagnostic banner — surfaces what's actually in the DB when the
            grid would otherwise show only "no contracts" with no clue why. */}
        {needsGrid && allRows.length === 0 && gridDiagnostic && (
          <EmptyGridDiagnostic diagnostic={gridDiagnostic} />
        )}

        {view === 'grilla' && (
          <>
            {/* Reads ?highlight=<contractId> on mount and scrolls/pulses
                that row. Used by the "Ver fila →" jumps from /pendientes. */}
            <HighlightScroller />
            {q && rows.length === 0 && allRows.length > 0 ? (
              <section className="bg-paper border border-line p-6 text-center">
                <p className="text-[13px] text-slate">
                  Sin resultados para <strong className="text-ink">&laquo;{qRaw}&raquo;</strong>.
                </p>
                <p className="text-[12px] text-slate mt-1">
                  Proba con otro nombre, apellido o numero de contrato.
                </p>
              </section>
            ) : (
              <LiquidacionGrid rows={rows} totals={sumGridTotals(rows)} period={period} landlordOptions={landlordOptions} tenantOptions={tenantOptions} />
            )}
          </>
        )}
        {view === 'resumen'     && <div className="h-full overflow-auto"><ResumenView    rows={allRows} period={period} honorarios={honorarios} /></div>}
        {view === 'movimientos' && <div className="h-full overflow-auto"><MovimientosView txns={txns}   period={period} /></div>}
        {view === 'destinos'    && <div className="h-full overflow-auto"><DestinosView   buckets={buckets} period={period} /></div>}
      </div>
    </>
  )
}

function StatusPill({
  href, active, label, count, tone = 'neutral',
}: {
  href:   string
  active: boolean
  label:  string
  count:  number
  tone?:  'neutral' | 'slate' | 'success' | 'info'
}) {
  const dotCls =
    tone === 'success' ? 'bg-success' :
    tone === 'info'    ? 'bg-info'    :
    tone === 'slate'   ? 'bg-slate'   :
                         'bg-slate/40'
  return (
    <Link
      href={href}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors',
        active
          ? 'bg-cream-2 text-ink border-ink/40 ring-1 ring-ink/20 hover:bg-cream'
          : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
      ].join(' ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
      {label}
      <span className="inline-flex items-center justify-center text-[10px] font-medium tabular-nums px-1.5 rounded bg-line/60 text-slate-dark">
        {count}
      </span>
    </Link>
  )
}

// Summary chip for the /liquidacion header — icon + the period's key money
// figure. Ends the strip with the Descuadre control (green when balanced).
function SummaryChip({
  Icon, color, label, value, hint, valueClass,
}: {
  Icon:  React.ComponentType<{ size?: number }>
  color: string
  label: string
  value: string
  hint?: string
  valueClass?: string
}) {
  return (
    <div className="flex items-center gap-2.5 bg-paper border border-line rounded-lg px-3 py-2 min-w-0">
      <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ backgroundColor: color + '1f', color }}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate truncate">{label}</p>
        <p className={`font-display font-semibold tabular-nums text-[15px] leading-tight truncate ${valueClass ?? 'text-ink'}`}>{value}</p>
        {hint && <p className="text-[10px] text-slate truncate">{hint}</p>}
      </div>
    </div>
  )
}
